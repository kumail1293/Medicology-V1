// ============================================================================
// Anki .apkg import.
//
// An .apkg file is a ZIP archive containing:
//   • collection.anki2 (or collection.anki21) — a SQLite database. The `notes`
//     table stores card content: `flds` (field values joined by \x1f), `mid`
//     (note-type id), `tags` (space-separated) and `id`. The `col` table holds
//     the note-type definitions in a JSON blob (`models`), which tells us the
//     display order + names of the fields per note type.
//   • a `media` JSON file mapping original filenames → hashed names, plus the
//     media files themselves (stored under their hash).
//
// We extract every note into a FlashcardImportRow (front = the note type's
// primary field, back = everything else), preserve cloze templates
// ({{c1::…}}) and image references, import embedded media into the shared
// media library, and rewrite `<img src="…">` to the served media URLs.
//
// Pure-JS deps only (jszip + sql.js) — no native SQLite bindings required.
// ============================================================================

import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { eq } from './drizzle.js';

// ---------------------------------------------------------------------------
// ZIP → SQLite → notes
// ---------------------------------------------------------------------------

interface AnkiNote {
  id: string;
  fields: string[]; // field values in model order
  tags: string[];
  mid: string; // note-type id
}

interface AnkiModel {
  id: number;
  name: string;
  fieldNames: string[];
  isCloze: boolean;
}

function splitFields(flds: string): string[] {
  return String(flds ?? '').split('\x1f');
}

/**
 * Read an .apkg buffer and return parsed notes + the media map
 * (original filename → file bytes) so the caller can persist media.
 */
export async function parseApkg(buffer: Buffer): Promise<{
  notes: AnkiNote[];
  models: Map<string, AnkiModel>;
  media: Map<string, Buffer>; // original filename → bytes
  deckNameHint: string | null;
}> {
  const zip = await JSZip.loadAsync(buffer);

  // The SQLite collection can be .anki2 (Anki ≤ 2.0) or .anki21 (2.1+).
  const dbEntry = zip.file('collection.anki2') || zip.file('collection.anki21');
  if (!dbEntry) throw new Error('This .apkg contains no collection.anki2 — is it a valid Anki package?');

  const dbBytes = await dbEntry.async('nodebuffer');
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(dbBytes));
  try {
    // Note-type definitions (models) — JSON blob on the single `col` row.
    const models: Map<string, AnkiModel> = new Map();
    try {
      const colRes = db.exec('SELECT models FROM col LIMIT 1');
      if (colRes.length > 0 && colRes[0].values.length > 0) {
        const modelsJson = JSON.parse(String(colRes[0].values[0][0]));
        for (const [mid, m] of Object.entries<any>(modelsJson)) {
          const flds: any[] = Array.isArray(m?.flds) ? m.flds : [];
          const fieldNames = flds.map((f) => String(f?.name ?? ''));
          const tmpls = Array.isArray(m?.tmpls) ? m.tmpls : [];
          // Cloze note types have templates whose qfmt references {{cloze:…}}.
          const isCloze = tmpls.some((t: any) => /cloze:/i.test(String(t?.qfmt ?? '') + String(t?.afmt ?? '')));
          models.set(mid, { id: Number(mid), name: String(m?.name ?? ''), fieldNames, isCloze });
        }
      }
    } catch { /* models blob is optional — fall back to positional fields */ }

    // All notes. Anki's notes.flds joins field values with the unit separator.
    const notes: AnkiNote[] = [];
    const notesRes = db.exec('SELECT id, mid, tags, flds FROM notes');
    if (notesRes.length > 0) {
      for (const row of notesRes[0].values) {
        const [id, mid, tags, flds] = row as [string, string, string, string];
        notes.push({
          id: String(id),
          mid: String(mid),
          tags: String(tags ?? '').split(/\s+/).filter(Boolean),
          fields: splitFields(flds),
        });
      }
    }
    if (notes.length === 0) throw new Error('No notes found in this .apkg collection');

    // Media map: `media` JSON maps original filename → hashed name; the files
    // live in the zip under the hashed name.
    const media: Map<string, Buffer> = new Map();
    try {
      const mediaEntry = zip.file('media');
      if (mediaEntry) {
        const mediaJson = JSON.parse(await mediaEntry.async('text'));
        for (const [original, hash] of Object.entries<any>(mediaJson)) {
          const fileEntry = zip.file(String(hash));
          if (fileEntry) media.set(String(original), await fileEntry.async('nodebuffer'));
        }
      }
    } catch { /* no media map — cards with external URLs still work */ }

    // Deck name hint from the `decks` JSON (first non-default deck).
    let deckNameHint: string | null = null;
    try {
      const decksRes = db.exec('SELECT decks FROM col LIMIT 1');
      if (decksRes.length > 0 && decksRes[0].values.length > 0) {
        const decksJson = JSON.parse(String(decksRes[0].values[0][0]));
        const decks = Object.values<any>(decksJson);
        const named = decks.find((d: any) => d && d.name && !/^Default($|\s)/.test(String(d.name)));
        if (named) deckNameHint = String(named.name);
      }
    } catch { /* optional */ }

    return { notes, models, media, deckNameHint };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Media persistence — write into the shared uploads dir + media table.
// ---------------------------------------------------------------------------

const uploadDir = path.join(process.cwd(), 'uploads');

const MEDIA_CATEGORIES = ['logo', 'icon', 'announcement', 'qbank_cover', 'flashcard', 'rich_content', 'seo', 'other'];

// MIME map for every media type Anki cards can embed. Images and audio are
// the common cases; fonts/video are extracted too so `<img>`, `[sound:…]`,
// `<audio>` and `<source>` references all resolve to served files.
const extToMime: Record<string, string> = {
  // images
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  // audio
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
  aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg',
  // video
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
  // fonts (used inside card CSS)
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
};

function imageDimensions(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length < 24) return null;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
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
  } catch { /* ignore */ }
  return null;
}

/**
 * Persist embedded .apkg media (images, audio, video, fonts) into the shared
 * uploads dir + media table. Returns a filename → served URL map (or {} when
 * nothing was extracted). Deduplicated by content hash so re-importing the
 * same deck doesn't duplicate files. Never fails the import — media problems
 * degrade to a missing file rather than aborting the deck.
 */
export async function importApkgMedia(
  media: Map<string, Buffer>,
  userId: number | null,
  db: any,
  mediaTable: any,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (media.size === 0) return urls;
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const crypto = await import('node:crypto');
  for (const [original, bytes] of media) {
    try {
      const ext = path.extname(original).toLowerCase().replace(/^\./, '');
      const mime = extToMime[ext];
      if (!mime) continue;

      const hash = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 16);
      const storedName = `fc-${hash}${ext ? '.' + ext : ''}`;
      const filePath = path.join(uploadDir, storedName);

      // Content-addressed: if the file already exists, reuse it.
      if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, bytes);

      // Register in the media library once.
      const existing = await db.select().from(mediaTable).where(eq(mediaTable.filename, storedName));
      if (!existing || existing.length === 0) {
        const dims = imageDimensions(bytes);
        await db.insert(mediaTable).values({
          filename: storedName,
          originalName: original,
          mimeType: mime,
          sizeBytes: bytes.length,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          url: `/api/storage/uploads/${storedName}`,
          altText: null,
          category: 'flashcard',
          uploadedBy: userId,
        });
      }
      urls.set(original, `/api/storage/uploads/${storedName}`);
    } catch { /* skip broken media entry */ }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Card text rewrite — replace <img src="original">, markdown image
// references, Anki [sound:…] tags, <audio>/<source> and sound spans with the
// served media URL so images and audio render in the study session.
// ---------------------------------------------------------------------------

const resolveMediaUrl = (src: string, urlMap: Map<string, string>): string | undefined =>
  urlMap.get(src) ?? urlMap.get(path.basename(src));

export function rewriteCardMedia(html: string, urlMap: Map<string, string>): string {
  if (!html || urlMap.size === 0) return html;
  let out = html;
  // HTML: <img src="filename.png"> / <img src='filename.png'>
  out = out.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/gi, (whole, pre, src, post) => {
    const url = resolveMediaUrl(src, urlMap);
    return url ? `<img${pre}src="${url}"${post}>` : whole;
  });
  // Markdown: ![alt](filename.png)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, alt, src) => {
    const url = resolveMediaUrl(src, urlMap);
    return url ? `![${alt}](${url})` : whole;
  });
  // Anki 2.x embeds audio as [sound:filename.mp3] — convert to a player.
  out = out.replace(/\[sound:([^\]]+)\]/g, (whole, file) => {
    const url = resolveMediaUrl(String(file).trim(), urlMap);
    return url
      ? `<audio controls preload="none" src="${url}" style="max-width:100%"></audio>`
      : whole;
  });
  // Anki 2.1 sound spans: <span class="sound">filename.mp3</span>.
  out = out.replace(/<span class="sound">([^<]+)<\/span>/gi, (whole, file) => {
    const url = resolveMediaUrl(String(file).trim(), urlMap);
    return url
      ? `<audio controls preload="none" src="${url}" style="max-width:100%"></audio>`
      : whole;
  });
  // <audio src="…"> / <audio><source src="…"></audio>
  out = out.replace(/<audio([^>]*?)src="([^"]+)"([^>]*?)>/gi, (whole, pre, src, post) => {
    const url = resolveMediaUrl(src, urlMap);
    return url ? `<audio${pre}src="${url}"${post}>` : whole;
  });
  out = out.replace(/<source([^>]*?)src="([^"]+)"([^>]*?)>/gi, (whole, pre, src, post) => {
    const url = resolveMediaUrl(src, urlMap);
    return url ? `<source${pre}src="${url}"${post}>` : whole;
  });
  return out;
}

// Backwards-compatible alias (used by the flashcard importer).
export const rewriteCardImages = rewriteCardMedia;

export { MEDIA_CATEGORIES };
