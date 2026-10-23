// ════════════════════════════════════════════════════════════════
// Job Matching Service
// Scores each job against user's CV + profile (0–100%)
// Role 40% · Skill 25% · Experience 15% · Industry 10% · Cert 5% · Progression 5%
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { getCache, setCache, deleteCachePattern } from '../models/redis.js';
import {
  extractSkillsFromText, getCuratedPack, cvSupportsRole,
  classifyOccupation, occupationFromKey, detectOccupationFromCV, getOccupationPack, socRelation,
} from './taxonomyService.js';
import { attachSalaries } from './salaryService.js';
import logger from './loggerService.js';

const norm       = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRe   = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasTerm    = (text, term) =>
  new RegExp(`(^|[^a-z0-9])${escapeRe(norm(term))}($|[^a-z0-9])`, 'i').test(text);

// ── Get user's primary CV + profile ──────────────────────────────
export const getUserContext = async (userId) => {
  try {
    const result = await query(
      `SELECT
         u.current_title, u.experience_years,
         up.target_roles, up.skills, up.salary_min_bdt, up.salary_max_bdt, up.confirmed_role,
         up.job_type, up.remote_preference,
         c.extracted_text, c.ats_score, c.analysis_json
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN cvs c ON c.user_id = u.id AND c.is_primary = TRUE
       WHERE u.id = $1`,
      [userId]
    );
    const ctx = result.rows[0] || {};

    // Auto-enrich from CV analysis when profile is empty
    if (ctx.analysis_json && (!ctx.target_roles?.length || !ctx.skills?.length)) {
      const analysis = typeof ctx.analysis_json === 'string'
        ? JSON.parse(ctx.analysis_json) : ctx.analysis_json;

      // (The CV's role is detected from the CV text itself in buildUserProfile,
      //  not copied here — a guessed role must not look like the user's choice.)
      // Use detected skills from CV
      if (!ctx.skills?.length && analysis.detected?.skills?.length) {
        ctx.skills = analysis.detected.skills.slice(0, 20);
      }
      // Use experience years from CV
      if (!ctx.experience_years && analysis.detected?.experience_years) {
        ctx.experience_years = analysis.detected.experience_years;
      }
    }

    return ctx;
  } catch (err) {
    logger.error('getUserContext failed', { error: err.message });
    return {};
  }
};

// Related families that share a track (QA ↔ software is adjacent, not equal)
const RELATED = {
  'qa engineer':            [],
  'software engineer':      ['frontend developer','backend developer','full stack developer','qa engineer','devops engineer'],
  'frontend developer':     ['software engineer','full stack developer'],
  'backend developer':      ['software engineer','full stack developer'],
  'full stack developer':   ['software engineer','frontend developer','backend developer'],
  'devops engineer':        ['software engineer','backend developer'],
  'mobile developer':       ['software engineer','frontend developer'],
  'business analyst':       ['data analyst','project manager'],
  'data analyst':           ['business analyst'],
  'marketing specialist':   ['sales executive','content writer','management trainee'],
  'sales executive':        ['marketing specialist','customer service','banking officer'],
  'customer service':       ['sales executive','operations executive'],
  'merchandiser':           [],
  'hr executive':           [],
  'accountant':             [],
  'graphic designer':       ['content writer'],
  'content writer':         ['marketing specialist','graphic designer'],
  'project manager':        ['business analyst'],
  'management trainee':     ['operations executive','marketing specialist','sales executive','banking officer','business analyst'],
  'event coordinator':      ['marketing specialist'],
  'operations executive':   ['management trainee', 'customer service', 'banking officer', 'sales executive'],
  'banking officer':        ['sales executive', 'customer service', 'operations executive', 'management trainee'],
};


const DOMAIN_CHECK_MIN_CHARS = 400;

// ── Per-user data that doesn't depend on the job ─────────────────
// Computed once per recalculation, not once per job — detectRoleFromCV and
// extractSkillsFromText scan the whole taxonomy and are far too slow to repeat.
export const buildUserProfile = (userCtx) => {
  const cvText     = norm(userCtx.extracted_text || '');
  const cvSkills   = extractSkillsFromText(cvText);
  const profSkills = (userCtx.skills || []).map(norm);
  const cvYears    = parseFloat(userCtx.experience_years) || 0;
  // Which occupation to match for, most trusted first:
  //   1. the role the user confirmed ("Yes, that's me") — ground truth
  //   2. their chosen target role, when the CV supports it
  //   3. what the CV itself shows
  // (A marketing CV with "Software Engineer" picked in onboarding gets
  //  marketing/operations jobs, and a note explaining why.)
  const rawCv      = userCtx.extracted_text || '';
  const confirmed  = (userCtx.confirmed_role || '').trim();
  const chosenRole = (userCtx.target_roles?.[0] || userCtx.current_title || '').trim();
  const cvOcc      = rawCv ? detectOccupationFromCV(rawCv) : null;
  let userOcc = null, roleSource = null, roleNote = null;
  if (confirmed) {
    // A confirmed role we can't place still wins — matched by its name
    userOcc = classifyOccupation(confirmed) || { key: `custom:${confirmed.toLowerCase()}`, code: null, name: confirmed, curated: null };
    roleSource = 'confirmed';
  } else {
    const chosenOcc = chosenRole ? classifyOccupation(chosenRole) : null;
    const supported = chosenOcc && rawCv ? cvSupportsRole(rawCv, chosenRole) : null;
    if (chosenOcc && (supported !== false || !cvOcc)) { userOcc = chosenOcc; roleSource = 'target'; }
    else if (cvOcc) {
      userOcc = cvOcc; roleSource = 'cv';
      if (chosenOcc && supported === false) roleNote = { chosen_role: chosenOcc.name, matched_role: cvOcc.name };
    }
  }
  const userPack = userOcc?.key.startsWith('custom:')
    ? { role_name: confirmed.toLowerCase(), title_synonyms: [confirmed.toLowerCase()], keywords: [], tools: [] }
    : getOccupationPack(userOcc);
  return {
    cvText, cvSkills, cvYears, userPack, roleNote, userOcc, roleSource, cvOcc,
    userFamily:    userOcc ? (userOcc.curated || userOcc.name.toLowerCase()) : null,
    allUserSkills: [...new Set([...cvSkills.map(norm), ...profSkills])],
    // The track's own vocabulary — proves a job ad is really in the user's field
    // (only for curated tracks, whose short titles like "QA" are ambiguous)
    domainTerms:   userPack && userOcc?.curated ? [...new Set([...(userPack.keywords || []), ...(userPack.tools || [])].map(norm))] : [],
    hasCerts:      /certif|istqb|aws certified|pmp|cfa/i.test(cvText),
    userSenior:    cvYears >= 4 || /senior/i.test(cvText.slice(0, 600)),
  };
};

// ── Score a single job ────────────────────────────────────────────
export const scoreJob = (job, userCtx, profile = buildUserProfile(userCtx)) => {
  const jdText   = norm(`${job.title} ${job.description || ''}`);
  const jobTitle = norm(job.title);
  const { cvSkills, cvYears, userPack, userFamily, allUserSkills } = profile;

  // ── Step 2: the job's occupation (stored when the job was saved) ──
  const jobOcc    = job.occupation_key ? occupationFromKey(job.occupation_key) : classifyOccupation(job.title);
  const jobFamily = jobOcc ? (jobOcc.curated || jobOcc.name.toLowerCase()) : null;
  const userOcc   = profile.userOcc;

  // ── Step 3: Career gate (never cross career tracks) ──────────────
  // Two curated tracks: our fine-tuned related-tracks list. Anything else:
  // the SOC hierarchy (same occupation / related / loosely related / not).
  let familyStatus = 'unknown';
  if (userOcc && jobOcc) {
    if (userOcc.curated && jobOcc.curated) {
      if (userOcc.curated === jobOcc.curated) familyStatus = 'same';
      else if ((RELATED[userOcc.curated] || []).includes(jobOcc.curated)) familyStatus = 'related';
      else familyStatus = 'different';
    } else if (userOcc.key === jobOcc.key) {
      familyStatus = 'same';
    } else {
      familyStatus = socRelation(userOcc.code, jobOcc.code) || 'different';
    }
  } else if (userOcc && !jobOcc && userPack) {
    // Job title unclassified — evidence-based: count user-pack signals in the JD
    const probe = [...(userPack.title_synonyms || []), ...(userPack.keywords || [])].map(norm);
    const hits = probe.filter((p) => hasTerm(jdText, p)).length;
    familyStatus = hits >= 3 ? 'related' : hits >= 1 ? 'weak' : 'different';
  }

  // A matching title isn't enough: "QA" in a garments ad or "Automation
  // Engineer" at a steel plant is a different career. If the ad is long enough
  // to judge, it must use the user's field vocabulary to count as same/related.
  if ((familyStatus === 'same' || familyStatus === 'related') && profile.domainTerms.length && jdText.length >= DOMAIN_CHECK_MIN_CHARS) {
    const domainHits = profile.domainTerms.filter((t) => hasTerm(jdText, t)).length;
    if (domainHits === 0)     familyStatus = 'different';
    else if (domainHits < 2)  familyStatus = 'weak';
  }

  // Cross-track → hard reject (scores far below the 70% bar)
  if (familyStatus === 'different') {
    return {
      score:               Math.min(20 + cvSkills.filter((s) => hasTerm(jdText, s)).length * 2, 30),
      role_match:          0,
      skill_match:         0,
      experience_match:    0,
      industry_match:      0,
      certification_match: 0,
      progression_match:   0,
      salary_match:        0,
      role_family:         'mismatch',
      user_family:         userFamily,
      job_family:          jobFamily || 'unclassified',
      matched_skills:      [],
      missing_skills:      [],
      required_years:      0,
      success_probability: 5,
      why_it_matches:      `Cross-track mismatch: your profile (${userFamily || 'unknown'}) does not align with this job (${jobFamily || 'unclassified'}).`,
    };
  }

  // ── Step 4: In-family scoring ─────────────────────────────────────
  // Role Match 40 — same family = full, related = partial
  const roleScore = familyStatus === 'same' ? 40 : familyStatus === 'related' ? 24 : familyStatus === 'weak' ? 12 : 18;

  // Skill Match 25 — user's actual skills present in the JD
  const skillsInJD   = allUserSkills.filter((s) => hasTerm(jdText, s));
  const jdSkills     = extractSkillsFromText(jdText);
  let skillScore;
  if (jdSkills.length >= 3) {
    skillScore = Math.min((skillsInJD.length / Math.max(jdSkills.length * 0.5, 2)) * 25, 25);
  } else {
    // Sparse JD — don't punish the candidate for a short job ad.
    skillScore = familyStatus === 'same' ? 17 : 10;
    skillScore = Math.max(skillScore, Math.min((skillsInJD.length / 4) * 25, 25));
  }
  if (familyStatus === 'same') skillScore = Math.max(skillScore, 14);

  // Experience Match 15
  const expMatch = jdText.match(/(\d+)\s*\+?\s*years?/);
  const reqYears = expMatch ? parseInt(expMatch[1]) : 0;
  let expScore = 11;
  if (reqYears > 0) expScore = Math.round(Math.min(cvYears / reqYears, 1.2) * 15);
  else if (cvYears > 0) expScore = Math.min(Math.round((cvYears / 3) * 12), 15);

  // Industry/context 10 — pack keywords present in JD
  let industryScore = 5;
  if (userPack) {
    const kwHits = userPack.keywords.filter((k) => hasTerm(jdText, norm(k))).length;
    const divisor = familyStatus === 'same' ? 3 : 5;
    industryScore = Math.min(Math.round((kwHits / divisor) * 10), 10);
    if (familyStatus === 'same') industryScore = Math.max(industryScore, 6);
  }

  // Certification 5
  const certScore = profile.hasCerts && /certif/i.test(jdText) ? 5 : 2;

  // Progression 5 — seniority alignment
  const jobSenior  = /senior|sr\.|lead|principal/i.test(jobTitle);
  const progScore  = jobSenior === profile.userSenior ? 5 : 2;

  // Salary alignment — not weighted in score but reported separately
  let salaryMatchPct = 50; // neutral when no data
  const userSalaryMin = parseFloat(userCtx.salary_min_bdt) || 0;
  const userSalaryMax = parseFloat(userCtx.salary_max_bdt) || 0;
  const jobSalaryMin  = parseFloat(job.salary_min_bdt) || 0;
  const jobSalaryMax  = parseFloat(job.salary_max_bdt) || 0;
  if (userSalaryMin > 0 && jobSalaryMin > 0) {
    const effectiveJobMax  = jobSalaryMax  || jobSalaryMin * 1.3;
    const effectiveUserMax = userSalaryMax || userSalaryMin * 1.5;
    const overlapMin = Math.max(userSalaryMin, jobSalaryMin);
    const overlapMax = Math.min(effectiveUserMax, effectiveJobMax);
    salaryMatchPct = overlapMin <= overlapMax ? 100 : (jobSalaryMin >= userSalaryMin * 0.8 ? 60 : 20);
  }

  let total = Math.round(Math.min(roleScore + skillScore + expScore + industryScore + certScore + progScore, 100));
  if (familyStatus === 'weak')    total = Math.min(total, 65);
  if (familyStatus === 'related') total = Math.min(total, 75);

  const missingSkills = jdSkills.filter((s) => !allUserSkills.some((u) => norm(u) === norm(s)));

  // ── Why It Matches — human-readable explanation ───────────────────
  const whyParts = [];
  if (familyStatus === 'same') {
    whyParts.push(`Direct role match: this job (${jobFamily}) aligns with your CV profile as a ${userFamily}`);
  } else if (familyStatus === 'related') {
    whyParts.push(`Adjacent role: ${jobFamily} is closely related to your background in ${userFamily}`);
  } else if (familyStatus === 'weak') {
    whyParts.push(`Partial match: some keywords from your profile appear in this job description`);
  }
  if (skillsInJD.length > 0) {
    whyParts.push(`${skillsInJD.length} skill${skillsInJD.length > 1 ? 's' : ''} from your CV found in job ad: ${skillsInJD.slice(0, 5).join(', ')}`);
  }
  if (reqYears > 0 && cvYears > 0) {
    whyParts.push(`Experience: job requires ${reqYears}+ years; your CV shows ~${cvYears} year${cvYears !== 1 ? 's' : ''}`);
  } else if (cvYears > 0) {
    whyParts.push(`You have ~${cvYears} year${cvYears !== 1 ? 's' : ''} of experience in this field`);
  }
  if (certScore === 5) {
    whyParts.push('Your certifications are relevant to this role\'s requirements');
  }
  const whyItMatches = whyParts.length > 0
    ? whyParts.join('. ') + '.'
    : 'Profile and job description share common keywords and role context.';

  // ── FLAT return structure — matches exactly what JobDetailDrawer.jsx reads ──
  return {
    score:               total,
    role_match:          Math.round((roleScore / 40) * 100),
    skill_match:         Math.round((skillScore / 25) * 100),
    experience_match:    Math.round((expScore / 15) * 100),
    industry_match:      Math.round((industryScore / 10) * 100),
    certification_match: Math.round((certScore / 5) * 100),
    progression_match:   Math.round((progScore / 5) * 100),
    salary_match:        salaryMatchPct,
    role_family:         familyStatus,
    user_family:         userFamily,
    job_family:          jobFamily || 'unclassified',
    matched_skills:      skillsInJD,
    missing_skills:      missingSkills.slice(0, 10),
    required_years:      reqYears,
    success_probability: Math.round(total * 0.85),
    why_it_matches:      whyItMatches,
  };
};

// ── Recalculate matches for a user ───────────────────────────────
const RECALC_JOB_LIMIT = 3000;
const INSERT_CHUNK     = 500;
const yieldToEventLoop = () => new Promise((r) => setImmediate(r));

export const recalculateUserMatches = async (userId) => {
  try {
    const userCtx = await getUserContext(userId);
    if (!userCtx.extracted_text) {
      logger.info('No CV for matching', { userId });
      return 0;
    }

    const jobs = await query(
      `SELECT id, title, description, salary_min_bdt, salary_max_bdt, occupation_key
       FROM jobs WHERE is_expired = FALSE ORDER BY scraped_at DESC LIMIT $1`,
      [RECALC_JOB_LIMIT]
    );
    if (jobs.rows.length === 0) return 0;

    const profile = buildUserProfile(userCtx);

    // Score and insert in chunks, yielding between them so API requests
    // keep being served while a large recalculation runs.
    for (let start = 0; start < jobs.rows.length; start += INSERT_CHUNK) {
      const chunk  = jobs.rows.slice(start, start + INSERT_CHUNK);
      const values = [];
      const params = [userId]; // $1 is userId
      let paramIndex = 2;
      for (const job of chunk) {
        const match = scoreJob(job, userCtx, profile);
        params.push(job.id, match.score, JSON.stringify(match));
        values.push(`($1, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, FALSE, FALSE)`);
        paramIndex += 3;
      }
      await query(
        `INSERT INTO job_matches (user_id, job_id, relevance_score, match_breakdown_json, alerted, seen)
         VALUES ${values.join(', ')}
         ON CONFLICT (user_id, job_id) DO UPDATE SET
           relevance_score      = EXCLUDED.relevance_score,
           match_breakdown_json = EXCLUDED.match_breakdown_json`,
        params
      );
      await yieldToEventLoop();
    }

    logger.info('Matches recalculated', { userId, jobsScored: jobs.rows.length });
    await deleteCachePattern(`matches:${userId}:*`);
    await deleteCachePattern(`market:${userId}`); // market card is built from the same profile + jobs
    await deleteCachePattern(`certs:${userId}`);
    return jobs.rows.length;
  } catch (err) {
    logger.error('recalculateUserMatches failed', { error: err.message, userId });
    return 0;
  }
};

// ── Recalculate matches for every user who has a CV ──────────────
// Run after each job sync so new jobs reach users without any action.
export const recalculateAllUsers = async () => {
  const users = await query(`SELECT DISTINCT user_id FROM cvs WHERE is_primary = TRUE`);
  let done = 0;
  for (const { user_id } of users.rows) {
    if (await recalculateUserMatches(user_id)) done++;
  }
  logger.info('All-user match recalculation complete', { users: users.rows.length, recalculated: done });
  return done;
};

// ── Get matched jobs for user (paginated) ─────────────────────────
export const getMatchedJobsForUser = async (userId, { limit = 20, offset = 0, minScore = 70, search = '' } = {}) => {
  try {
    const cacheKey = `matches:${userId}:${limit}:${offset}:${minScore}:${search}`;
    const cached   = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);

    const where = `jm.user_id = $1
         AND jm.relevance_score >= $2
         AND j.is_expired = FALSE
         ${search ? `AND (j.title ILIKE $3 OR j.company ILIKE $3)` : ''}`;
    const filterParams = search
      ? [userId, minScore, `%${search.replace(/[\\%_]/g, '\\$&')}%`]
      : [userId, minScore];
    const n = filterParams.length;

    const result = await query(
      `SELECT
         j.*,
         jm.relevance_score,
         jm.match_breakdown_json,
         jm.seen,
         jm.alerted,
         jm.user_feedback,
         a.status AS application_status
       FROM jobs j
       JOIN job_matches jm ON jm.job_id = j.id
       LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = jm.user_id
       WHERE ${where}
       ORDER BY jm.relevance_score DESC, j.scraped_at DESC
       LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...filterParams, limit, Math.max(offset, 0)]
    );

    const total = await query(
      `SELECT COUNT(*) FROM jobs j
       JOIN job_matches jm ON jm.job_id = j.id
       WHERE ${where}`,
      filterParams
    );

    const data = { jobs: await attachSalaries(result.rows), total: parseInt(total.rows[0].count), limit, offset };
    await setCache(cacheKey, JSON.stringify(data), 300); // 5 min cache
    return data;
  } catch (err) {
    logger.error('getMatchedJobsForUser failed', { error: err.message, userId });
    return { jobs: [], total: 0 };
  }
};
