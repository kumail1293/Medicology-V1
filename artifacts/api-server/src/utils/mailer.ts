import { db } from '../db.js';
import { appSettingsTable, emailLogsTable, type EmailLog } from '@workspace/db';
import { mergeSettings, type EmailSettings } from './settings-defaults.js';
import { renderEmail, renderEmailPlain, type EmailBlock } from './email-renderer.js';

// ============================================================================
// Mailer — resolves the effective email settings (platform defaults + stored
// overrides), reads the SMTP secret from its dedicated key (never from the
// settings group), and sends via SMTP or logs in dev.
// ============================================================================

const SECRET_KEY = '__secret_email_smtp_password';

async function loadEmailSettings(): Promise<{ settings: EmailSettings; smtpPassword: string }> {
  const rows = await db.select().from(appSettingsTable);
  const stored: Record<string, any> = {};
  let smtpPassword = '';
  for (const row of rows) {
    if (row.key === SECRET_KEY) {
      smtpPassword = String(row.value ?? '');
      continue;
    }
    stored[row.key] = row.value;
  }
  const merged = mergeSettings(stored);
  return { settings: merged.email, smtpPassword };
}

export interface SendEmailInput {
  to: string;
  subject: string;
  blocks: EmailBlock[];
  templateId?: number;
  requestedById?: number | null;
  data?: Record<string, string | number | boolean | undefined>;
}

export interface SendEmailResult {
  ok: boolean;
  status: 'queued' | 'sent' | 'failed';
  provider: string;
  error?: string;
  logId?: number;
}

/** Minimal SMTP client (no external deps) — EHLO/STARTTLS-free plain TLS or
 *  insecure SMTP for dev. Production deployments can point provider to a
 *  transactional API instead; the log provider is always the safe default. */
async function sendSmtp(opts: {
  host: string; port: number; secure: boolean; user: string; password: string;
  from: string; fromName: string; replyTo: string; to: string; subject: string; html: string; text: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!opts.host) return { ok: false, error: 'SMTP host not configured' };
  const net = await import('net');
  const tls = await import('tls');

  return new Promise((resolve) => {
    const socket = opts.secure
      ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
      : net.connect({ host: opts.host, port: opts.port });
    let buffer = '';
    let stage = 'greet';
    let code = '';
    const timeout = setTimeout(() => { socket.destroy(); resolve({ ok: false, error: 'SMTP timeout' }); }, 15000);

    const send = (line: string) => socket.write(line + '\r\n');

    const onLine = (line: string) => {
      code = line.slice(0, 3);
      // Multi-line responses end with "<code> <text>"; continuation is "<code>-".
      if (line.length > 3 && line[3] === '-') return;
      const text = line.slice(4);
      if (stage === 'greet' && code === '220') {
        stage = 'ehlo';
        send(`EHLO ${opts.host}`);
      } else if (stage === 'ehlo' && code === '250') {
        stage = 'auth';
        send(`AUTH LOGIN`);
      } else if (stage === 'auth' && code === '334') {
        stage = 'user';
        send(Buffer.from(opts.user).toString('base64'));
      } else if (stage === 'user' && code === '334') {
        stage = 'pass';
        send(Buffer.from(opts.password).toString('base64'));
      } else if (stage === 'pass' && code === '235') {
        stage = 'from';
        send(`MAIL FROM:<${opts.from}>`);
      } else if (stage === 'from' && code === '250') {
        stage = 'rcpt';
        send(`RCPT TO:<${opts.to}>`);
      } else if (stage === 'rcpt' && code === '250') {
        stage = 'data';
        send('DATA');
      } else if (stage === 'data' && code === '354') {
        stage = 'sendbody';
        const headers = [
          `From: ${opts.fromName} <${opts.from}>`,
          `To: <${opts.to}>`,
          `Reply-To: ${opts.replyTo}`,
          `Subject: ${opts.subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
        ].join('\r\n');
        send(`${headers}\r\n\r\n${opts.html}\r\n.`);
      } else if (stage === 'sendbody' && code === '250') {
        stage = 'quit';
        send('QUIT');
        clearTimeout(timeout);
        socket.end();
        resolve({ ok: true });
      } else if (/^(4|5)\d\d/.test(code)) {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: false, error: `SMTP ${code}: ${text}` });
      }
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop() ?? '';
      for (const l of lines) if (l.trim()) onLine(l);
    });
    socket.on('error', (err: any) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });
    socket.on('close', () => {
      clearTimeout(timeout);
      if (stage !== 'quit') resolve({ ok: false, error: 'SMTP connection closed early' });
    });
  });
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { settings, smtpPassword } = await loadEmailSettings();
  const fromName = settings.fromName || 'Medicology';
  const fromEmail = settings.fromEmail || 'no-reply@medicology.com';
  const html = renderEmail({
    blocks: input.blocks,
    data: input.data,
    platformFooter: settings.footerText,
    unsubscribeUrl: input.data?.unsubscribeUrl ? String(input.data.unsubscribeUrl) : undefined,
    primaryColor: '#0d9488',
    brandName: fromName,
  });
  const text = renderEmailPlain(input.blocks, input.data);

  let result: SendEmailResult;
  if (settings.provider === 'smtp') {
    const smtp = await sendSmtp({
      host: settings.smtpHost, port: settings.smtpPort, secure: settings.smtpSecure,
      user: settings.smtpUser, password: smtpPassword,
      from: fromEmail, fromName, replyTo: settings.replyTo || fromEmail,
      to: input.to, subject: input.subject, html, text,
    });
    result = smtp.ok
      ? { ok: true, status: 'sent', provider: 'smtp' }
      : { ok: false, status: 'failed', provider: 'smtp', error: smtp.error };
  } else {
    console.log(`[mail:log] To: ${input.to} | Subject: ${input.subject}\n${text.slice(0, 400)}`);
    result = { ok: true, status: 'sent', provider: 'log' };
  }

  // Persist the send attempt for the admin email log viewer.
  try {
    const inserted = await db.insert(emailLogsTable).values({
      templateId: input.templateId ?? null,
      to: input.to,
      subject: input.subject,
      status: result.status,
      provider: result.provider,
      error: result.error ?? null,
      requestedById: input.requestedById ?? null,
    });
    result.logId = Array.isArray(inserted) ? (inserted[0] as any)?.id : (inserted as any)?.id;
  } catch (err: any) {
    console.error('Failed to persist email log:', err.message);
  }
  return result;
}

export async function getEmailLogs(limit = 50): Promise<EmailLog[]> {
  const rows = await db.select().from(emailLogsTable);
  return (rows as EmailLog[]).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
}
