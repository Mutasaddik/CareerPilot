import express from 'express';
import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  hashCV, isDuplicateCV, saveCV, extractText,
  getNextVersionNumber, createCVRecord, getUserCVs,
  getCVById, setCVAsPrimary, updateCVScope, deleteCV,
} from '../services/cvService.js';
import { analyzeCV } from '../services/aiService.js';
import logger from '../services/loggerService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router    = express.Router();

// Multer — memory storage, 10MB limit, PDF/DOCX only
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF and DOCX files are allowed.'));
  },
});

router.use(requireAuth);

// ── Upload CV ─────────────────────────────────────────────────────
router.post('/upload', upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { buffer, originalname, mimetype } = req.file;
    let { usageScope, companyName, jobId, templatePreference } = req.body;
    // Normalize legacy/short values to schema-valid values
    const scopeMap = { company: 'company_only', job: 'job_only' };
    usageScope = scopeMap[usageScope] || usageScope;
    if (!['primary', 'company_only', 'job_only'].includes(usageScope)) usageScope = 'primary';
    const userId = req.user.id;

    // Hash for deduplication
    const hash = hashCV(buffer);
    const duplicate = await isDuplicateCV(userId, hash);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'This CV has already been uploaded. No duplicate files allowed.',
      });
    }

    // Extract text
    const extractedText = await extractText(buffer, mimetype);
    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract text from this file. Please ensure it is not a scanned image.',
      });
    }

    // Save file
    const ext      = mimetype === 'application/pdf' ? '.pdf' : '.docx';
    const filename = `cv_${userId}_${Date.now()}${ext}`;
    const fileUrl  = await saveCV(buffer, filename, userId);

    // AI Analysis
    logger.info('Starting ATS analysis', { userId });
    const analysis = await analyzeCV(extractedText, userId);

    // Get next version number
    const versionNumber = await getNextVersionNumber(userId);
    const isPrimary     = versionNumber === 1 || usageScope === 'primary';

    // Save to DB
    const cv = await createCVRecord({
      userId,
      fileUrl,
      fileHash:           hash,
      extractedText,
      analysisJson:       analysis,
      atsScore:           analysis.ats_score,
      versionNumber,
      templatePreference: templatePreference || 'modern',
      usageScope:         usageScope || 'primary',
      companyName:        companyName || null,
      jobId:              jobId || null,
      isPrimary,
      originalFilename: originalname,
    });

    logger.info('CV uploaded and analyzed', { userId, atsScore: analysis.ats_score });

    res.status(201).json({
      success:  true,
      message:  'CV uploaded and analyzed successfully.',
      cv: {
        id:             cv.id,
        ats_score:      analysis.ats_score,
        grade:          analysis.grade,
        version_number: cv.version_number,
        is_primary:     cv.is_primary,
        analysis,
      },
    });
  } catch (err) {
    logger.error('CV upload error', { error: err.message });
    if (err.message.includes('Only PDF')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: 'Failed to process CV. Please try again.' });
  }
});

// ── Get all CVs ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const cvs = await getUserCVs(req.user.id);
    res.json({ success: true, cvs });
  } catch (err) {
    logger.error('Get CVs error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch CVs.' });
  }
});

// ── Get single CV with full analysis ─────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const cv = await getCVById(req.params.id, req.user.id);
    if (!cv) return res.status(404).json({ success: false, error: 'CV not found.' });
    res.json({ success: true, cv });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch CV.' });
  }
});

// ── Set as primary ────────────────────────────────────────────────
router.patch('/:id/set-primary', async (req, res) => {
  try {
    await setCVAsPrimary(req.params.id, req.user.id);
    res.json({ success: true, message: 'CV set as primary.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update CV.' });
  }
});

// ── Update scope ──────────────────────────────────────────────────
router.patch('/:id/scope', async (req, res) => {
  try {
    const { usageScope, companyName, jobId } = req.body;
    await updateCVScope(req.params.id, req.user.id, usageScope, companyName, jobId);
    res.json({ success: true, message: 'CV scope updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update scope.' });
  }
});

// ── Re-analyze existing CV ────────────────────────────────────────
router.post('/:id/analyze', async (req, res) => {
  try {
    const cv = await getCVById(req.params.id, req.user.id);
    if (!cv) return res.status(404).json({ success: false, error: 'CV not found.' });
    if (!cv.extracted_text) return res.status(400).json({ success: false, error: 'No text content to analyze.' });

    const analysis = await analyzeCV(cv.extracted_text, req.user.id);
    const { query } = await import('../models/db.js');
    await query(
      `UPDATE cvs SET ats_score = $1, analysis_json = $2 WHERE id = $3`,
      [analysis.ats_score, JSON.stringify(analysis), cv.id]
    );
    res.json({ success: true, analysis });
  } catch (err) {
    logger.error('Re-analyze error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to analyze CV.' });
  }
});

// ── Delete CV ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await deleteCV(req.params.id, req.user.id);
    res.json({ success: true, message: 'CV deleted.' });
  } catch (err) {
    logger.error('Delete CV error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to delete CV.' });
  }
});

// ── Serve CV file (dev only) ──────────────────────────────────────
router.get('/file/:userId/:filename', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, error: 'Not available in production.' });
  }
  const filePath = path.join(__dirname, '../../uploads/cvs', req.params.userId, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found.' });
  }
  res.sendFile(filePath);
});

export default router;
