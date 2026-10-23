// ════════════════════════════════════════════════════════════════
// Deduplication Service
// Match: company_name + job_title + location (fuzzy)
// Duplicate → merge sources[], keep best data
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { classifyOccupation } from './taxonomyService.js';
import logger from './loggerService.js';

// Simple fuzzy: normalize and check substring overlap
const norm = (s) => (s || '').toLowerCase()
  .replace(/[^a-z0-9\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const isFuzzyMatch = (a, b) => {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // One contains the other (handles "Software Engineer" vs "Software Engineer - Dhaka")
  if (na.includes(nb) || nb.includes(na)) return true;
  // Word overlap ≥ 80%
  const wa = new Set(na.split(' '));
  const wb = new Set(nb.split(' '));
  const inter = [...wa].filter((w) => wb.has(w) && w.length > 2).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 && inter / union >= 0.8;
};

// ── Dedup a batch in-memory (before DB insert) ────────────────────
export const deduplicateInMemory = (jobs) => {
  const deduped = [];
  for (const job of jobs) {
    const existing = deduped.find(
      (d) =>
        isFuzzyMatch(d.title,   job.title)   &&
        isFuzzyMatch(d.company, job.company) &&
        isFuzzyMatch(d.location, job.location)
    );
    if (existing) {
      // Merge sources
      existing.sources = [...new Set([...existing.sources, ...job.sources])];
      // Keep best salary data
      if (!existing.salary_min_bdt && job.salary_min_bdt) existing.salary_min_bdt = job.salary_min_bdt;
      if (!existing.salary_max_bdt && job.salary_max_bdt) existing.salary_max_bdt = job.salary_max_bdt;
      // Keep best logo
      if (!existing.company_logo_url && job.company_logo_url) existing.company_logo_url = job.company_logo_url;
      // Keep longer description
      if ((job.description?.length || 0) > (existing.description?.length || 0)) existing.description = job.description;
    } else {
      deduped.push({ ...job });
    }
  }
  logger.info('In-memory dedup', { before: jobs.length, after: deduped.length, removed: jobs.length - deduped.length });
  return deduped;
};

// ── Upsert jobs to DB (dedup against existing rows) ───────────────
export const upsertJobs = async (jobs) => {
  let inserted = 0, updated = 0;

  for (const job of jobs) {
    try {
      // Classified once here, so matching never has to work it out per user
      const occ = classifyOccupation(job.title);

      // Same posting URL is the same job; otherwise fall back to company + title + city
      let existing = job.job_url
        ? await query(`SELECT id, sources FROM jobs WHERE job_url = $1 LIMIT 1`, [job.job_url])
        : { rows: [] };
      if (existing.rows.length === 0) {
        existing = await query(
          `SELECT id, sources FROM jobs
           WHERE LOWER(company) = LOWER($1)
             AND LOWER(title)   = LOWER($2)
             AND LOWER(location) LIKE LOWER($3)
           LIMIT 1`,
          [job.company, job.title, `%${norm(job.location).split(' ')[0]}%`]
        );
      }

      if (existing.rows.length > 0) {
        // Merge sources and update
        const merged = [...new Set([...existing.rows[0].sources, ...job.sources])];
        await query(
          `UPDATE jobs SET
             sources          = $1,
             salary_min_bdt   = COALESCE($2, salary_min_bdt),
             salary_max_bdt   = COALESCE($3, salary_max_bdt),
             company_logo_url = COALESCE($4, company_logo_url),
             deadline         = COALESCE($5, deadline),
             description      = CASE WHEN LENGTH(COALESCE($7, '')) > LENGTH(COALESCE(description, ''))
                                     THEN $7 ELSE description END,
             occupation_key   = $8,
             occupation_name  = $9,
             is_expired       = FALSE,
             scraped_at       = NOW()
           WHERE id = $6`,
          [merged, job.salary_min_bdt, job.salary_max_bdt, job.company_logo_url, job.deadline, existing.rows[0].id, job.description,
           occ?.key || null, occ?.name || null]
        );
        updated++;
      } else {
        // Insert new job
        await query(
          `INSERT INTO jobs (
             title, company, company_logo_url, company_domain, location,
             job_url, description, posted_date, deadline, scraped_at, sources,
             is_remote, experience_level, salary_min_bdt, salary_max_bdt, is_expired,
             occupation_key, occupation_name
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11,$12,$13,$14,FALSE,$15,$16)
           ON CONFLICT DO NOTHING`,
          [
            job.title, job.company, job.company_logo_url, job.company_domain,
            job.location, job.job_url, job.description,
            job.posted_date, job.deadline,
            job.sources, job.is_remote, job.experience_level,
            job.salary_min_bdt, job.salary_max_bdt,
            occ?.key || null, occ?.name || null,
          ]
        );
        inserted++;
      }
    } catch (err) {
      logger.error('Job upsert error', { error: err.message, job: job.title });
    }
  }

  logger.info('Jobs upserted', { inserted, updated, total: jobs.length });
return { inserted, updated };
};

// ── Mark expired jobs (run after each sync) ───────────────────────
// A job with a deadline lives until that deadline; one without a deadline
// expires if no scrape has seen it for 14 days.
export const markExpiredJobs = async () => {
  const result = await query(
    `UPDATE jobs SET is_expired = TRUE
     WHERE is_expired = FALSE
       AND (
         (deadline IS NOT NULL AND deadline < CURRENT_DATE)
         OR (deadline IS NULL AND scraped_at < NOW() - INTERVAL '14 days')
       )`
  );
  logger.info('Marked expired jobs', { count: result.rowCount });
  return result.rowCount;
};

// ── Expire jobs that disappeared from a full-list source ──────────
// Only valid for a source whose scrape returns its COMPLETE job list
// (BDTechJobs). Jobs that other sources also listed are left alone.
export const expireMissingJobs = async (source, scrapedJobUrls) => {
  if (!source || !scrapedJobUrls || scrapedJobUrls.length === 0) return 0;
  const result = await query(
    `UPDATE jobs SET is_expired = TRUE
     WHERE is_expired = FALSE
       AND sources = ARRAY[$1]::text[]
       AND job_url != ''
       AND job_url <> ALL($2::text[])`,
    [source, scrapedJobUrls]
  );
  logger.info('Expired missing jobs', { count: result.rowCount });
  return result.rowCount;
};

// ── (Re)classify stored jobs into occupations ─────────────────────
// all=false: only jobs never classified (new jobs from older code, or titles
// that a taxonomy update can now place). all=true: after a taxonomy change.
export const classifyStoredJobs = async ({ all = false } = {}) => {
  const rows = (await query(
    `SELECT id, title FROM jobs WHERE is_expired = FALSE ${all ? '' : 'AND occupation_key IS NULL'}`
  )).rows;
  let classified = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const params = [];
    const values = chunk.map((r) => {
      const occ = classifyOccupation(r.title);
      if (occ) classified++;
      params.push(r.id, occ?.key || null, occ?.name || null);
      const n = params.length;
      return `($${n - 2}::uuid, $${n - 1}::varchar, $${n}::varchar)`;
    });
    await query(
      `UPDATE jobs j SET occupation_key = v.key, occupation_name = v.name
       FROM (VALUES ${values.join(', ')}) AS v(id, key, name) WHERE j.id = v.id`,
      params
    );
  }
  logger.info('Jobs classified into occupations', { checked: rows.length, classified });
  return { checked: rows.length, classified };
};
