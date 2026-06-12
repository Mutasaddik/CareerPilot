// ════════════════════════════════════════════════════════════════
// Deduplication Service
// Match: company_name + job_title + location (fuzzy)
// Duplicate → merge sources[], keep best data
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
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
      // Check if this job already exists in DB
      const existing = await query(
        `SELECT id, sources FROM jobs
         WHERE LOWER(company) = LOWER($1)
           AND LOWER(title)   = LOWER($2)
           AND LOWER(location) LIKE LOWER($3)
         LIMIT 1`,
        [job.company, job.title, `%${norm(job.location).split(' ')[0]}%`]
      );

      if (existing.rows.length > 0) {
        // Merge sources and update
        const merged = [...new Set([...existing.rows[0].sources, ...job.sources])];
        await query(
          `UPDATE jobs SET
             sources          = $1,
             salary_min_bdt   = COALESCE($2, salary_min_bdt),
             salary_max_bdt   = COALESCE($3, salary_max_bdt),
             company_logo_url = COALESCE($4, company_logo_url),
             scraped_at       = NOW()
           WHERE id = $5`,
          [merged, job.salary_min_bdt, job.salary_max_bdt, job.company_logo_url, existing.rows[0].id]
        );
        updated++;
      } else {
        // Insert new job
        await query(
          `INSERT INTO jobs (
             title, company, company_logo_url, company_domain, location,
             job_url, description, posted_date, scraped_at, sources,
             is_remote, experience_level, salary_min_bdt, salary_max_bdt, is_expired
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10,$11,$12,$13,FALSE)
           ON CONFLICT DO NOTHING`,
          [
            job.title, job.company, job.company_logo_url, job.company_domain,
            job.location, job.job_url, job.description,
            job.posted_date || new Date().toISOString(),
            job.sources, job.is_remote, job.experience_level,
            job.salary_min_bdt, job.salary_max_bdt,
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
