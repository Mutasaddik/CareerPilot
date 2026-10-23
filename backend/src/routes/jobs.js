import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { getMatchedJobsForUser, recalculateUserMatches } from '../services/matchingService.js';
import { runJobSync, refreshJobsForUser } from '../services/jobSyncService.js';
import { query } from '../models/db.js';
import { getCache, setCache } from '../models/redis.js';
import logger from '../services/loggerService.js';

const router = express.Router();
router.use(requireAuth);

// ── GET /jobs — paginated matched jobs for current user ───────────
router.get('/', async (req, res) => {
  try {
    const userId   = req.user.id;
    const limit    = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset   = parseInt(req.query.offset) || 0;
    const minScore = parseInt(req.query.minScore) || 0;
    const search   = req.query.search || '';

    const data = await getMatchedJobsForUser(userId, { limit, offset, minScore, search });
    res.json({ success: true, ...data });
  } catch (err) {
    logger.error('GET /jobs error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch jobs.' });
  }
});

// ── GET /jobs/stats — dashboard stats ────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT
         COUNT(*)                                           AS total_matched,
         COUNT(*) FILTER (WHERE jm.relevance_score >= 90)  AS excellent,
         COUNT(*) FILTER (WHERE jm.relevance_score >= 70
                            AND jm.relevance_score < 90)   AS strong,
         COUNT(*) FILTER (WHERE jm.relevance_score >= 50
                            AND jm.relevance_score < 70)   AS good,
         MAX(jm.relevance_score)                           AS top_score
       FROM job_matches jm
       JOIN jobs j ON j.id = jm.job_id
       WHERE jm.user_id = $1 AND j.is_expired = FALSE`,
      [userId]
    );
    res.json({ success: true, stats: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
  }
});

// ── POST /jobs/regenerate — user-facing manual rematch with rate limit ──
router.post('/regenerate', async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().slice(0, 10);
    const rateKey = `regen:${userId}:${today}`;

    const limitRaw = await getCache('config:regen_daily_limit');
    const dailyLimit = limitRaw ? parseInt(limitRaw) : 5;

    const countRaw = await getCache(rateKey);
    const usedCount = countRaw ? parseInt(countRaw) : 0;
    if (usedCount >= dailyLimit) {
      return res.status(429).json({
        success: false,
        error: `Daily regeneration limit reached (${dailyLimit}/day). Try again tomorrow.`,
        used: usedCount,
        limit: dailyLimit,
      });
    }

    const now          = new Date();
    const midnight     = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const secondsLeft  = Math.floor((midnight - now) / 1000);
    await setCache(rateKey, String(usedCount + 1), secondsLeft);

    // Fire-and-forget: search the sources for this user's roles, then rematch.
    // recalculateUserMatches clears the user's match cache when it finishes.
    refreshJobsForUser(userId).catch((err) =>
      logger.error('Regenerate refresh failed', { error: err.message, userId })
    );

    res.json({
      success:   true,
      message:   'Job search refreshed! New matches will appear shortly.',
      used:      usedCount + 1,
      limit:     dailyLimit,
      remaining: dailyLimit - usedCount - 1,
    });
  } catch (err) {
    logger.error('POST /jobs/regenerate error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to trigger regeneration.' });
  }
});

// ── GET /jobs/regenerate/status — how many regenerations left today ──
router.get('/regenerate/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().slice(0, 10);
    const rateKey = `regen:${userId}:${today}`;
    const limitRaw = await getCache('config:regen_daily_limit');
    const dailyLimit = limitRaw ? parseInt(limitRaw) : 5;
    const countRaw = await getCache(rateKey);
    const usedCount = countRaw ? parseInt(countRaw) : 0;
    res.json({
      success: true,
      used: usedCount,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - usedCount),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch regen status.' });
  }
});

// ── GET /jobs/:id — single job with match details ─────────────────
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT j.*, jm.relevance_score, jm.match_breakdown_json, jm.seen, jm.user_feedback,
              a.id AS application_id, a.status AS application_status
       FROM jobs j
       LEFT JOIN job_matches jm ON jm.job_id = j.id AND jm.user_id = $1
       LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = $1
       WHERE j.id = $2`,
      [userId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Job not found.' });

    await query(
      `UPDATE job_matches SET seen = TRUE WHERE job_id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );

    res.json({ success: true, job: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch job.' });
  }
});

// ── POST /jobs/:id/feedback — thumbs up/down ─────────────────────
router.post('/:id/feedback', async (req, res) => {
  try {
    const { feedback_type } = req.body;
    if (!['positive', 'negative'].includes(feedback_type)) {
      return res.status(400).json({ success: false, error: 'Invalid feedback type.' });
    }
    await query(
      `UPDATE job_matches SET user_feedback = $1 WHERE job_id = $2 AND user_id = $3`,
      [feedback_type, req.params.id, req.user.id]
    );
    await query(
      `INSERT INTO job_feedback (user_id, job_id, feedback_type)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.id, feedback_type]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save feedback.' });
  }
});

// ── POST /jobs/:id/save — bookmark a job ─────────────────────────
router.post('/:id/save', async (req, res) => {
  try {
    const { saved } = req.body;
    await query(
      `UPDATE job_matches SET user_feedback = $1 WHERE job_id = $2 AND user_id = $3`,
      [saved ? 'saved' : null, req.params.id, req.user.id]
    );
    res.json({ success: true, saved });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save job.' });
  }
});

// ── POST /jobs/recalculate — re-run matching for user ─────────────
router.post('/recalculate', async (req, res) => {
  try {
    const count = await recalculateUserMatches(req.user.id);
    res.json({ success: true, jobs_scored: count });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Recalculation failed.' });
  }
});

// ── POST /jobs/run-scrape — full job sync now (admin) ────────────
router.post(['/run-scrape', '/trigger-scrape'], requireAdmin, (req, res) => {
  const keywords = Array.isArray(req.body?.keywords) ? req.body.keywords.slice(0, 40) : undefined;
  runJobSync({ keywords }).catch((err) => logger.error('Manual job sync failed', { error: err.message }));
  res.json({ success: true, message: 'Job sync started in background.' });
});

export default router;
