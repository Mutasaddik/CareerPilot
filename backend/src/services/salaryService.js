// ════════════════════════════════════════════════════════════════
// Job salary — one rule, applied everywhere a job is shown.
// Only real numbers; when there are none, the salary stays blank.
//   1. the job post's own salary, if it lists one
//   2. salaries other employers actually posted for the same role
//      (and experience level when there are enough), from our job ads
//   3. imported benchmarks (Betonkemon) for the role
//   4. otherwise null — the UI leaves the salary blank, never guesses
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { getCuratedPack, classifyOccupation, occupationFromKey } from './taxonomyService.js';
import logger from './loggerService.js';

const RELOAD_MS        = 10 * 60 * 1000; // pick up new syncs/imports without a restart
const SIMILAR_ADS_DAYS = 180;            // ads older than this are too stale for pay
const MIN_SIMILAR_ADS  = 5;              // fewer real ads than this → no estimate

// ── Role check ────────────────────────────────────────────────────
// A title alone isn't proof of the role: "QC / QA Chemist" is not a
// software QA job. When an ad has enough text, it must use the role's own
// vocabulary — for the job being priced and for every ad we learn from.
const DOMAIN_CHECK_MIN_CHARS = 400;
const MIN_DOMAIN_HITS        = 2;
const norm     = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasTerm  = (text, term) => new RegExp(`(^|[^a-z0-9])${escapeRe(norm(term))}($|[^a-z0-9])`).test(text);

const isInRole = (pack, description) => {
  const text = norm(description);
  if (text.length < DOMAIN_CHECK_MIN_CHARS) return true; // too short to judge
  const terms = [...(pack.keywords || []), ...(pack.tools || [])];
  let hits = 0;
  for (const t of terms) if (hasTerm(text, t) && ++hits >= MIN_DOMAIN_HITS) return true;
  return false;
};

// Occupation key of a job ("cp:qa engineer", "onet:27-1022.00"), or null if
// its title/ad don't clearly say. Curated tracks also need the ad to use the
// track's vocabulary (their short titles like "QA" are ambiguous).
export const roleOf = (job) => {
  const occ = job.occupation_key ? occupationFromKey(job.occupation_key) : classifyOccupation(job.title || '');
  if (!occ) return null;
  if (occ.curated) {
    const pack = getCuratedPack(occ.curated, { strict: true });
    return pack && isInRole(pack, job.description) ? occ.key : null;
  }
  return occ.key;
};

// ── Reference data (reloaded every few minutes) ───────────────────
// Map<role_family, rows[]> where row = { level, min, max, source? }
let similarAds = new Map();
let benchmarks = new Map();
let loadedAt   = 0;

const groupByFamily = (rows) => {
  const map = new Map();
  for (const row of rows) {
    if (!row.family) continue;
    if (!map.has(row.family)) map.set(row.family, []);
    map.get(row.family).push(row);
  }
  return map;
};

const loadReferenceData = async () => {
  if (Date.now() - loadedAt < RELOAD_MS) return;
  try {
    const [ads, imported] = await Promise.all([
      query(
        `SELECT title, description, experience_level, salary_min_bdt, salary_max_bdt, occupation_key
         FROM jobs
         WHERE salary_min_bdt > 0 AND scraped_at > NOW() - make_interval(days => $1)`,
        [SIMILAR_ADS_DAYS]
      ),
      query(`SELECT source, role_family, experience_level, salary_min_bdt, salary_max_bdt FROM salary_benchmarks`),
    ]);
    similarAds = groupByFamily(ads.rows.map((r) => ({
      family: roleOf(r), level: r.experience_level, min: r.salary_min_bdt, max: r.salary_max_bdt,
    })));
    benchmarks = groupByFamily(imported.rows.map((r) => ({
      family: r.role_family, level: r.experience_level, min: r.salary_min_bdt, max: r.salary_max_bdt, source: r.source,
    })));
  } catch (err) {
    logger.warn('Salary reference data load failed', { error: err.message });
  }
  loadedAt = Date.now();
};

export const clearSalaryReferenceCache = () => { loadedAt = 0; };

// ── Summaries ─────────────────────────────────────────────────────
const percentile = (sorted, p) => {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};
const round500 = (n) => Math.round(n / 500) * 500;

// Typical range: middle 50% of the reported pay, so one unusually low or
// high ad doesn't stretch it. With very few rows (imported benchmarks can
// be single reports) show the full span of what was reported.
const summarize = (rows) => {
  if (rows.length >= 4) {
    const mids = rows.map((r) => (r.max ? (r.min + r.max) / 2 : r.min)).sort((a, b) => a - b);
    const min = round500(percentile(mids, 0.25));
    const max = round500(percentile(mids, 0.75));
    return { min, max: max > min ? max : null };
  }
  const min = Math.min(...rows.map((r) => r.min));
  const max = Math.max(...rows.map((r) => r.max || r.min));
  return { min: round500(min), max: max > min ? round500(max) : null };
};

// Same level when that has enough rows, else the role at any level
const estimateFrom = (map, family, level, minRows) => {
  const rows = map.get(family) || [];
  const sameLevel = rows.filter((r) => r.level === level);
  const used = sameLevel.length >= minRows ? sameLevel : rows;
  if (used.length < minRows) return null;
  return {
    ...summarize(used),
    role_family: occupationFromKey(family)?.name || family,   // readable name for the UI
    level:       used === sameLevel ? level : null, // null = role at any level
    sample_size: used.length,
    source:      used[0].source,
  };
};

const resolve = (job) => {
  if (job.salary_min_bdt > 0) {
    return { min: job.salary_min_bdt, max: job.salary_max_bdt || null, source: 'job_post' };
  }
  const family = roleOf(job);
  if (!family) return null;

  const similar = estimateFrom(similarAds, family, job.experience_level, MIN_SIMILAR_ADS);
  if (similar) return { ...similar, source: 'similar_ads' };

  return estimateFrom(benchmarks, family, job.experience_level, 1); // source e.g. 'betonkemon'
};

// Typical pay for a role (and level when there are enough ads), from real
// job ads only. Null when there aren't enough ads to say.
export const estimateForRole = async (family, level) => {
  await loadReferenceData();
  return estimateFrom(similarAds, family, level, MIN_SIMILAR_ADS);
};

// Adds `salary` ({ min, max, source, … } or null) to each job
export const attachSalaries = async (jobs) => {
  await loadReferenceData();
  for (const job of jobs) job.salary = resolve(job);
  return jobs;
};
