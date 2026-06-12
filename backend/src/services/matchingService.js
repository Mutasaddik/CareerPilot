// ════════════════════════════════════════════════════════════════
// Job Matching Service
// Scores each job against user's CV + profile (0–100%)
// Keyword 35% · Skill 30% · Experience 20% · Salary 10% · Title 5%
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { getCache, setCache } from '../models/redis.js';
import { extractSkillsFromText, detectRoleFromCV, getCuratedPack } from './taxonomyService.js';
import logger from './loggerService.js';

const norm       = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRe   = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasTerm    = (text, term) =>
  new RegExp(`(^|[^a-z0-9])${escapeRe(norm(term))}($|[^a-z0-9])`, 'i').test(text);

// ── Get user's primary CV + profile ──────────────────────────────
const getUserContext = async (userId) => {
  try {
    const result = await query(
      `SELECT
         u.current_title, u.experience_years,
         up.target_roles, up.skills, up.salary_min_bdt, up.salary_max_bdt,
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

      // Use detected target role from ATS engine
      if (!ctx.target_roles?.length && analysis.detected?.target_role) {
        ctx.target_roles = [analysis.detected.target_role];
      }
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

// ── Score a single job ────────────────────────────────────────────
export const scoreJob = (job, userCtx) => {
  const jdText   = norm(`${job.title} ${job.description || ''}`);
  const jobTitle = norm(job.title);
  const cvText   = norm(userCtx.extracted_text || '');
  const cvSkills = extractSkillsFromText(cvText);
  const profSkills = (userCtx.skills || []).map(norm);
  const cvYears  = parseFloat(userCtx.experience_years) || 0;

  // ── Step 1: Candidate role family ────────────────────────────────
  const targetRole = (userCtx.target_roles?.[0] || userCtx.current_title || '').toLowerCase();
  const cvDetected = detectRoleFromCV(userCtx.extracted_text || '');
  const effectiveTarget = targetRole || cvDetected?.title || '';
  const userPack = getCuratedPack(effectiveTarget);
  const userFamily = userPack ? userPack.role_name : null;

  // ── Step 2: Job role family (classify from JOB title) ────────────
  const jobPack = getCuratedPack(jobTitle);
  const jobFamily = jobPack ? jobPack.role_name : null;

  // Related families that share a track (QA ↔ software is adjacent, not equal)
  const RELATED = {
    'qa engineer':            ['software engineer'],
    'software engineer':      ['frontend developer','backend developer','full stack developer','qa engineer','devops engineer'],
    'frontend developer':     ['software engineer','full stack developer'],
    'backend developer':      ['software engineer','full stack developer'],
    'full stack developer':   ['software engineer','frontend developer','backend developer'],
    'devops engineer':        ['software engineer','backend developer'],
    'mobile developer':       ['software engineer','frontend developer'],
    'business analyst':       ['data analyst','project manager'],
    'data analyst':           ['business analyst'],
    'marketing specialist':   ['sales executive','content writer'],
    'sales executive':        ['marketing specialist','customer service'],
    'customer service':       ['sales executive'],
    'merchandiser':           [],
    'hr executive':           [],
    'accountant':             [],
    'graphic designer':       ['content writer'],
    'content writer':         ['marketing specialist','graphic designer'],
    'project manager':        ['business analyst'],
    'management trainee':     [],
    'event coordinator':      ['marketing specialist'],
  };

  // ── Step 3: Family gate (YOUR RULE: never cross career tracks) ───
  let familyStatus = 'unknown';
  if (userFamily && jobFamily) {
    if (userFamily === jobFamily) familyStatus = 'same';
    else if ((RELATED[userFamily] || []).includes(jobFamily)) familyStatus = 'related';
    else familyStatus = 'different';
  } else if (userFamily && !jobFamily) {
    // Job title unclassified — evidence-based: count user-pack signals in the JD
    const probe = [...userPack.title_synonyms, ...userPack.keywords].map(norm);
    const hits = probe.filter((p) => hasTerm(jdText, p)).length;
    familyStatus = hits >= 3 ? 'related' : hits >= 1 ? 'weak' : 'different';
  }

  // Cross-track → hard reject (scores far below the 70% bar)
  if (familyStatus === 'different') {
    return {
      score: Math.min(20 + cvSkills.filter((s) => hasTerm(jdText, s)).length * 2, 30),
      breakdown: { role_family: 'mismatch', user_family: userFamily, job_family: jobFamily || 'unclassified' },
      matched_skills: [],
      missing_skills: [],
      required_years: 0,
      success_probability: 5,
    };
  }

  // ── Step 4: In-family scoring ─────────────────────────────────────
  // Role Match 40 — same family = full, related = partial
  const roleScore = familyStatus === 'same' ? 40 : familyStatus === 'related' ? 24 : familyStatus === 'weak' ? 12 : 18;

  // Skill Match 25 — user's actual skills present in the JD
  const allUserSkills = [...new Set([...cvSkills.map(norm), ...profSkills])];
  const skillsInJD = allUserSkills.filter((s) => hasTerm(jdText, s));
  const jdSkills   = extractSkillsFromText(jdText);
  let skillScore;
  if (jdSkills.length >= 3) {
    skillScore = Math.min((skillsInJD.length / Math.max(jdSkills.length * 0.5, 2)) * 25, 25);
  } else {
    // Sparse JD — don't punish the candidate for a short job ad.
    // Same family implies skill alignment; use a neutral-high floor.
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
  const certScore = /certif|istqb|aws certified|pmp|cfa/i.test(cvText) && /certif/i.test(jdText) ? 5 : 2;

  // Progression 5 — seniority alignment
  const jobSenior = /senior|sr\.|lead|principal/i.test(jobTitle);
  const userSenior = cvYears >= 4 || /senior/i.test(cvText.slice(0, 600));
  const progScore = jobSenior === userSenior ? 5 : 2;

  let total = Math.round(Math.min(roleScore + skillScore + expScore + industryScore + certScore + progScore, 100));
  if (familyStatus === 'weak')    total = Math.min(total, 65);
  if (familyStatus === 'related') total = Math.min(total, 75);

  const missingSkills = jdSkills.filter((s) => !allUserSkills.some((u) => norm(u) === norm(s)));

  return {
    score: total,
    breakdown: {
      role_match:       Math.round((roleScore / 40) * 100),
      skill_match:      Math.round((skillScore / 25) * 100),
      experience_match: Math.round((expScore / 15) * 100),
      industry_match:   Math.round((industryScore / 10) * 100),
      certification_match: Math.round((certScore / 5) * 100),
      progression_match:   Math.round((progScore / 5) * 100),
      user_family: userFamily, job_family: jobFamily || 'unclassified',
    },
    matched_skills: skillsInJD,
    missing_skills: missingSkills.slice(0, 10),
    required_years: reqYears,
    success_probability: Math.round(total * 0.85),
  };
};

// ── Recalculate matches for a user ───────────────────────────────
export const recalculateUserMatches = async (userId) => {
  try {
    const userCtx = await getUserContext(userId);
    if (!userCtx.extracted_text) {
      logger.info('No CV for matching', { userId });
      return 0;
    }

    // Get recent non-expired jobs
    const jobs = await query(
      `SELECT * FROM jobs WHERE is_expired = FALSE ORDER BY scraped_at DESC LIMIT 500`
    );

    let count = 0;
    for (const job of jobs.rows) {
      const match = scoreJob(job, userCtx);

      await query(
        `INSERT INTO job_matches (user_id, job_id, relevance_score, match_breakdown_json, alerted, seen)
         VALUES ($1, $2, $3, $4, FALSE, FALSE)
         ON CONFLICT (user_id, job_id) DO UPDATE SET
           relevance_score     = $3,
           match_breakdown_json = $4`,
        [userId, job.id, match.score, JSON.stringify(match)]
      );
      count++;
    }

    logger.info('Matches recalculated', { userId, jobsScored: count });
    return count;
  } catch (err) {
    logger.error('recalculateUserMatches failed', { error: err.message, userId });
    return 0;
  }
};

// ── Get matched jobs for user (paginated) ─────────────────────────
export const getMatchedJobsForUser = async (userId, { limit = 20, offset = 0, minScore = 0, search = '' } = {}) => {
  try {
    const cacheKey = `matches:${userId}:${limit}:${offset}:${minScore}:${search}`;
    const cached   = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await query(
      `SELECT
         j.*,
         jm.relevance_score,
         jm.match_breakdown_json,
         jm.seen,
         jm.alerted,
         jm.user_feedback
       FROM jobs j
       JOIN job_matches jm ON jm.job_id = j.id
       WHERE jm.user_id = $1
         AND jm.relevance_score >= $2
         AND j.is_expired = FALSE
         ${search ? `AND (LOWER(j.title) LIKE LOWER($4) OR LOWER(j.company) LIKE LOWER($4))` : ''}
       ORDER BY jm.relevance_score DESC, j.scraped_at DESC
       LIMIT $3 OFFSET ${offset}`,
      search
        ? [userId, minScore, limit, `%${search}%`]
        : [userId, minScore, limit]
    );

    const total = await query(
      `SELECT COUNT(*) FROM jobs j
       JOIN job_matches jm ON jm.job_id = j.id
       WHERE jm.user_id = $1 AND jm.relevance_score >= $2 AND j.is_expired = FALSE`,
      [userId, minScore]
    );

    const data = { jobs: result.rows, total: parseInt(total.rows[0].count), limit, offset };
    await setCache(cacheKey, JSON.stringify(data), 300); // 5 min cache
    return data;
  } catch (err) {
    logger.error('getMatchedJobsForUser failed', { error: err.message, userId });
    return { jobs: [], total: 0 };
  }
};
