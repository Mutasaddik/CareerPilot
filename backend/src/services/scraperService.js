// ════════════════════════════════════════════════════════════════
// CareerPilot Scraper Service
// Source 1+2: JSearch API (LinkedIn + Indeed via RapidAPI — legal)
// Source 3:   Bdjobs.com direct scrape
// Source 4:   Rozee.pk direct scrape
// All jobs → deduplication → DB upsert
// ════════════════════════════════════════════════════════════════
import axios from 'axios';
import * as cheerio from 'cheerio';
import { query } from '../models/db.js';
import { getCache, setCache } from '../models/redis.js';
import logger from './loggerService.js';

const JSEARCH_KEY  = process.env.JSEARCH_API_KEY;
const CACHE_TTL    = 12 * 60 * 60; // 12 hours
const REQ_DELAY_MS = () => 800 + Math.floor(Math.random() * 1200); // 0.8–2s random delay
const sleep        = (ms) => new Promise((r) => setTimeout(r, ms));

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
];
const randAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// ── Normalise a raw job object into our schema ────────────────────
const normalizeJob = (raw) => ({
  title:            (raw.title || '').trim(),
  company:          (raw.company || '').trim(),
  company_domain:   raw.company_domain || null,
  location:         (raw.location || 'Bangladesh').trim(),
  job_url:          raw.job_url || '',
  description:      (raw.description || '').slice(0, 8000),
  posted_date:      raw.posted_date || new Date().toISOString(),
  sources:          raw.sources || ['unknown'],
  is_remote:        raw.is_remote || false,
  experience_level: raw.experience_level || 'mid',
  salary_min_bdt:   raw.salary_min_bdt || null,
  salary_max_bdt:   raw.salary_max_bdt || null,
  company_logo_url: raw.company_logo_url || null,
});

// ── BDT salary parser ─────────────────────────────────────────────
const parseBDTSalary = (text) => {
  if (!text) return { min: null, max: null };
  const norm = text.toLowerCase().replace(/,/g, '');
  // Match patterns: ৳50000-80000, 50k-80k, 50,000-80,000 BDT
  const ranges = norm.match(/(\d+(?:\.\d+)?)\s*k?\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*k?/);
  if (ranges) {
    let min = parseFloat(ranges[1]);
    let max = parseFloat(ranges[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return { min: Math.round(min), max: Math.round(max) };
  }
  const single = norm.match(/(\d+(?:\.\d+)?)\s*k?/);
  if (single) {
    let val = parseFloat(single[1]);
    if (val < 1000) val *= 1000;
    return { min: Math.round(val), max: null };
  }
  return { min: null, max: null };
};

// ── Source 1+2: JSearch (LinkedIn + Indeed) ───────────────────────
export const scrapeJSearch = async (query_str, location = 'Bangladesh', page = 1) => {
  if (!JSEARCH_KEY) {
    logger.warn('JSearch: no API key — skipping');
    return [];
  }
  const cacheKey = `jsearch:${query_str}:${location}:${page}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  try {
    await sleep(REQ_DELAY_MS());
    const resp = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: {
        query:             `${query_str} in ${location}`,
        page:              page.toString(),
        num_pages:         '1',
        date_posted:       'week',
        country:           'bd',
        language:          'en',
      },
      headers: {
        'X-RapidAPI-Key':  JSEARCH_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      timeout: 15000,
    });

    const jobs = (resp.data?.data || []).map((j) => normalizeJob({
      title:            j.job_title,
      company:          j.employer_name,
      company_domain:   j.employer_website?.replace(/^https?:\/\//, '').split('/')[0] || null,
      company_logo_url: j.employer_logo || null,
      location:         j.job_city || j.job_country || location,
      job_url:          j.job_apply_link || j.job_google_link,
      description:      j.job_description,
      posted_date:      j.job_posted_at_datetime_utc || new Date().toISOString(),
      sources:          [j.job_publisher?.toLowerCase().includes('linkedin') ? 'LinkedIn' :
                         j.job_publisher?.toLowerCase().includes('indeed')   ? 'Indeed'  : 'JSearch'],
      is_remote:        j.job_is_remote || false,
      experience_level: j.job_required_experience?.required_experience_in_months > 60 ? 'senior' :
                        j.job_required_experience?.required_experience_in_months > 24 ? 'mid' : 'entry',
      salary_min_bdt:   j.job_min_salary ? Math.round(j.job_min_salary * 110) : null,
      salary_max_bdt:   j.job_max_salary ? Math.round(j.job_max_salary * 110) : null,
    }));

    await setCache(cacheKey, JSON.stringify(jobs), CACHE_TTL);
    logger.info('JSearch scraped', { query: query_str, count: jobs.length });
    return jobs;
  } catch (err) {
    logger.error('JSearch scrape failed', { error: err.message, query: query_str });
    return [];
  }
};

// ── Source 3: Bdjobs.com ─────────────────────────────────────────
export const scrapeBdjobs = async (keyword = 'software', page = 1) => {
  const cacheKey = `bdjobs:${keyword}:${page}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  try {
    await sleep(REQ_DELAY_MS());
    const url  = `https://jobs.bdjobs.com/jobsearch.asp?txtsearch=${encodeURIComponent(keyword)}&pg=${page}`;
    const resp = await axios.get(url, {
      headers: { 'User-Agent': randAgent(), 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 20000,
    });
    const $    = cheerio.load(resp.data);
    const jobs = [];

    // Bdjobs job listing structure (updated selector for current site)
    $('div.job-list-single-item, div.normal-job, .joblist-container .job-container').each((_, el) => {
      const title   = $(el).find('.job-title-text, h4.title, .position-title').text().trim();
      const company = $(el).find('.comp-name, .company-name, .org-name').text().trim();
      const loc     = $(el).find('.job-location, .location').text().trim() || 'Bangladesh';
      const salary  = $(el).find('.salary-range, .salary').text().trim();
      const link    = $(el).find('a[href*="jobdetails"]').attr('href') ||
                      $(el).find('a').attr('href') || '';
      const fullUrl = link.startsWith('http') ? link : `https://jobs.bdjobs.com/${link}`;
      const sal     = parseBDTSalary(salary);
      if (title && company) {
        jobs.push(normalizeJob({
          title, company, location: loc,
          job_url:       fullUrl,
          sources:       ['Bdjobs'],
          salary_min_bdt: sal.min,
          salary_max_bdt: sal.max,
          company_logo_url: null,
        }));
      }
    });

    await setCache(cacheKey, JSON.stringify(jobs), CACHE_TTL);
    logger.info('Bdjobs scraped', { keyword, count: jobs.length, page });
    return jobs;
  } catch (err) {
    logger.error('Bdjobs scrape failed', { error: err.message, keyword });
    return [];
  }
};

// ── Source 4: Rozee.pk ────────────────────────────────────────────
export const scrapeRozee = async (keyword = 'software engineer', page = 1) => {
  const cacheKey = `rozee:${keyword}:${page}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  try {
    await sleep(REQ_DELAY_MS());
    const url  = `https://www.rozee.pk/job/jsearch/q/${encodeURIComponent(keyword)}/fpn/${page}`;
    const resp = await axios.get(url, {
      headers: {
        'User-Agent':      randAgent(),
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 20000,
    });
    const $    = cheerio.load(resp.data);
    const jobs = [];

    $('div.job, .job-listing, article.job-item').each((_, el) => {
      const title   = $(el).find('.job-title, h2, h3').first().text().trim();
      const company = $(el).find('.company-name, .emp-name').text().trim();
      const loc     = $(el).find('.location, .city').text().trim() || 'Pakistan';
      const link    = $(el).find('a').attr('href') || '';
      const fullUrl = link.startsWith('http') ? link : `https://www.rozee.pk${link}`;
      if (title && company) {
        jobs.push(normalizeJob({
          title, company, location: loc,
          job_url: fullUrl,
          sources: ['Rozee'],
        }));
      }
    });

    await setCache(cacheKey, JSON.stringify(jobs), CACHE_TTL);
    logger.info('Rozee scraped', { keyword, count: jobs.length, page });
    return jobs;
  } catch (err) {
    logger.error('Rozee scrape failed', { error: err.message, keyword });
    return [];
  }
};

// ── Run all scrapers for a set of role keywords ───────────────────
export const scrapeAllSources = async (roleKeywords = ['software engineer', 'QA engineer', 'frontend developer', 'backend developer', 'data analyst']) => {
  const results = [];

  for (const kw of roleKeywords) {
    const [jsearchJobs, bdjobsJobs, rozeeJobs] = await Promise.allSettled([
      scrapeJSearch(kw, 'Bangladesh'),
      scrapeBdjobs(kw),
      scrapeRozee(kw),
    ]);

    if (jsearchJobs.status === 'fulfilled') results.push(...jsearchJobs.value);
    if (bdjobsJobs.status  === 'fulfilled') results.push(...bdjobsJobs.value);
    if (rozeeJobs.status   === 'fulfilled') results.push(...rozeeJobs.value);

    await sleep(REQ_DELAY_MS()); // polite delay between keywords
  }

  return results;
};
