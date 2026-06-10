import express from 'express';
import { requireModeratorAccess } from '../middleware/adminMiddleware.js';
import { query } from '../models/db.js';
import { logAudit } from '../services/adminService.js';
import logger from '../services/loggerService.js';

const router = express.Router();

router.use(requireModeratorAccess);

// ── Moderator stats ───────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      query(`SELECT COUNT(*) FROM interview_experiences WHERE is_approved = FALSE AND user_submitted = TRUE`),
      query(`SELECT COUNT(*) FROM interview_experiences WHERE is_approved = TRUE`),
      query(`SELECT COUNT(*) FROM interview_experiences WHERE is_approved = FALSE AND moderation_notes IS NOT NULL`),
    ]);
    res.json({
      success: true,
      stats: {
        pendingSubmissions: parseInt(pending.rows[0].count),
        approvedSubmissions: parseInt(approved.rows[0].count),
        rejectedSubmissions: parseInt(rejected.rows[0].count),
      },
    });
  } catch (err) {
    logger.error('Moderator stats error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
  }
});

// ── Interview submissions queue ───────────────────────────────────
router.get('/interview-submissions', async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT * FROM interview_experiences
       WHERE user_submitted = TRUE AND is_approved = FALSE
         AND (moderation_notes IS NULL OR moderation_notes = '')
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM interview_experiences
       WHERE user_submitted = TRUE AND is_approved = FALSE
         AND (moderation_notes IS NULL OR moderation_notes = '')`
    );

    res.json({
      success: true,
      submissions: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch submissions.' });
  }
});

// ── Approve submission ────────────────────────────────────────────
router.post('/interview-submissions/:id/approve', async (req, res) => {
  try {
    await query(
      `UPDATE interview_experiences SET is_approved = TRUE, moderation_notes = NULL WHERE id = $1`,
      [req.params.id]
    );
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: 'approve_interview_submission',
      targetType: 'interview_experience', targetId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, message: 'Submission approved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to approve submission.' });
  }
});

// ── Reject submission ─────────────────────────────────────────────
router.post('/interview-submissions/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
    }
    await query(
      `UPDATE interview_experiences SET moderation_notes = $1 WHERE id = $2`,
      [reason, req.params.id]
    );
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: 'reject_interview_submission',
      targetType: 'interview_experience', targetId: req.params.id,
      newValue: { reason },
      ip: req.ip,
    });
    res.json({ success: true, message: 'Submission rejected.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reject submission.' });
  }
});

// ── Salary contributions review ───────────────────────────────────
router.get('/salary-contributions', async (req, res) => {
  try {
    const result = await query(
      `SELECT sc.*, u.name as user_name, u.email as user_email
       FROM salary_contributions sc
       JOIN users u ON u.id = sc.user_id
       WHERE sc.is_validated = FALSE
       ORDER BY sc.created_at DESC
       LIMIT 50`
    );
    res.json({ success: true, contributions: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch contributions.' });
  }
});

router.post('/salary-contributions/:id/validate', async (req, res) => {
  try {
    const { isOutlier } = req.body;
    await query(
      `UPDATE salary_contributions SET is_validated = TRUE, is_outlier = $1 WHERE id = $2`,
      [isOutlier || false, req.params.id]
    );
    res.json({ success: true, message: 'Contribution validated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to validate contribution.' });
  }
});

export default router;
