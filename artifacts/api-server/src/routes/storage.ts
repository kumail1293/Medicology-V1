import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

export const storageRouter = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// Request upload URL
storageRouter.post('/upload-url', authenticate, async (req, res: any) => {
  try {
    const { name } = req.body;
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(name || '.jpg');
    const filename = `${unique}${ext}`;
    res.json({
      uploadURL: `http://localhost:8080/api/storage/upload/${filename}`,
      objectPath: `/uploads/${filename}`,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Upload file
storageRouter.put('/upload/:filename', upload.single('file'), async (req, res: any) => {
  try {
    return res.json({ success: true, path: `/uploads/${req.params.filename}` });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Serve uploaded files
storageRouter.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  return res.sendFile(filePath);
});
