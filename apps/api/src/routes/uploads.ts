import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/auth';
import { audit } from '../services/auditService';

export const uploadsRouter = Router();

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads');

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    // The stored filename is always a random id with a server-chosen extension
    // from the verified mimetype allowlist below, never the client-supplied name.
    cb(null, `${crypto.randomUUID()}${EXTENSION_BY_MIME[file.mimetype]}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (!EXTENSION_BY_MIME[file.mimetype]) return cb(new Error('Only PNG, JPEG, WEBP or GIF images are allowed'));
    cb(null, true);
  },
});

uploadsRouter.post('/admin/uploads/team-photo', requireAdmin, (req, res, next) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ message: 'No photo file was received' });
    try {
      await audit(req, 'team_photo_uploaded', 'upload', req.file.filename);
      res.status(201).json({ data: { url: `/uploads/${req.file.filename}` } });
    } catch (e) { next(e); }
  });
});
