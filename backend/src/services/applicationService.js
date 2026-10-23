// ════════════════════════════════════════════════════════════════
// Application Tracker
// One row per job the user is pursuing. Rows copy the job's title,
// company and link, so they still read correctly after the listing
// expires — and so jobs found outside CareerPilot can be tracked too.
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import logger from './loggerService.js';

export const STATUSES = ['saved', 'applied', 'screening', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn'];

const SELECT_FIELDS = `
  a.id, a.job_id, a.status, a.notes, a.follow_up_date, a.applied_date,
  a.offer_salary_bdt, a.cv_version_used, a.history, a.created_at, a.updated_at,
  COALESCE(j.title,    a.job_title) AS job_title,
  COALESCE(j.company,  a.company)   AS company,
  COALESCE(j.job_url,  a.job_url)   AS job_url,
  COALESCE(j.location, a.location)  AS location,
  j.deadline, j.is_expired, j.salary_min_bdt, j.salary_max_bdt,
  jm.relevance_score`;

const FROM = `
  FROM applications a
  LEFT JOIN jobs j         ON j.id = a.job_id
  LEFT JOIN job_matches jm ON jm.job_id = a.job_id AND jm.user_id = a.user_id`;

const historyEntry = (status) => JSON.stringify([{ status, at: new Date().toISOString() }]);

export const listApplications = async (userId) => {
  const result = await query(
    `SELECT ${SELECT_FIELDS} ${FROM}
     WHERE a.user_id = $1
     ORDER BY a.updated_at DESC`,
    [userId]
  );
  return result.rows;
};

export const getApplication = async (id, userId) => {
  const result = await query(
    `SELECT ${SELECT_FIELDS} ${FROM} WHERE a.id = $1 AND a.user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
};

export const getApplicationForJob = async (jobId, userId) => {
  const result = await query(
    `SELECT id, status FROM applications WHERE job_id = $1 AND user_id = $2`,
    [jobId, userId]
  );
  return result.rows[0] || null;
};

// ── Track a job from the feed (idempotent: tracking it twice just updates status)
export const trackJob = async (userId, jobId, status = 'applied') => {
  const job = await query(`SELECT id, title, company, job_url, location FROM jobs WHERE id = $1`, [jobId]);
  if (!job.rows[0]) throw Object.assign(new Error('Job not found.'), { status: 404 });
  const j = job.rows[0];

  const result = await query(
    `INSERT INTO applications (user_id, job_id, status, job_title, company, job_url, location, applied_date, history)
     VALUES ($1, $2, $3::text, $4, $5, $6, $7, CASE WHEN $3::text = 'saved' THEN NULL ELSE CURRENT_DATE END, $8::jsonb)
     ON CONFLICT (user_id, job_id) WHERE job_id IS NOT NULL DO UPDATE SET
       status       = EXCLUDED.status,
       applied_date = COALESCE(applications.applied_date, EXCLUDED.applied_date),
       history      = CASE WHEN applications.status = EXCLUDED.status THEN applications.history
                           ELSE applications.history || EXCLUDED.history END
     RETURNING id`,
    [userId, jobId, status, j.title, j.company, j.job_url, j.location, historyEntry(status)]
  );
  logger.info('Job tracked', { userId, jobId, status });
  return getApplication(result.rows[0].id, userId);
};

// ── Track a job found somewhere else (LinkedIn DM, company site, referral…)
export const createManualApplication = async (userId, { jobTitle, company, jobUrl, location, status = 'applied', notes }) => {
  const result = await query(
    `INSERT INTO applications (user_id, status, job_title, company, job_url, location, notes, applied_date, history)
     VALUES ($1, $2::text, $3, $4, $5, $6, $7, CASE WHEN $2::text = 'saved' THEN NULL ELSE CURRENT_DATE END, $8::jsonb)
     RETURNING id`,
    [userId, status, jobTitle, company, jobUrl || null, location || null, notes || null, historyEntry(status)]
  );
  return getApplication(result.rows[0].id, userId);
};

// ── Update status / notes / dates ─────────────────────────────────
// Only fields present in `fields` change. A status change is appended to
// history, and the first move past 'saved' stamps applied_date.
export const updateApplication = async (id, userId, fields) => {
  const sets = [];
  const params = [];
  const add = (sql, value) => { params.push(value); sets.push(sql.replace('?', `$${params.length}`)); };

  if (fields.status !== undefined) {
    add('status = ?::text', fields.status);
    const s = `$${params.length}::text`;
    sets.push(`history = CASE WHEN status = ${s} THEN history
                              ELSE history || jsonb_build_array(jsonb_build_object('status', ${s}, 'at', NOW())) END`);
    sets.push(`applied_date = CASE WHEN applied_date IS NULL AND ${s} <> 'saved' THEN CURRENT_DATE ELSE applied_date END`);
  }
  if (fields.notes          !== undefined) add('notes = ?',            fields.notes || null);
  if (fields.followUpDate   !== undefined) add('follow_up_date = ?',   fields.followUpDate || null);
  if (fields.appliedDate    !== undefined) add('applied_date = ?',     fields.appliedDate || null);
  if (fields.offerSalaryBdt !== undefined) add('offer_salary_bdt = ?', fields.offerSalaryBdt || null);
  if (fields.cvVersionUsed  !== undefined) add('cv_version_used = ?',  fields.cvVersionUsed || null);
  // Title/company are editable only for manual entries (job-linked rows follow the job)
  if (fields.jobTitle !== undefined) add('job_title = ?', fields.jobTitle);
  if (fields.company  !== undefined) add('company = ?',   fields.company);
  if (fields.jobUrl   !== undefined) add('job_url = ?',   fields.jobUrl || null);
  if (fields.location !== undefined) add('location = ?',  fields.location || null);

  if (sets.length === 0) return getApplication(id, userId);

  params.push(id, userId);
  const result = await query(
    `UPDATE applications SET ${sets.join(', ')}
     WHERE id = $${params.length - 1} AND user_id = $${params.length}
     RETURNING id`,
    params
  );
  if (!result.rows[0]) return null;
  return getApplication(id, userId);
};

export const deleteApplication = async (id, userId) => {
  const result = await query(`DELETE FROM applications WHERE id = $1 AND user_id = $2`, [id, userId]);
  return result.rowCount > 0;
};

// ── Funnel numbers for the tracker header / dashboard ─────────────
// Uses history, so a job that reached interview and was later rejected
// still counts as a response and an interview.
const reached = (status) => `history @> '[{"status":"${status}"}]'`;

export const getApplicationStats = async (userId) => {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status <> 'saved')                                         AS applied,
       COUNT(*) FILTER (WHERE ${['screening', 'assessment', 'interview', 'offer'].map(reached).join(' OR ')}) AS responses,
       COUNT(*) FILTER (WHERE ${reached('interview')} OR ${reached('offer')})            AS interviews,
       COUNT(*) FILTER (WHERE status = 'offer')                                          AS offers,
       COUNT(*) FILTER (WHERE follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE
                          AND status NOT IN ('offer','rejected','withdrawn'))            AS follow_ups_due
     FROM applications WHERE user_id = $1`,
    [userId]
  );
  const r = result.rows[0];
  const n = (v) => parseInt(v) || 0;
  return {
    applied:        n(r.applied),
    responses:      n(r.responses),
    interviews:     n(r.interviews),
    offers:         n(r.offers),
    follow_ups_due: n(r.follow_ups_due),
    response_rate:  n(r.applied) ? Math.round((n(r.responses) / n(r.applied)) * 100) : 0,
  };
};
