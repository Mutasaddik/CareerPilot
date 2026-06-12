// ════════════════════════════════════════════════════════════════
// Jobs Routes — /api/v1/jobs
// ════════════════════════════════════════════════════════════════
import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getMatchedJobsForUser, scoreJob, recalculateUserMatches } from '../services/matchingService.js';
import { triggerManualScrape } from '../queue/scraperQueue.js';
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

    // If user has no matches yet, trigger recalculation in background
    const existing = await query(
      `SELECT COUNT(*) FROM job_matches WHERE user_id = $1`, [userId]
    );
    if (parseInt(existing.rows[0].count) === 0) {
      // Don't await — run in background so page loads immediately
      recalculateUserMatches(userId).catch((err) =>
        logger.error('Background recalculate failed', { error: err.message })
      );
    }

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

// ── GET /jobs/:id — single job with match details ─────────────────
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT j.*, jm.relevance_score, jm.match_breakdown_json, jm.seen, jm.user_feedback
       FROM jobs j
       LEFT JOIN job_matches jm ON jm.job_id = j.id AND jm.user_id = $1
       WHERE j.id = $2`,
      [userId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Job not found.' });

    // Mark as seen
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
    const { feedback_type } = req.body; // 'positive' | 'negative'
    if (!['positive', 'negative'].includes(feedback_type)) {
      return res.status(400).json({ success: false, error: 'Invalid feedback type.' });
    }
    await query(
      `UPDATE job_matches SET user_feedback = $1 WHERE job_id = $2 AND user_id = $3`,
      [feedback_type, req.params.id, req.user.id]
    );
    // Also log to job_feedback table
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
    const { saved } = req.body; // boolean
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

// ── POST /jobs/run-scrape — direct scrape bypassing queue ────────
router.post('/run-scrape', async (req, res) => {
  try {
    const { scrapeAllSources } = await import('../services/scraperService.js');
    const { deduplicateInMemory, upsertJobs } = await import('../services/deduplicationService.js');
    const { logScraperRun } = await import('../services/scraperHealthService.js');

    const keywords = req.body.keywords || ['software engineer', 'QA engineer', 'frontend developer', 'backend developer', 'data analyst', 'devops engineer', 'business analyst', 'marketing executive'];
    const startedAt = new Date();

    // Run in background, respond immediately
    res.json({ success: true, message: 'Scrape started in background', keywords: keywords.length });

    // Background execution
    (async () => {
      try {
        const raw     = await scrapeAllSources(keywords);
        const deduped = deduplicateInMemory(raw);
        const result  = await upsertJobs(deduped);
        await logScraperRun({ source: 'all', startedAt, finishedAt: new Date(), jobsFound: result.inserted + result.updated, status: 'success' });
        console.log('Direct scrape complete:', result);
      } catch (err) {
        await logScraperRun({ source: 'all', startedAt, finishedAt: new Date(), jobsFound: 0, status: 'failed', errorMessage: err.message });
        console.error('Direct scrape failed:', err.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /jobs/trigger-scrape — manual scrape (admin) ────────────
router.post('/trigger-scrape', async (req, res) => {
  try {
    const jobId = await triggerManualScrape();
    res.json({ success: true, queue_job_id: jobId });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to trigger scrape.' });
  }
});

export default router;
