import 'dotenv/config';
import logger from './services/loggerService.js';
import { scraperWorker } from './queue/scraperQueue.js';

logger.info('Scraper worker process started (standalone)');

scraperWorker.on('completed', (job, result) => {
  logger.info('Scraper job completed', { jobId: job.id, result });
});

scraperWorker.on('failed', (job, err) => {
  logger.error('Scraper job failed', { jobId: job?.id, error: err.message });
});

process.on('SIGTERM', async () => {
  await scraperWorker.close();
  process.exit(0);
});
