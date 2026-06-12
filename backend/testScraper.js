import 'dotenv/config';
import { scrapeJSearch } from './src/services/scraperService.js';
import { scrapeBdjobs } from './src/services/scraperService.js';

console.log('Testing JSearch...');
const jsearchJobs = await scrapeJSearch('software engineer', 'Bangladesh', 1);
console.log('JSearch jobs:', jsearchJobs.length);
if (jsearchJobs.length > 0) console.log('Sample:', jsearchJobs[0].title, '|', jsearchJobs[0].company);

console.log('\nTesting Bdjobs...');
const bdjobsJobs = await scrapeBdjobs('software engineer', 1);
console.log('Bdjobs jobs:', bdjobsJobs.length);
if (bdjobsJobs.length > 0) console.log('Sample:', bdjobsJobs[0].title, '|', bdjobsJobs[0].company);

process.exit(0);
