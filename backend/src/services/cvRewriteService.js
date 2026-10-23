// ════════════════════════════════════════════════════════════════
// CV Rewrite — turns the user's CV into a stronger, structured CV.
// General rewrite: improve the whole CV for the user's target role.
// Tailored rewrite: adapt it to one job ad, without inventing anything.
// Output is structured JSON so the frontend can edit it and print a PDF.
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { generateGeminiJSON } from './aiService.js';
import logger from './loggerService.js';

const str  = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strs = (v, maxItems = 40, max = 400) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean).slice(0, maxItems);

// Coerce whatever the model (or the editor) sends into the one CV shape we store
export const normalizeCVContent = (c = {}) => ({
  name:     str(c.name, 120),
  headline: str(c.headline, 160),
  contact: {
    email:    str(c.contact?.email, 120),
    phone:    str(c.contact?.phone, 60),
    location: str(c.contact?.location, 120),
    links:    strs(c.contact?.links, 5, 200),
  },
  summary: str(c.summary, 1500),
  skills:  strs(c.skills, 40, 60),
  experience: (Array.isArray(c.experience) ? c.experience : []).slice(0, 12).map((e) => ({
    title:    str(e?.title, 120),
    company:  str(e?.company, 120),
    location: str(e?.location, 120),
    dates:    str(e?.dates, 60),
    bullets:  strs(e?.bullets, 10, 400),
  })),
  projects: (Array.isArray(c.projects) ? c.projects : []).slice(0, 8).map((p) => ({
    name:    str(p?.name, 120),
    bullets: strs(p?.bullets, 6, 400),
  })),
  education: (Array.isArray(c.education) ? c.education : []).slice(0, 6).map((ed) => ({
    degree:      str(ed?.degree, 160),
    institution: str(ed?.institution, 160),
    dates:       str(ed?.dates, 60),
    details:     str(ed?.details, 300),
  })),
  certifications: strs(c.certifications, 15, 160),
  languages:      strs(c.languages, 10, 60),
});

const CV_SHAPE = `{
  "cv": {
    "name": "", "headline": "short professional title",
    "contact": { "email": "", "phone": "", "location": "", "links": ["linkedin/github/portfolio urls"] },
    "summary": "3-4 sentence professional summary",
    "skills": ["grouped, most relevant first"],
    "experience": [{ "title": "", "company": "", "location": "", "dates": "", "bullets": ["action + tool/scope + measurable result"] }],
    "projects": [{ "name": "", "bullets": [""] }],
    "education": [{ "degree": "", "institution": "", "dates": "", "details": "" }],
    "certifications": [""],
    "languages": [""]
  },
  "changes": ["max 6 short notes: what you improved and why"],
  "gaps": ["skills/requirements the target asks for that the CV does NOT show — never add these to the CV"]
}`;

const buildPrompt = ({ cvText, targetRole, job }) => `You are a senior recruiter and professional CV writer for the Bangladesh job market.
Rewrite the CV below into a stronger, ATS-friendly CV.

${job ? `TARGET JOB — tailor the CV to this job ad:
Title: ${job.title}
Company: ${job.company}
Job ad:
${(job.description || '').slice(0, 4000)}
` : `TARGET ROLE: ${targetRole || 'the role the CV already points to'}`}

STRICT RULES — the candidate will send this to employers:
- Never invent employers, job titles, dates, degrees, certifications, tools or numbers. Only use facts present in the CV.
- If a bullet has no number, strengthen it with scope and impact in words; do not make up metrics.
- Keep every real job, project and degree; you may reorder, merge or tighten them.
- Bullets: start with a strong action verb, show tool/method and outcome, max ~25 words.
- ${job ? 'Put the experience and skills most relevant to this job first and use the job ad\'s wording where the CV genuinely supports it.' : 'Emphasise what matters most for the target role.'}
- Requirements of the ${job ? 'job' : 'role'} that the CV does not support go in "gaps", not in the CV.
- Keep contact details exactly as in the CV (leave empty if missing).

Respond with ONLY valid JSON, no markdown fences, exactly this shape:
${CV_SHAPE}

CV TEXT:
${cvText.slice(0, 9000)}`;

// ── Create a rewrite (general when jobId is empty) ────────────────
export const createRewrite = async ({ userId, cvId, jobId = null }) => {
  const cvRes = cvId
    ? await query(`SELECT id, extracted_text, analysis_json FROM cvs WHERE id = $1 AND user_id = $2`, [cvId, userId])
    : await query(`SELECT id, extracted_text, analysis_json FROM cvs WHERE user_id = $1 AND is_primary = TRUE LIMIT 1`, [userId]);
  const cv = cvRes.rows[0];
  if (!cv) throw Object.assign(new Error('CV not found. Upload a CV first.'), { status: 404 });
  if (!cv.extracted_text) throw Object.assign(new Error('This CV has no readable text.'), { status: 400 });

  let job = null;
  if (jobId) {
    const jobRes = await query(`SELECT id, title, company, description FROM jobs WHERE id = $1`, [jobId]);
    job = jobRes.rows[0];
    if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
  }

  const profile = await query(`SELECT target_roles FROM user_profiles WHERE user_id = $1`, [userId]);
  const targetRole = profile.rows[0]?.target_roles?.[0] || cv.analysis_json?.detected?.target_role || '';

  const result  = await generateGeminiJSON(buildPrompt({ cvText: cv.extracted_text, targetRole, job }));
  const content = {
    cv:      normalizeCVContent(result?.cv),
    changes: strs(result?.changes, 6, 300),
    gaps:    strs(result?.gaps, 12, 200),
  };
  if (!content.cv.summary && content.cv.experience.length === 0) {
    throw new Error('The AI returned an empty CV. Please try again.');
  }

  const title = job ? `Tailored: ${job.title} — ${job.company}` : `Improved CV${targetRole ? ` — ${targetRole}` : ''}`;
  const saved = await query(
    `INSERT INTO cv_rewrites (user_id, cv_id, job_id, title, content_json)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, cv_id, job_id, title, content_json, created_at, updated_at`,
    [userId, cv.id, job?.id || null, title.slice(0, 255), JSON.stringify(content)]
  );
  logger.info('CV rewrite created', { userId, cvId: cv.id, jobId: job?.id || null });
  return saved.rows[0];
};

export const listRewrites = async (userId) => {
  const result = await query(
    `SELECT r.id, r.cv_id, r.job_id, r.title, r.created_at, r.updated_at,
            j.title AS job_title, j.company AS job_company
     FROM cv_rewrites r
     LEFT JOIN jobs j ON j.id = r.job_id
     WHERE r.user_id = $1
     ORDER BY r.updated_at DESC`,
    [userId]
  );
  return result.rows;
};

export const getRewrite = async (id, userId) => {
  const result = await query(
    `SELECT id, cv_id, job_id, title, content_json, created_at, updated_at
     FROM cv_rewrites WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
};

// Save the user's edits — only the CV part is editable
export const updateRewrite = async (id, userId, cvContent) => {
  const existing = await getRewrite(id, userId);
  if (!existing) return null;
  const content = { ...existing.content_json, cv: normalizeCVContent(cvContent) };
  const result = await query(
    `UPDATE cv_rewrites SET content_json = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, cv_id, job_id, title, content_json, created_at, updated_at`,
    [JSON.stringify(content), id, userId]
  );
  return result.rows[0];
};

export const deleteRewrite = async (id, userId) => {
  const result = await query(`DELETE FROM cv_rewrites WHERE id = $1 AND user_id = $2`, [id, userId]);
  return result.rowCount > 0;
};
