// ════════════════════════════════════════════════════════════════
// CareerPilot Scraper Service
// Source 1+2: JSearch API (LinkedIn + Indeed via RapidAPI — legal)
// Source 3:   Bdjobs.com (public JSON API used by bdjobs.com/h/jobs)
// Source 4:   LinkedIn post parser (feed post → structured job)
// Rozee.pk removed — Pakistan jobs not relevant for BD users
// ════════════════════════════════════════════════════════════════
import axios from 'axios';
import { scrapeBDTechJobs } from './bdTechJobsService.js';
import * as cheerio from 'cheerio';
import redis, { getCache, setCache } from '../models/redis.js';
import logger from './loggerService.js';

const JSEARCH_KEY  = process.env.JSEARCH_API_KEY;
const CACHE_TTL    = 12 * 60 * 60; // 12 hours
const REQ_DELAY_MS = () => 800 + Math.floor(Math.random() * 1200); // 0.8–2s random
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
  deadline:         raw.deadline || null,
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

// ── Source 1+2: JSearch (LinkedIn + Indeed via RapidAPI) ──────────
// The free RapidAPI tier is a small monthly quota, so calls are capped per
// day and spent on the most-wanted keywords. Aggregator pages ("QA Jobs in
// Sylhet") and listings without a real description are dropped.
const JSEARCH_DAILY_LIMIT = parseInt(process.env.JSEARCH_DAILY_LIMIT || '6');
const JSEARCH_JUNK_TITLE  = /\bjobs?\s+(in|at|near)\b|\bvacanc(y|ies)\b|\bjobs?\s*$|\d+\s+jobs?\b|^jobs?\b/i;

const takeJSearchQuota = async () => {
  const key  = `jsearch:calls:${new Date().toISOString().slice(0, 10)}`;
  const used = parseInt(await redis.incr(key));
  if (used === 1) await redis.expire(key, 26 * 60 * 60);
  return used <= JSEARCH_DAILY_LIMIT;
};

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

  if (!(await takeJSearchQuota())) {
    logger.info('JSearch: daily quota used — skipping', { query: query_str, limit: JSEARCH_DAILY_LIMIT });
    return [];
  }

  try {
    await sleep(REQ_DELAY_MS());
    const resp = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: {
        query:       `${query_str} in ${location}`,
        page:        page.toString(),
        num_pages:   '1',
        date_posted: 'month',
        country:     'bd',
        language:    'en',
      },
      headers: {
        'X-RapidAPI-Key':  JSEARCH_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      timeout: 15000,
    });

    const usable = (resp.data?.data || []).filter((j) =>
      j.job_title && j.employer_name &&
      !JSEARCH_JUNK_TITLE.test(j.job_title) &&
      (j.job_description || '').length >= 200
    );

    const jobs = usable.map((j) => {
      // Only trust salaries already in BDT — converting USD/hourly figures gave nonsense
      const inBDT = (j.job_salary_currency || '').toUpperCase() === 'BDT';
      return normalizeJob({
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
        salary_min_bdt:   inBDT && j.job_min_salary ? Math.round(j.job_min_salary) : null,
        salary_max_bdt:   inBDT && j.job_max_salary ? Math.round(j.job_max_salary) : null,
      });
    });

    await setCache(cacheKey, JSON.stringify(jobs), CACHE_TTL);
    logger.info('JSearch scraped', { query: query_str, count: jobs.length, dropped: (resp.data?.data?.length || 0) - jobs.length });
    return jobs;
  } catch (err) {
    logger.error('JSearch scrape failed', { error: err.message, query: query_str });
    return [];
  }
};

// ── Source 3: Bdjobs.com ─────────────────────────────────────────
// The old jobsearch.asp page is gone (404). bdjobs.com/h/jobs now loads its
// listings from a JSON API; the listing has no real description, so each job's
// details are fetched once and cached by job id.
const BDJOBS_SEARCH_URL  = 'https://api.bdjobs.com/Jobs/api/JobSearch/GetJobSearch';
const BDJOBS_DETAILS_URL = 'https://gateway.bdjobs.com/ActtivejobsTest/api/JobSubsystem/jobDetails';
const BDJOBS_PAGES       = 2;   // 30 jobs per page, newest first
const BDJOBS_DETAIL_TTL  = 7 * 24 * 60 * 60;
const BDJOBS_DETAIL_CONCURRENCY = 3;

const stripHtml = (html) => (html || '')
  .replace(/<\/(p|li|ul|div|br)>|<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n\s*\n+/g, '\n')
  .trim();

const bdjobsExperienceLevel = (text) => {
  const years = parseInt((text || '').match(/(\d+)\s*(?:to\s*\d+\s*)?year/i)?.[1] || '0');
  if (!years) return 'entry';
  return years >= 6 ? 'senior' : years >= 3 ? 'mid' : 'entry';
};

const fetchBdjobsDetails = async (jobId) => {
  const cacheKey = `bdjobs:detail:${jobId}`;
  const cached   = await getCache(cacheKey);
  if (cached) return cached;
  const resp = await axios.get(BDJOBS_DETAILS_URL, {
    params:  { jobId },
    headers: { 'User-Agent': randAgent(), 'Accept': 'application/json' },
    timeout: 20000,
  });
  const detail = resp.data?.data?.[0] || null;
  if (detail) await setCache(cacheKey, detail, BDJOBS_DETAIL_TTL);
  return detail;
};

const bdjobsToJob = (item, d) => {
  const minSal = parseInt(d?.JobSalaryMinSalary) || null;
  const maxSal = parseInt(d?.JobSalaryMaxSalary) || null;
  const skills = [d?.SkillsRequired, d?.SuggestedSkills].filter(Boolean).join(', ');
  const description = d ? [
    stripHtml(d.JobDescription),
    d.AdditionJobRequirements && `Requirements:\n${stripHtml(d.AdditionJobRequirements)}`,
    d.experience && `Experience:\n${stripHtml(d.experience)}`,
    d.EducationRequirements && `Education:\n${stripHtml(d.EducationRequirements)}`,
    skills && `Skills: ${skills}`,
    d.JobSalaryRangeText && `Salary: ${d.JobSalaryRangeText}`,
  ].filter(Boolean).join('\n\n') : stripHtml(item.jobDescription);

  return normalizeJob({
    title:            item.jobTitle,
    company:          item.companyName,
    company_domain:   d?.CompanyWeb?.replace(/^https?:\/\//, '').split('/')[0] || null,
    company_logo_url: item.logoUrl || d?.JobLOgoName || null,
    location:         item.location || d?.JobLocation || 'Bangladesh',
    job_url:          `https://bdjobs.com/h/details/${item.Jobid}`,
    description,
    posted_date:      item.publishDate || null,
    deadline:         (item.deadlineDB || d?.DeadlineDB || '').slice(0, 10) || null,
    sources:          ['Bdjobs'],
    is_remote:        /home|remote/i.test(d?.JobWorkPlace || item.WorkPlace || ''),
    experience_level: bdjobsExperienceLevel(item.experience || stripHtml(d?.experience)),
    salary_min_bdt:   minSal,
    salary_max_bdt:   maxSal && maxSal >= (minSal || 0) ? maxSal : null,
  });
};

export const scrapeBdjobs = async (keyword = 'software', pages = BDJOBS_PAGES) => {
  const cacheKey = `bdjobs:v2:${keyword}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  const jobs = [];
  try {
    for (let pg = 1; pg <= pages; pg++) {
      await sleep(REQ_DELAY_MS());
      const resp = await axios.get(BDJOBS_SEARCH_URL, {
        params:  { keyword, pg, rpp: 30, isPro: 0 },
        headers: { 'User-Agent': randAgent(), 'Accept': 'application/json', 'Origin': 'https://bdjobs.com' },
        timeout: 20000,
      });
      const items = resp.data?.data || [];

      const valid = items.filter((item) => item.Jobid && item.jobTitle && item.companyName);
      for (let i = 0; i < valid.length; i += BDJOBS_DETAIL_CONCURRENCY) {
        const batch = valid.slice(i, i + BDJOBS_DETAIL_CONCURRENCY);
        const details = await Promise.all(batch.map((item) =>
          fetchBdjobsDetails(item.Jobid).catch((err) => {
            logger.warn('Bdjobs detail fetch failed', { jobId: item.Jobid, error: err.message });
            return null;
          })
        ));
        batch.forEach((item, idx) => jobs.push(bdjobsToJob(item, details[idx])));
        await sleep(300); // polite pacing between detail batches
      }

      const totalPages = parseInt(resp.data?.common?.totalpages) || 1;
      if (pg >= totalPages || items.length === 0) break;
    }

    await setCache(cacheKey, JSON.stringify(jobs), CACHE_TTL);
    logger.info('Bdjobs scraped', { keyword, count: jobs.length });
    return jobs;
  } catch (err) {
    logger.error('Bdjobs scrape failed', { error: err.message, keyword });
    return jobs;
  }
};

// ── Source 4: LinkedIn Post Parser ───────────────────────────────
// LinkedIn feed posts (not LinkedIn Jobs listings) are unstructured text.
// This parser extracts structured job data from post body text using
// pattern matching + NLP heuristics. Covers posts like:
//   "ReliSource is seeking... Junior AI Automation QA Engineer"
//   "ADDIE Soft Ltd. is looking for... Intern – Quality Assurance"
// ──────────────────────────────────────────────────────────────────

// Known BD tech company LinkedIn page IDs / slugs to check
const BD_COMPANY_SLUGS = [
  'relisource', 'brac-it', 'brain-station-23', 'addie-soft',
  'technobd', 'shohoz', 'pathao', 'shajgoj', 'daraz-bangladesh',
  'chaldal', 'bkash', 'nagad', 'ssl-wireless', 'grameenphone',
  'robi-axiata', 'banglalink', 'beximco', 'square-group',
  'therap-bd', 'kaz-software', 'cefalo', 'enosis-solutions',
  'bjit-group', 'selise-digital-platforms', 'exabyting',
  'pridesys-it', 'wsd-technology', 'apsissolutions',
  'reve-systems', 'dcastalia', 'sourcetap', 'anchorblock',
];

// Patterns to extract job title from post text
const JOB_TITLE_PATTERNS = [
  // "looking for a Senior QA Engineer"
  /(?:looking\s+for\s+(?:a\s+)?|hiring\s+(?:a\s+)?|seeking\s+(?:a\s+)?)([A-Z][A-Za-z\s\/\-&]{3,60}?)(?:\s+to\s+join|\s+who\s+will|\s+at\s+|\.|,|\n)/i,
  // "position: Senior QA Engineer" or "role: QA Engineer"
  /(?:position|role|vacancy|opening|post)\s*[:\–\-]\s*([A-Z][A-Za-z\s\/\-&]{3,60}?)(?:\.|,|\n|$)/i,
  // "Junior AI Automation QA Engineer" as standalone capitalized phrase
  /^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,6})\s*$/m,
  // "join our team as a QA Lead"
  /(?:join(?:\s+our\s+team)?\s+as\s+(?:a\s+|an\s+)?)([A-Z][A-Za-z\s\/\-&]{3,60}?)(?:\s+at\s+|\.|,|\n|$)/i,
  // "We're hiring: [Title]"
  /(?:we(?:'re|\s+are)\s+hiring\s*[:\-]?\s*)([A-Z][A-Za-z\s\/\-&]{3,60}?)(?:\.|,|\n|$)/i,
  // "Intern – Quality Assurance" or "Engineer - Backend"
  /\b((?:Senior|Junior|Lead|Principal|Staff|Mid[\-\s]?Level|Intern|Associate|Entry[\-\s]?Level)\s+[A-Za-z\s\/\-&]{3,50}?)(?:\s*[\–\-]\s*[A-Za-z]|\.|,|\n|$)/i,
];

// Extract job title from post text — try all patterns, return best match
const extractJobTitle = (text) => {
  for (const pattern of JOB_TITLE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Filter out garbage matches (too short, too generic, all lowercase)
      if (candidate.length >= 4 && candidate.length <= 80 && /[A-Z]/.test(candidate)) {
        // Clean up trailing noise
        return candidate.replace(/\s+(to|who|at|and|the|a|an)\s*$/i, '').trim();
      }
    }
  }
  return null;
};

// Extract application URL from post text
const extractApplyUrl = (text) => {
  // LinkedIn shortened URLs
  const lnkd = text.match(/https?:\/\/lnkd\.in\/[A-Za-z0-9_\-]+/);
  if (lnkd) return lnkd[0];
  // Direct URLs
  const direct = text.match(/https?:\/\/[^\s\)\"\']+/);
  if (direct) return direct[0];
  // Email apply — return mailto
  const email = text.match(/(?:apply\s+(?:to|at|via)\s+|send\s+(?:cv|resume)\s+to\s+)([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (email) return `mailto:${email[1]}`;
  return null;
};

// Extract deadline from post text
const extractDeadline = (text) => {
  const match = text.match(/(?:deadline|apply\s+by|last\s+date)\s*[:\-]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  return match ? match[1] : null;
};

// Detect experience level from post text
const detectExperienceLevel = (text) => {
  const t = text.toLowerCase();
  if (/fresh\s*grad|entry[\s\-]?level|0[\s\-]?year|intern/.test(t)) return 'entry';
  if (/senior|lead|principal|staff|head\s+of|5\+\s*year|6\+\s*year|7\+\s*year/.test(t)) return 'senior';
  return 'mid';
};

// Detect if remote from post text
const detectRemote = (text) => /\b(remote|work\s+from\s+home|wfh|hybrid)\b/i.test(text);

// Extract location from post text
const extractLocation = (text) => {
  const match = text.match(/(?:location|based\s+in|office\s+in|onsite\s+at|dhaka|chittagong|sylhet|rajshahi|khulna|barishal|comilla)\b[:\s]*([A-Za-z\s,]+?)(?:\.|,|\n|$)/i);
  if (match) {
    const loc = match[1]?.trim();
    if (loc && loc.length < 50) return loc;
  }
  // Bangladesh city detection
  const cities = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal', 'Comilla', 'Gazipur'];
  for (const city of cities) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(text)) return city + ', Bangladesh';
  }
  return 'Bangladesh';
};

// ── Parse a single LinkedIn post text into a structured job ──────
export const parseLinkedInPost = (postText, companyName, postUrl = '') => {
  if (!postText || postText.length < 50) return null;

  const title = extractJobTitle(postText);
  if (!title) return null;

  // Sanity check — title should look like a real job title
  const titleLower = title.toLowerCase();
  const JOB_WORDS  = ['engineer', 'developer', 'analyst', 'manager', 'designer', 'executive',
                       'officer', 'associate', 'specialist', 'consultant', 'intern', 'lead',
                       'architect', 'scientist', 'coordinator', 'administrator', 'qa', 'sde', 'sdet'];
  if (!JOB_WORDS.some((w) => titleLower.includes(w))) return null;

  const applyUrl = extractApplyUrl(postText) || postUrl;
  const salary   = parseBDTSalary(postText);

  return normalizeJob({
    title,
    company:          companyName || 'Unknown Company',
    location:         detectRemote(postText) ? 'Remote' : extractLocation(postText),
    job_url:          applyUrl,
    description:      postText.slice(0, 8000),
    posted_date:      new Date().toISOString(),
    sources:          ['LinkedIn'],
    is_remote:        detectRemote(postText),
    experience_level: detectExperienceLevel(postText),
    salary_min_bdt:   salary.min,
    salary_max_bdt:   salary.max,
  });
};

// ── Scrape LinkedIn company posts for job announcements ──────────
// Uses the public LinkedIn company feed (no auth required for public pages)
export const scrapeLinkedInPosts = async (keyword = 'QA engineer') => {
  const cacheKey = `linkedin_posts:${keyword}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  const jobs = [];

  // Map keyword to relevant company slugs to check
  // We check a focused subset based on keyword to avoid scraping all companies every time
  const keywordLower = keyword.toLowerCase();
  const KEYWORD_COMPANY_MAP = {
    'qa':          ['relisource', 'brain-station-23', 'addie-soft', 'bjit-group', 'kaz-software', 'cefalo', 'enosis-solutions', 'therap-bd'],
    'software':    ['relisource', 'brain-station-23', 'bjit-group', 'kaz-software', 'cefalo', 'enosis-solutions', 'therap-bd', 'wsd-technology'],
    'frontend':    ['shohoz', 'pathao', 'chaldal', 'shajgoj', 'brain-station-23', 'selise-digital-platforms'],
    'backend':     ['relisource', 'bjit-group', 'brain-station-23', 'reve-systems', 'sourcetap'],
    'devops':      ['grameenphone', 'robi-axiata', 'bkash', 'brain-station-23', 'selise-digital-platforms'],
    'data':        ['grameenphone', 'robi-axiata', 'bkash', 'daraz-bangladesh', 'shohoz'],
    'marketing':   ['shajgoj', 'daraz-bangladesh', 'chaldal', 'bkash', 'shohoz'],
    'designer':    ['shajgoj', 'brain-station-23', 'selise-digital-platforms', 'daraz-bangladesh'],
    'hr':          ['beximco', 'square-group', 'grameenphone', 'robi-axiata', 'banglalink'],
    'accountant':  ['beximco', 'square-group', 'bkash', 'pridesys-it'],
  };

  let slugsToCheck = BD_COMPANY_SLUGS.slice(0, 8); // default: check top 8
  for (const [kw, slugs] of Object.entries(KEYWORD_COMPANY_MAP)) {
    if (keywordLower.includes(kw)) {
      slugsToCheck = slugs;
      break;
    }
  }

  for (const slug of slugsToCheck) {
    try {
      await sleep(REQ_DELAY_MS());
      const url  = `https://www.linkedin.com/company/${slug}/posts/?feedView=all`;
      const resp = await axios.get(url, {
        headers: {
          'User-Agent':      randAgent(),
          'Accept':          'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 20000,
      });

      const $           = cheerio.load(resp.data);
      const companyName = $('h1.org-top-card-summary__title, .top-card-layout__title').first().text().trim()
                        || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      // LinkedIn renders posts in various containers
      const postSelectors = [
        '.feed-shared-update-v2__description',
        '.update-components-text',
        '[data-urn*="activity"] .break-words',
        '.feed-shared-text',
        'article .body',
      ];

      for (const sel of postSelectors) {
        $(sel).each((_, el) => {
          const text = $(el).text().trim();
          if (!text || text.length < 60) return;

          // Only process posts that look like job announcements
          const isJobPost = /(?:hiring|we're\s+looking|join\s+our|apply\s+now|open\s+position|vacancy|career\s+opportunity|send\s+(?:your\s+)?(?:cv|resume))/i.test(text);
          if (!isJobPost) return;

          const job = parseLinkedInPost(text, companyName, url);
          if (job && job.title) {
            logger.info('LinkedIn post parsed', { company: companyName, title: job.title });
            jobs.push(job);
          }
        });
        if (jobs.length >= 5) break; // max 5 jobs per company page
      }
    } catch (err) {
      // Individual company failure is non-fatal — log and continue
      logger.warn('LinkedIn post scrape failed for company', { slug, error: err.message });
    }
  }

  if (jobs.length > 0) {
    await setCache(cacheKey, JSON.stringify(jobs), CACHE_TTL);
  }
  logger.info('LinkedIn posts scraped', { keyword, count: jobs.length });
  return jobs;
};

// ── Run all scrapers for a set of role keywords ───────────────────
// Bdjobs is searched for every keyword (it covers all industries).
// JSearch only gets the first few keywords because of its quota.
export const scrapeAllSources = async (roleKeywords = [
  'QA engineer', 'software engineer', 'frontend developer',
  'backend developer', 'data analyst',
]) => {
  const results = [];

  for (const kw of roleKeywords) {
    const [jsearchJobs, bdjobsJobs] = await Promise.allSettled([
      scrapeJSearch(kw, 'Bangladesh'),
      scrapeBdjobs(kw),
    ]);

    if (jsearchJobs.status === 'fulfilled') results.push(...jsearchJobs.value);
    if (bdjobsJobs.status  === 'fulfilled') results.push(...bdjobsJobs.value);

    await sleep(REQ_DELAY_MS()); // polite delay between keywords
  }

  logger.info('scrapeAllSources complete', { total: results.length, keywords: roleKeywords.length });
  return results;
};
