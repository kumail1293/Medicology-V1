import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import { buildImportPreview, executeImport, loadBulkImportSettings } from '../utils/importer.js';
import type { ImportRowResult } from '../utils/importer.js';
import { buildImportTemplateWorkbook } from '../utils/import-templates.js';
import { recordAudit } from '../utils/audit.js';

export const importRouter = Router();

// GET /api/admin/import/template?type=sba&format=csv — downloadable template
// (xlsx by default, csv with format=csv) with headers, example rows and (for
// xlsx) a Guide sheet.
importRouter.get('/template', authenticate, requireAdmin, requirePermission('import.run'), async (req: any, res: any) => {
  try {
    const type = String(req.query.type ?? '');
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const buffer = buildImportTemplateWorkbook(type || undefined, format);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="medicology-import-template${type ? `-${type}` : ''}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="medicology-import-template${type ? `-${type}` : ''}.xlsx"`);
    }
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload limits come from the bulkImport settings group (file types + size cap).
async function makeUploader() {
  const settings = await loadBulkImportSettings();
  const allowed = settings.allowedFileTypes ?? ['xlsx', 'xls', 'csv', 'tsv'];
  const maxBytes = (Number(settings.maxFileSizeMB) || 20) * 1024 * 1024;
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => {
      const name = (file.originalname || '').toLowerCase();
      const ok = allowed.some((ext: string) => name.endsWith(`.${ext}`));
      if (ok) cb(null, true);
      else cb(new Error(`Only .${allowed.join(', .')} files are supported`));
    },
  });
}

// Step 1: upload + parse + validate + duplicate-detect + map taxonomy + assign QIDs
importRouter.post(
  '/preview',
  authenticate,
  requireAdmin,
  requirePermission('import.run'),
  async (req: any, res: any) => {
    try {
      const upload = await makeUploader();
      upload.single('file')(req, res, async (err: any) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        try {
          const preview = await buildImportPreview(req.file.buffer, req.file.originalname);
          res.json(preview);
        } catch (parseErr: any) {
          res.status(400).json({ error: parseErr.message });
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Step 2: import the rows the admin chose (from the preview response)
importRouter.post('/execute', authenticate, requireAdmin, requirePermission('import.run'), async (req: any, res: any) => {
  try {
    const { rows, includeDuplicates, createMissingTaxonomy } = req.body ?? {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided to import' });
    }

    const result = await executeImport({
      rows: rows as ImportRowResult[],
      includeDuplicates: Boolean(includeDuplicates),
      createMissingTaxonomy: Boolean(createMissingTaxonomy),
    });

    await recordAudit({
      actor: { id: req.user?.id, name: req.user?.name, email: req.user?.email },
      action: 'import.execute',
      entityType: 'question',
      entityId: 0,
      entityLabel: `bulk import (${rows.length} rows)`,
      summary: `Bulk import: ${result.inserted} inserted, ${result.skipped} skipped`,
      newValues: result,
      ip: req.ip,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error in import execute:', err);
    res.status(500).json({ error: err.message });
  }
});
