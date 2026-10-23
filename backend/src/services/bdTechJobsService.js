// ════════════════════════════════════════════════════════════════
// BD Tech Jobs Service — Source 5
// API: https://www.bdtechjobs.com/api/jobs
// Clean JSON, BD tech companies only, salary in BDT
// ════════════════════════════════════════════════════════════════
import axios from 'axios';
import { getCache, setCache } from '../models/redis.js';
import logger from './loggerService.js';

const BASE_URL  = 'https://www.bdtechjobs.com/api/jobs';
const CACHE_TTL = 60 * 60; // 1 hour
const sleep     = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://www.bdtechjobs.com/',
};

const parseSalary = (salaryStr) => {
  if (!salaryStr || salaryStr === 'Not specified' || salaryStr === 'Negotiable') {
    return { min: null, max: null };
  }
  // Handle USD — convert to BDT approx
  if (salaryStr.toLowerCase().includes('usd')) {
    const match = salaryStr.match(/(\d+)/);
    if (match) return { min: Math.round(parseInt(match[1]) * 110), max: null };
    return { min: null, max: null };
  }
  const norm  = salaryStr.toLowerCase().replace(/,/g, '').replace('bdt', '').trim();
  const range = norm.match(/(\d+(?:\.\d+)?)\s*k?\s*[-–]+\s*(\d+(?:\.\d+)?)\s*k?/);
  if (range) {
    let min = parseFloat(range[1]);
    let max = parseFloat(range[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return { min: Math.round(min), max: Math.round(max) };
  }
  const single = norm.match(/(\d+(?:\.\d+)?)\s*k?\+?/);
  if (single) {
    let val = parseFloat(single[1]);
    if (val < 1000) val *= 1000;
    return { min: Math.round(val), max: null };
  }
  return { min: null, max: null };
};

const parseExpLevel = (exp) => {
  if (!exp || exp === 'Not required') return 'entry';
  const s = exp.toLowerCase();
  if (/^0|fresh|intern|entry/.test(s)) return 'entry';
  if (/^[1-2]\s*year|junior/.test(s))  return 'entry';
  if (/^[3-5]\s*year|mid|^2\+/.test(s)) return 'mid';
  if (/^[6-9]\s*year|senior|lead|8\+|6\+/.test(s)) return 'senior';
  return 'mid';
};

const normalizeJob = (item) => {
  const salary = parseSalary(item.salary);
  return {
    title:            (item.designation || '').trim(),
    company:          (item.companyName || '').trim(),
    company_domain:   null,
    company_logo_url: null,
    location:         (item.location || 'Bangladesh').trim(),
    job_url:          item.applyLink || '',
    description:      [
      item.designation,
      item.jobCategory?.join(', '),
      'Required Skills: ' + (item.requiredSkills || []).join(', '),
      'Experience: '      + (item.experienceYears || ''),
      'Work Type: '       + (item.workType || ''),
      'Deadline: '        + (item.applicationDeadline || ''),
    ].filter(Boolean).join('\n'),
    posted_date:      (() => {
      if (!item.postedDate || item.postedDate === 'Not available') return null;
      const d = new Date(item.postedDate);
      return isNaN(d.getTime()) ? null : d.toISOString();
    })(),
    deadline:         (() => {
      const dl = item.applicationDeadline;
      if (!dl || dl === 'Not specified' || dl === 'Not available') return null;
      const d = new Date(dl);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    })(),
    sources:          ['BDTechJobs'],
    is_remote:        (item.jobType || '').toLowerCase() === 'remote',
    experience_level: parseExpLevel(item.experienceYears || item.experience),
    salary_min_bdt:   salary.min,
    salary_max_bdt:   salary.max,
  };
};

const fetchPage = async (page = 1, limit = 50) => {
  const resp = await axios.get(BASE_URL, {
    params:  { page, limit },
    headers: HEADERS,
    timeout: 30000,
  });
  return resp.data;
};

export const scrapeBDTechJobs = async () => {
  const cacheKey = 'bdtechjobs:all';
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      logger.info('BDTechJobs: cache hit', { count: cached.length });
      return cached;
    }
  } catch { /* cache miss */ }

  try {
    const all   = [];
    const first = await fetchPage(1, 50);
    const total = first.total || 0;
    const pages = Math.ceil(total / 50);

    all.push(...(first.jobs || []).map(normalizeJob));
    logger.info('BDTechJobs page 1 fetched', { count: first.jobs?.length, total, pages });

    for (let p = 2; p <= Math.min(pages, 10); p++) {
      await sleep(500);
      const data = await fetchPage(p, 50);
      all.push(...(data.jobs || []).map(normalizeJob));
      logger.info(`BDTechJobs page ${p} fetched`, { count: data.jobs?.length });
    }

    await setCache(cacheKey, all, CACHE_TTL);
    logger.info('BDTechJobs scrape complete', { total: all.length });
    return all;
  } catch (err) {
    logger.error('BDTechJobs scrape failed', { error: err.message });
    return [];
  }
};
