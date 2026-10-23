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
import { query } from '../models/db.js';
import { recalculateUserMatches } from '../services/matchingService.js';
import {
  createRewrite, listRewrites, getRewrite, updateRewrite, deleteRewrite,
} from '../services/cvRewriteService.js';
import { isGeminiAvailable } from '../services/aiService.js';
import redis from '../models/redis.js';

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

    // Upsert user_profiles with detected CV data if empty
    if (analysis.detected?.target_role || analysis.detected?.skills?.length) {
      try {
        await query(
          `INSERT INTO user_profiles (user_id, target_roles, skills, experience_years)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET
             target_roles = CASE WHEN array_length(user_profiles.target_roles, 1) IS NULL OR user_profiles.target_roles IS NULL
                           THEN $2 ELSE user_profiles.target_roles END,
             skills       = CASE WHEN array_length(user_profiles.skills, 1) IS NULL OR user_profiles.skills IS NULL
                           THEN $3 ELSE user_profiles.skills END,
             experience_years = CASE WHEN user_profiles.experience_years IS NULL OR user_profiles.experience_years = 0
                           THEN $4 ELSE user_profiles.experience_years END`,
          [
            userId,
            analysis.detected.target_role ? [analysis.detected.target_role] : null,
            analysis.detected.skills?.slice(0, 20) || null,
            analysis.detected.experience_years || null
          ]
        );
        logger.info('User profile auto-enriched from uploaded CV', { userId });
      } catch (profileErr) {
        logger.error('Failed to auto-enrich user profile from CV', { error: profileErr.message, userId });
      }
    }

    // Trigger match recalculation in the background
    recalculateUserMatches(userId).catch((err) =>
      logger.error('Post-upload match recalculation failed', { error: err.message, userId })
    );

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

// ── CV rewrites (AI) ──────────────────────────────────────────────
// Declared before '/:id' so '/rewrites' isn't read as a CV id.
const REWRITE_DAILY_LIMIT = parseInt(process.env.CV_REWRITE_DAILY_LIMIT || '10');

router.post('/rewrite', async (req, res) => {
  try {
    if (!isGeminiAvailable()) {
      return res.status(503).json({ success: false, error: 'CV rewriting is not available right now.' });
    }
    const key  = `cvrewrite:${req.user.id}:${new Date().toISOString().slice(0, 10)}`;
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, 26 * 60 * 60);
    if (used > REWRITE_DAILY_LIMIT) {
      return res.status(429).json({ success: false, error: `Daily rewrite limit reached (${REWRITE_DAILY_LIMIT}/day). Try again tomorrow.` });
    }

    const { cvId, jobId } = req.body || {};
    const rewrite = await createRewrite({ userId: req.user.id, cvId: cvId || null, jobId: jobId || null });
    res.status(201).json({ success: true, rewrite });
  } catch (err) {
    logger.error('CV rewrite error', { error: err.message, userId: req.user.id });
    res.status(err.status || 500).json({
      success: false,
      error: err.status ? err.message : 'Could not rewrite the CV. Please try again in a minute.',
    });
  }
});

router.get('/rewrites', async (req, res) => {
  try {
    res.json({ success: true, rewrites: await listRewrites(req.user.id) });
  } catch (err) {
    logger.error('List rewrites error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch rewritten CVs.' });
  }
});

router.get('/rewrites/:rid', async (req, res) => {
  try {
    const rewrite = await getRewrite(req.params.rid, req.user.id);
    if (!rewrite) return res.status(404).json({ success: false, error: 'Rewritten CV not found.' });
    res.json({ success: true, rewrite });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch rewritten CV.' });
  }
});

router.put('/rewrites/:rid', async (req, res) => {
  try {
    const rewrite = await updateRewrite(req.params.rid, req.user.id, req.body?.cv);
    if (!rewrite) return res.status(404).json({ success: false, error: 'Rewritten CV not found.' });
    res.json({ success: true, rewrite });
  } catch (err) {
    logger.error('Update rewrite error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to save changes.' });
  }
});

router.delete('/rewrites/:rid', async (req, res) => {
  try {
    const deleted = await deleteRewrite(req.params.rid, req.user.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Rewritten CV not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete rewritten CV.' });
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
  // Only your own files, and only plain file names — params are URL-decoded,
  // so "..%2F" would otherwise walk out of the uploads folder.
  const { userId, filename } = req.params;
  if (userId !== req.user.id || !/^[\w.-]+\.(pdf|docx)$/i.test(filename) || filename.includes('..')) {
    return res.status(404).json({ success: false, error: 'File not found.' });
  }
  const filePath = path.join(__dirname, '../../uploads/cvs', userId, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found.' });
  }
  res.sendFile(filePath);
});

export default router;
