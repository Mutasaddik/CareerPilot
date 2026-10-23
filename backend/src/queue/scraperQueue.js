// ════════════════════════════════════════════════════════════════
// BullMQ Scraper Queue — optional standalone worker (npm run worker)
// The API process already runs the job sync on a timer (jobSyncService);
// this queue lets a separate process run the same pipeline on demand.
// ════════════════════════════════════════════════════════════════
import { Queue, Worker } from 'bullmq';
import { runJobSync } from '../services/jobSyncService.js';
import logger from '../services/loggerService.js';

const REDIS_CONN = {
  host:     process.env.REDIS_HOST || 'localhost',
  port:     parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

export const scraperQueue = new Queue('scraper', {
  connection:        REDIS_CONN,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail:     100,
    attempts:         1,
  },
});

export const scraperWorker = new Worker(
  'scraper',
  async (job) => {
    logger.info('Scraper job started', { jobId: job.id, name: job.name });
    return runJobSync({ keywords: job.data?.keywords });
  },
  {
    connection:    REDIS_CONN,
    concurrency:   1,
    lockDuration:  3600000,  // a full sync can take a long time on first run
    lockRenewTime: 300000,
  }
);

scraperWorker.on('completed', (job, result) => {
  logger.info('Scraper worker completed', { jobId: job.id, result });
});

scraperWorker.on('failed', (job, err) => {
  logger.error('Scraper worker failed', { jobId: job?.id, error: err.message });
});

// Only process jobs in the dedicated worker process (npm run worker)
if (process.env.RUN_WORKER !== 'true') {
  scraperWorker.close();
}

// Older versions scheduled a 12-hourly repeatable job; remove it so a
// standalone worker doesn't run a second sync alongside the API's timer.
export const removeLegacyRepeatableJobs = async () => {
  const repeatable = await scraperQueue.getRepeatableJobs();
  for (const j of repeatable) await scraperQueue.removeRepeatableByKey(j.key);
};

// ── Manual trigger ────────────────────────────────────────────────
export const triggerManualScrape = async (keywords) => {
  const job = await scraperQueue.add('scrape-manual', { keywords }, { priority: 1 });
  logger.info('Manual scrape triggered', { jobId: job.id });
  return job.id;
};
