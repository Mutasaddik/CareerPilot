import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  STATUSES, listApplications, getApplicationStats, trackJob,
  createManualApplication, updateApplication, deleteApplication,
} from '../services/applicationService.js';
import { deleteCachePattern } from '../models/redis.js';
import logger from '../services/loggerService.js';

const router = express.Router();
router.use(requireAuth);

// Job lists show each job's application status and are cached per user
const clearJobListCache = (userId) => deleteCachePattern(`matches:${userId}:*`);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// A malformed id is just a missing application
const validId = (req, res, next) => (
  validationResult(req).isEmpty() ? next()
    : res.status(404).json({ success: false, error: 'Application not found.' })
);

// ── GET /applications — all tracked applications + funnel stats ───
router.get('/', async (req, res) => {
  try {
    const [applications, stats] = await Promise.all([
      listApplications(req.user.id),
      getApplicationStats(req.user.id),
    ]);
    res.json({ success: true, applications, stats });
  } catch (err) {
    logger.error('List applications error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch applications.' });
  }
});

// ── POST /applications — track a feed job (jobId) or a manual entry ─
router.post('/', [
  body('status').optional().isIn(STATUSES),
  body('jobId').optional().isUUID(),
  body('jobTitle').if(body('jobId').not().exists()).trim().notEmpty().withMessage('Job title is required').isLength({ max: 500 }),
  body('company').if(body('jobId').not().exists()).trim().notEmpty().withMessage('Company is required').isLength({ max: 255 }),
  body('jobUrl').optional({ values: 'falsy' }).isURL().withMessage('Enter a valid link'),
  body('location').optional().trim().isLength({ max: 255 }),
  body('notes').optional().isLength({ max: 5000 }),
], validate, async (req, res) => {
  try {
    const { jobId, status = 'applied' } = req.body;
    const application = jobId
      ? await trackJob(req.user.id, jobId, status)
      : await createManualApplication(req.user.id, { ...req.body, status });
    if (jobId) await clearJobListCache(req.user.id);
    res.status(201).json({ success: true, application });
  } catch (err) {
    logger.error('Create application error', { error: err.message });
    res.status(err.status || 500).json({ success: false, error: err.status ? err.message : 'Failed to save application.' });
  }
});

// ── PATCH /applications/:id — status, notes, dates, offer ─────────
router.patch('/:id', param('id').isUUID(), validId, [
  body('status').optional().isIn(STATUSES),
  body('notes').optional({ values: 'null' }).isLength({ max: 5000 }),
  body('followUpDate').optional({ values: 'falsy' }).isISO8601(),
  body('appliedDate').optional({ values: 'falsy' }).isISO8601(),
  body('offerSalaryBdt').optional({ values: 'falsy' }).isInt({ min: 0, max: 100000000 }),
  body('cvVersionUsed').optional({ values: 'falsy' }).isUUID(),
  body('jobTitle').optional().trim().notEmpty().isLength({ max: 500 }),
  body('company').optional().trim().notEmpty().isLength({ max: 255 }),
  body('jobUrl').optional({ values: 'falsy' }).isURL(),
  body('location').optional().trim().isLength({ max: 255 }),
], validate, async (req, res) => {
  try {
    const application = await updateApplication(req.params.id, req.user.id, req.body);
    if (!application) return res.status(404).json({ success: false, error: 'Application not found.' });
    if (application.job_id) await clearJobListCache(req.user.id);
    res.json({ success: true, application });
  } catch (err) {
    logger.error('Update application error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to update application.' });
  }
});

// ── DELETE /applications/:id ──────────────────────────────────────
router.delete('/:id', param('id').isUUID(), validId, async (req, res) => {
  try {
    const deleted = await deleteApplication(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Application not found.' });
    await clearJobListCache(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete application.' });
  }
});

export default router;
