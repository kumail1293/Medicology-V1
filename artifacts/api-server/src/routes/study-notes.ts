import { Router } from "express";
import { db } from "../db.js";
import { studyNotesTable, studyNoteBookmarksTable } from "@workspace/db";
import { eq, and } from "../utils/drizzle.js";
import { authenticate, requireAdmin, requirePermission } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";
import { renderNoteExport, renderNoteHtml } from "../utils/note-export.js";

export const studyNotesRouter = Router();
export const studyNotesAdminRouter = Router();

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.name, email: req.user?.email });

const parseTags = (raw: unknown): string[] => {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return raw.split(",").map((t) => t.trim()).filter(Boolean);
  }
};

const toNote = (row: any, bookmarkedIds: Set<number>) => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  subject: row.subject,
  content: row.content,
  tags: parseTags(row.tags),
  status: row.status,
  featured: !!row.featured,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  bookmarked: bookmarkedIds.has(row.id),
});

// ---------------------------------------------------------------------------
// Student-facing — published notes only, with subject/search filters.
// ---------------------------------------------------------------------------

studyNotesRouter.get("/", authenticate, async (req: any, res: any) => {
  try {
    const { subject, search } = req.query as { subject?: string; search?: string };

    // Resolve the user's bookmarked note ids.
    const bookmarks = await db
      .select()
      .from(studyNoteBookmarksTable)
      .where(eq(studyNoteBookmarksTable.userId, req.user!.id));
    const bookmarkedIds = new Set<number>(bookmarks.map((b: any) => Number(b.noteId)));

    let rows = await db.select().from(studyNotesTable).where(eq(studyNotesTable.status, "published"));

    if (subject) {
      rows = rows.filter((r: any) => r.subject.toLowerCase() === subject.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r: any) =>
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        parseTags(r.tags).some((t) => t.toLowerCase().includes(q))
      );
    }

    // Featured first, then by recency.
    rows.sort((a: any, b: any) =>
      (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    res.json({ notes: rows.map((r: any) => toNote(r, bookmarkedIds)) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Server-side export — branded self-contained HTML (print → PDF) or raw
// markdown. Any authenticated user may export published notes; admins may
// export any status.
studyNotesRouter.get("/:id/export", authenticate, async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const format = String(req.query.format ?? "html").toLowerCase();
    const [row] = await db.select().from(studyNotesTable).where(eq(studyNotesTable.id, id));
    if (!row) return res.status(404).json({ error: "Study note not found" });
    if (row.status !== "published" && !req.user?.isAdmin) {
      return res.status(403).json({ error: "This note is not published" });
    }
    if (format === "md") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${row.slug || `note-${row.id}`}.md"`);
      return res.send(row.content);
    }
    if (format === "html" || format === "html-preview") {
      if (format === "html-preview") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(renderNoteHtml(row.content));
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${row.slug || `note-${row.id}`}.html"`);
      return res.send(await renderNoteExport(row));
    }
    return res.status(400).json({ error: "format must be html, html-preview or md" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle a bookmark on a note.
studyNotesRouter.post("/:id/bookmark", authenticate, async (req: any, res: any) => {
  try {
    const noteId = Number(req.params.id);
    const existing = await db
      .select()
      .from(studyNoteBookmarksTable)
      .where(and(
        eq(studyNoteBookmarksTable.userId, req.user!.id),
        eq(studyNoteBookmarksTable.noteId, noteId)
      ));

    if (existing.length > 0) {
      await db.delete(studyNoteBookmarksTable).where(and(
        eq(studyNoteBookmarksTable.userId, req.user!.id),
        eq(studyNoteBookmarksTable.noteId, noteId)
      ));
      res.json({ bookmarked: false });
    } else {
      await db.insert(studyNoteBookmarksTable).values({ userId: req.user!.id, noteId });
      res.json({ bookmarked: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Admin CRUD — all statuses.
// ---------------------------------------------------------------------------

studyNotesAdminRouter.get("/", requireAdmin, requirePermission("questions.manage"), async (req: any, res: any) => {
  try {
    const rows = await db.select().from(studyNotesTable);
    rows.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ notes: rows.map((r: any) => toNote(r, new Set<number>())) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

studyNotesAdminRouter.post("/", requireAdmin, requirePermission("questions.manage"), async (req: any, res: any) => {
  try {
    const { title, slug, subject, content, tags, status, featured } = req.body ?? {};
    if (!String(title ?? "").trim() || !String(subject ?? "").trim() || !String(content ?? "").trim()) {
      return res.status(400).json({ error: "title, subject and content are required" });
    }
    const [note] = await db.insert(studyNotesTable).values({
      title: String(title).trim(),
      slug: String(slug ?? "").trim() || String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      subject: String(subject).trim(),
      content,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      status: status || "published",
      featured: !!featured,
      createdById: req.user!.id,
    }).returning();
    await recordAudit({
      actor: actorOf(req),
      action: "study_note.create",
      entityType: "study_note",
      entityId: note.id,
      entityLabel: note.title,
      summary: `Created study note "${note.title}" (${note.subject})`,
      newValues: note,
      ip: req.ip,
    });
    res.status(201).json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

studyNotesAdminRouter.put("/:id", requireAdmin, requirePermission("questions.manage"), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const { title, slug, subject, content, tags, status, featured } = req.body ?? {};
    const [existing] = await db.select().from(studyNotesTable).where(eq(studyNotesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Study note not found" });

    const [note] = await db.update(studyNotesTable).set({
      ...(title !== undefined ? { title: String(title).trim() } : {}),
      ...(slug !== undefined ? { slug: String(slug).trim() } : {}),
      ...(subject !== undefined ? { subject: String(subject).trim() } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(tags !== undefined ? { tags: JSON.stringify(Array.isArray(tags) ? tags : []) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(featured !== undefined ? { featured: !!featured } : {}),
      updatedAt: new Date(),
    }).where(eq(studyNotesTable.id, id)).returning();

    await recordAudit({
      actor: actorOf(req),
      action: "study_note.update",
      entityType: "study_note",
      entityId: id,
      entityLabel: note.title,
      summary: `Updated study note "${note.title}"`,
      oldValues: existing,
      newValues: note,
      ip: req.ip,
    });
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

studyNotesAdminRouter.delete("/:id", requireAdmin, requirePermission("questions.manage"), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(studyNotesTable).where(eq(studyNotesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Study note not found" });

    await db.delete(studyNoteBookmarksTable).where(eq(studyNoteBookmarksTable.noteId, id));
    await db.delete(studyNotesTable).where(eq(studyNotesTable.id, id));
    await recordAudit({
      actor: actorOf(req),
      action: "study_note.delete",
      entityType: "study_note",
      entityId: id,
      entityLabel: existing.title,
      summary: `Deleted study note "${existing.title}"`,
      oldValues: existing,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
