// ════════════════════════════════════════════════════════════════
// Job Sync — the one pipeline that keeps users' job feeds fresh
// Sources → dedup → upsert → expire → rematch every user with a CV
// Runs in-process on a timer; the BullMQ worker calls the same function.
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { deleteCachePattern } from '../models/redis.js';
import { scrapeAllSources } from './scraperService.js';
import { scrapeBDTechJobs } from './bdTechJobsService.js';
import { deduplicateInMemory, upsertJobs, markExpiredJobs, expireMissingJobs } from './deduplicationService.js';
import { logScraperRun } from './scraperHealthService.js';
import { recalculateAllUsers, recalculateUserMatches } from './matchingService.js';
import logger from './loggerService.js';

const SYNC_INTERVAL_HOURS = parseFloat(process.env.JOB_SYNC_INTERVAL_HOURS || '6');
const MAX_KEYWORDS        = 40;

// Broad baseline so every career track has jobs, even before users sign up
const DEFAULT_KEYWORDS = [
  'QA engineer', 'SQA', 'software engineer', 'frontend developer', 'backend developer',
  'full stack developer', 'devops engineer', 'data analyst', 'mobile developer',
  'product manager', 'business analyst', 'project manager',
  'graphic designer', 'ui ux designer', 'content writer',
  'customer service', 'hr executive', 'accountant',
  'marketing executive', 'sales executive', 'digital marketing',
  'merchandiser', 'event coordinator', 'management trainee',
];

// Users' own target roles first — JSearch's small daily quota is spent on
// the first keywords, so real demand should come before the baseline.
const buildSyncKeywords = async () => {
  const result = await query(
    `SELECT DISTINCT LOWER(TRIM(role)) AS role
     FROM user_profiles, UNNEST(target_roles) AS role
     WHERE role IS NOT NULL AND TRIM(role) <> ''`
  );
  const seen = new Set();
  const keywords = [];
  for (const kw of [...result.rows.map((r) => r.role), ...DEFAULT_KEYWORDS]) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(kw);
  }
  return keywords.slice(0, MAX_KEYWORDS);
};

const storeJobs = async (raw) => {
  const deduped = deduplicateInMemory(raw);
  return upsertJobs(deduped);
};

// ── Full sync ─────────────────────────────────────────────────────
let syncRunning = false;

export const runJobSync = async ({ keywords } = {}) => {
  if (syncRunning) {
    logger.info('Job sync already running — skipped');
    return null;
  }
  syncRunning = true;
  const startedAt = new Date();
  try {
    const kws = keywords?.length ? keywords : await buildSyncKeywords();
    logger.info('Job sync started', { keywords: kws.length });

    // BDTechJobs returns its complete list, so jobs missing from it are gone
    const bdtech = await scrapeBDTechJobs();
    const keywordJobs = await scrapeAllSources(kws);
    const { inserted, updated } = await storeJobs([...bdtech, ...keywordJobs]);

    await markExpiredJobs();
    if (bdtech.length > 0) {
      await expireMissingJobs('BDTechJobs', bdtech.map((j) => j.job_url).filter(Boolean));
    }

    await logScraperRun({
      source: 'all', startedAt, finishedAt: new Date(),
      jobsFound: inserted + updated, status: 'success',
    });

    await recalculateAllUsers();
    await deleteCachePattern('matches:*');

    logger.info('Job sync complete', { inserted, updated, minutes: ((Date.now() - startedAt) / 60000).toFixed(1) });
    return { inserted, updated };
  } catch (err) {
    logger.error('Job sync failed', { error: err.message });
    await logScraperRun({
      source: 'all', startedAt, finishedAt: new Date(),
      jobsFound: 0, status: 'failed', errorMessage: err.message,
    });
    return null;
  } finally {
    syncRunning = false;
  }
};

// ── Refresh one user's feed (the "Regenerate" button) ─────────────
// Searches the sources for this user's roles, then rematches them.
export const refreshJobsForUser = async (userId) => {
  try {
    const result = await query(
      `SELECT up.target_roles, u.current_title,
              c.analysis_json->'detected'->>'target_role' AS detected_role
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN cvs c ON c.user_id = u.id AND c.is_primary = TRUE
       WHERE u.id = $1`,
      [userId]
    );
    const row = result.rows[0] || {};
    const keywords = [...new Set(
      [...(row.target_roles || []), row.current_title, row.detected_role]
        .filter(Boolean)
        .map((k) => k.trim().toLowerCase())
    )].slice(0, 3);

    if (keywords.length > 0) {
      const { inserted, updated } = await storeJobs(await scrapeAllSources(keywords));
      logger.info('User job refresh scraped', { userId, keywords, inserted, updated });
    }
    return await recalculateUserMatches(userId);
  } catch (err) {
    logger.error('refreshJobsForUser failed', { error: err.message, userId });
    return 0;
  }
};

// ── Scheduler ─────────────────────────────────────────────────────
export const scheduleJobSync = () => {
  const run = () => runJobSync().catch((err) => logger.error('Scheduled job sync crashed', { error: err.message }));
  setTimeout(run, 30 * 1000); // let the API finish booting first
  setInterval(run, SYNC_INTERVAL_HOURS * 60 * 60 * 1000);
  logger.info(`Job sync scheduled every ${SYNC_INTERVAL_HOURS}h`);
};
