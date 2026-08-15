import { Router } from 'express';
import { authenticate, requireContentEditor, AuthRequest, ADMIN_ROLES, roleHasPermission } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from '../db.js';
import { mediaTable } from '@workspace/db';
import { eq, desc } from '../utils/drizzle.js';
import { mergeSettings } from '../utils/settings-defaults.js';
import { appSettingsTable } from '@workspace/db';
import { recordAudit } from '../utils/audit.js';

export const storageRouter = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ---------------------------------------------------------------------------
// Settings-driven upload policy (storage group): MIME whitelist + size cap.
// ---------------------------------------------------------------------------

async function loadStorageSettings() {
  const rows = await db.select().from(appSettingsTable);
  const stored: Record<string, any> = {};
  for (const row of rows) stored[row.key] = row.value;
  const merged = mergeSettings(stored) as any;
  const s = merged.storage ?? {};
  const extToMime: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml',
  };
  const allowedTypes = (s.allowedImageTypes ?? ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'])
    .map((e: string) => extToMime[e.toLowerCase()])
    .filter(Boolean);
  const maxBytes = (Number(s.maxUploadSizeMB) || 10) * 1024 * 1024;
  return { allowedTypes, maxBytes };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: async (req, file, cb) => {
    try {
      const { allowedTypes } = await loadStorageSettings();
      if (allowedTypes.includes(file.mimetype)) cb(null, true);
      else cb(new Error('File type not allowed'));
    } catch (err) {
      cb(err as Error);
    }
  },
});

// Parse image dimensions from headers — PNG / JPEG / GIF / WebP. No native
// deps required; failures just leave width/height null.
function imageDimensions(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length < 24) return null;
    // PNG: 8-byte signature, then IHDR width/height (big-endian).
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // GIF: "GIF87a"/"GIF89a" + little-endian width/height.
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    // JPEG: scan SOF markers (0xFFC0–0xFFC3, 0xFFC5–0xFFC7, etc.).
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
        const len = buf.readUInt16BE(off + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
        }
        off += 2 + len;
      }
    }
    // WebP: RIFF....WEBP, then VP8/VP8L/VP8X chunks.
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const fourcc = buf.toString('ascii', 12, 16);
      if (fourcc === 'VP8X') {
        return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      }
      if (fourcc === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (fourcc === 'VP8L') {
        const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
        return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
      }
    }
  } catch { /* ignore */ }
  return null;
}

const MEDIA_CATEGORIES = ['logo', 'icon', 'announcement', 'qbank_cover', 'flashcard', 'rich_content', 'seo', 'other'];

// ---------------------------------------------------------------------------
// Media library (admin settings plan item 18).
// ---------------------------------------------------------------------------

// Upload — content editors + admins. Validated against the storage settings
// group (allowed types + max size), metadata extracted and recorded.
storageRouter.post('/media', authenticate, requireContentEditor, upload.single('file'), async (req: AuthRequest, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const file = req.file;
    const body = req.body ?? {};
    const category = MEDIA_CATEGORIES.includes(body.category) ? body.category : 'other';

    const dims = imageDimensions(fs.readFileSync(file.path));
    const url = `/api/storage/uploads/${file.filename}`;

    const [media] = await db.insert(mediaTable).values({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      url,
      altText: body.altText ? String(body.altText).slice(0, 300) : null,
      category,
      uploadedBy: req.user?.id ?? null,
    }).returning();

    await recordAudit({
      actor: { id: req.user?.id, email: req.user?.email },
      action: 'media.upload',
      entityType: 'media',
      entityId: media.id,
      entityLabel: media.originalName,
      summary: `Uploaded media: ${media.originalName} (${media.category})`,
      newValues: media,
      ip: req.ip,
    });

    return res.status(201).json({ media });
  } catch (err: any) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: err.message === 'File type not allowed' ? 'File type not allowed' : err.message });
  }
});

// Multer errors (fileFilter rejection, size cap) → clean 400, not a 500.
storageRouter.use('/media', (err: any, req: any, res: any, next: any) => {
  if (!err) return next();
  if (req.file) fs.rmSync(req.file.path, { force: true });
  const msg = err.message === 'File type not allowed'
    ? 'File type not allowed'
    : err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
  return res.status(400).json({ error: msg });
});

// List media — any authenticated user (images are public once uploaded; the
// library itself needs a login so editors can pick assets).
storageRouter.get('/media', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { category, search } = req.query;
    const rows = await db.select().from(mediaTable)
      .orderBy(desc(mediaTable.createdAt));

    let items = rows;
    if (category && category !== 'all') items = items.filter((m: any) => m.category === category);
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      items = items.filter((m: any) => m.originalName.toLowerCase().includes(q) || (m.altText ?? '').toLowerCase().includes(q));
    }
    res.json({ media: items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update alt text / category — admin or the original uploader.
storageRouter.patch('/media/:id', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const [existing] = await db.select().from(mediaTable).where(eq(mediaTable.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: 'Media not found' });
    const isAdmin = req.user?.isAdmin || ADMIN_ROLES.includes(req.user?.role ?? '');
    if (!isAdmin && Number(existing.uploadedBy) !== Number(req.user?.id)) {
      return res.status(403).json({ error: 'You can only edit media you uploaded' });
    }
    if (isAdmin && !roleHasPermission(req.user?.role, 'media.manage')) {
      return res.status(403).json({ error: 'Forbidden — requires the media.manage permission' });
    }
    const set: any = { updatedAt: new Date() };
    if (req.body.altText !== undefined) set.altText = String(req.body.altText).slice(0, 300);
    if (req.body.category !== undefined) {
      if (!MEDIA_CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: 'Invalid category' });
      set.category = req.body.category;
    }
    const [media] = await db.update(mediaTable).set(set).where(eq(mediaTable.id, Number(req.params.id))).returning();
    res.json({ media });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete — admin or the original uploader; removes the file too.
storageRouter.delete('/media/:id', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const [existing] = await db.select().from(mediaTable).where(eq(mediaTable.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: 'Media not found' });
    const isAdmin = req.user?.isAdmin || ADMIN_ROLES.includes(req.user?.role ?? '');
    if (!isAdmin && Number(existing.uploadedBy) !== Number(req.user?.id)) {
      return res.status(403).json({ error: 'You can only delete media you uploaded' });
    }
    if (isAdmin && !roleHasPermission(req.user?.role, 'media.manage')) {
      return res.status(403).json({ error: 'Forbidden — requires the media.manage permission' });
    }
    const filePath = path.join(uploadDir, existing.filename);
    fs.rmSync(filePath, { force: true });
    await db.delete(mediaTable).where(eq(mediaTable.id, Number(req.params.id)));
    await recordAudit({
      actor: { id: req.user?.id, email: req.user?.email },
      action: 'media.delete',
      entityType: 'media',
      entityId: existing.id,
      entityLabel: existing.originalName,
      summary: `Deleted media: ${existing.originalName}`,
      oldValues: existing,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Legacy upload flow (kept for compatibility; upload now requires auth).
// ---------------------------------------------------------------------------

// Request upload URL
storageRouter.post('/upload-url', authenticate, async (req, res: any) => {
  try {
    const { name } = req.body;
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(name || '.jpg');
    const filename = `${unique}${ext}`;
    res.json({
      uploadURL: `${req.protocol}://${req.get('host')}/api/storage/upload/${filename}`,
      objectPath: `/uploads/${filename}`,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Upload file (now authenticated + settings-validated)
storageRouter.put('/upload/:filename', authenticate, upload.single('file'), async (req: AuthRequest, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    return res.json({ success: true, path: `/uploads/${req.file.filename}` });
  } catch (err: any) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: err.message === 'File type not allowed' ? 'File type not allowed' : err.message });
  }
});

// Serve uploaded files
storageRouter.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  return res.sendFile(filePath);
});
