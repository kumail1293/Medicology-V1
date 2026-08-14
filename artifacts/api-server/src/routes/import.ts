import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { buildImportPreview, executeImport } from '../utils/importer.js';
import type { ImportRowResult } from '../utils/importer.js';

export const importRouter = Router();

// Accept .xlsx / .xls / .csv files in memory (no disk persistence needed).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || name.endsWith('.tsv')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, .csv or .tsv files are supported'));
    }
  },
});

// Step 1: upload + parse + validate + duplicate-detect + map taxonomy + assign QIDs
importRouter.post(
  '/preview',
  authenticate,
  requireAdmin,
  upload.single('file'),
  async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const preview = await buildImportPreview(req.file.buffer, req.file.originalname);
      res.json(preview);
    } catch (err: any) {
      console.error('Error in import preview:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

// Step 2: import the rows the admin chose (from the preview response)
importRouter.post('/execute', authenticate, requireAdmin, async (req: any, res: any) => {
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

    res.json(result);
  } catch (err: any) {
    console.error('Error in import execute:', err);
    res.status(500).json({ error: err.message });
  }
});
