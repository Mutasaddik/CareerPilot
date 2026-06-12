// ════════════════════════════════════════════════════════════════
// BullMQ Scraper Queue — max 5 concurrent, runs every 12 hours
// ════════════════════════════════════════════════════════════════
import { Queue, Worker, QueueEvents } from 'bullmq';
import { scrapeAllSources } from '../services/scraperService.js';
import { deduplicateInMemory, upsertJobs } from '../services/deduplicationService.js';
import { logScraperRun } from '../services/scraperHealthService.js';
import logger from '../services/loggerService.js';

const REDIS_CONN = {
  host:     process.env.REDIS_HOST || 'localhost',
  port:     parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const ROLE_KEYWORDS = [
  'software engineer', 'frontend developer', 'backend developer',
  'full stack developer', 'QA engineer', 'SDET', 'data analyst',
  'devops engineer', 'product manager', 'business analyst',
  'marketing executive', 'sales executive', 'graphic designer',
  'accountant', 'hr executive', 'customer service',
];

export const scraperQueue = new Queue('scraper', {
  connection:       REDIS_CONN,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail:     100,
    attempts:         3,
    backoff:          { type: 'exponential', delay: 5000 },
  },
});

// ── Worker (max 5 concurrent) ─────────────────────────────────────
export const scraperWorker = new Worker(
  'scraper',
  async (job) => {
    const { keywords = ROLE_KEYWORDS } = job.data;
    const startedAt = new Date();
    logger.info('Scraper job started', { jobId: job.id, keywords: keywords.length });

    try {
      const raw      = await scrapeAllSources(keywords);
      const deduped  = deduplicateInMemory(raw);
      const { inserted, updated } = await upsertJobs(deduped);

      await logScraperRun({
        source:    'all',
        startedAt,
        finishedAt: new Date(),
        jobsFound:  inserted + updated,
        status:     'success',
      });

      logger.info('Scraper job complete', { raw: raw.length, deduped: deduped.length, inserted, updated });
      return { inserted, updated, total: deduped.length };
    } catch (err) {
      await logScraperRun({
        source:    'all',
        startedAt,
        finishedAt: new Date(),
        jobsFound:  0,
        status:     'failed',
        errorMessage: err.message,
      });
      throw err;
    }
  },
  {
    connection:  REDIS_CONN,
    concurrency: 5,
  }
);

scraperWorker.on('completed', (job, result) => {
  logger.info('Scraper worker completed', { jobId: job.id, result });
});

scraperWorker.on('failed', (job, err) => {
  logger.error('Scraper worker failed', { jobId: job?.id, error: err.message });
});

// ── Schedule recurring job every 12 hours ────────────────────────
export const scheduleScraperJob = async () => {
  // Remove old repeatable job first to avoid duplicates
  const repeatableJobs = await scraperQueue.getRepeatableJobs();
  for (const j of repeatableJobs) {
    if (j.name === 'scrape-all') await scraperQueue.removeRepeatableByKey(j.key);
  }

  await scraperQueue.add(
    'scrape-all',
    { keywords: ROLE_KEYWORDS },
    { repeat: { every: 12 * 60 * 60 * 1000 } }
  );
  logger.info('Scraper scheduled every 12 hours');
};

// ── Manual trigger ────────────────────────────────────────────────
export const triggerManualScrape = async (keywords = ROLE_KEYWORDS) => {
  const job = await scraperQueue.add('scrape-manual', { keywords }, { priority: 1 });
  logger.info('Manual scrape triggered', { jobId: job.id });
  return job.id;
};
