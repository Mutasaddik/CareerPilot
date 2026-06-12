// ════════════════════════════════════════════════════════════════
// Scraper Health Service
// Logs every run, tracks consecutive failures, alerts admin
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import logger from './loggerService.js';

// ── Log a scraper run ─────────────────────────────────────────────
export const logScraperRun = async ({ source, startedAt, finishedAt, jobsFound, status, errorMessage }) => {
  try {
    await query(
      `INSERT INTO scraper_logs (source, started_at, finished_at, jobs_found, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [source, startedAt, finishedAt, jobsFound, status, errorMessage || null]
    );

    // Check consecutive failures
    const recent = await query(
      `SELECT status FROM scraper_logs
       WHERE source = $1
       ORDER BY started_at DESC
       LIMIT 3`,
      [source]
    );

    const allFailed = recent.rows.length === 3 && recent.rows.every((r) => r.status === 'failed');
    if (allFailed) {
      logger.error('SCRAPER ALERT: 3 consecutive failures', { source });
      // In Phase 11 this triggers a real email — for now just log
    }
  } catch (err) {
    logger.error('logScraperRun failed', { error: err.message });
  }
};

// ── Get health status per source ──────────────────────────────────
export const getScraperHealth = async () => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (source)
         source, status, jobs_found, started_at, finished_at, error_message,
         consecutive_failures
       FROM scraper_logs
       ORDER BY source, started_at DESC`
    );

    const totalJobs = await query(`SELECT COUNT(*) FROM jobs WHERE is_expired = FALSE`);

    return {
      sources:    result.rows,
      total_jobs: parseInt(totalJobs.rows[0].count),
      last_run:   result.rows[0]?.started_at || null,
    };
  } catch (err) {
    logger.error('getScraperHealth failed', { error: err.message });
    return { sources: [], total_jobs: 0 };
  }
};

// ── Get recent scraper logs ───────────────────────────────────────
export const getRecentScraperLogs = async (limit = 20) => {
  try {
    const result = await query(
      `SELECT * FROM scraper_logs ORDER BY started_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    logger.error('getRecentScraperLogs failed', { error: err.message });
    return [];
  }
};
