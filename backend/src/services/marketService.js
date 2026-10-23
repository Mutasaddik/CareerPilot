// ════════════════════════════════════════════════════════════════
// Market Update — what the job market looks like for the user's role,
// computed only from the real job ads CareerPilot has collected.
//   • jobs for the role posted in the last 7 days
//   • typical pay (real ads only; null when too few)
//   • skills employers ask for most, marked have / missing from the CV
//   • companies hiring most for the role
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { getCache, setCache } from '../models/redis.js';
import { getUserContext, buildUserProfile } from './matchingService.js';
import { roleOf, estimateForRole } from './salaryService.js';
import { extractSkillsFromText, getSkillCategory } from './taxonomyService.js';

const CACHE_TTL_S     = 60 * 60; // also cleared whenever the user's matches are recalculated
const TOP_SKILLS      = 10;
const TOP_COMPANIES   = 5;
const MIN_SKILL_JOBS  = 2;       // a skill one ad mentions isn't a trend
const HIDDEN_EMPLOYER = /^(posted by|confidential|a (leading|reputed|renowned|well[- ]known))/i;
// Bare brand / generic entries in the O*NET technology list — not advice
const TOO_GENERIC = new Set(['google', 'microsoft', 'internet', 'email', 'e-mail', 'software', 'computer', 'web', 'apple', 'oracle']);

const norm     = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasTerm  = (text, term) => new RegExp(`(^|[^a-z0-9])${escapeRe(norm(term))}($|[^a-z0-9])`).test(text);

const levelFromYears = (years) => (years >= 6 ? 'senior' : years >= 3 ? 'mid' : 'entry');

// Skills worth advising on: the role's curated keywords/tools plus concrete
// technology skills. Generic soft skills ("communication") aren't actionable.
const skillsInAd = (text, pack) => {
  const found = new Map(); // lowercase → display name
  for (const term of [...(pack.keywords || []), ...(pack.tools || [])]) {
    if (hasTerm(text, term)) found.set(norm(term), term);
  }
  for (const name of extractSkillsFromText(text)) {
    if (getSkillCategory(name) === 'technology' && !TOO_GENERIC.has(norm(name))) found.set(norm(name), name);
  }
  return found;
};

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export const getMarketUpdate = async (userId) => {
  const cacheKey = `market:${userId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const ctx = await getUserContext(userId);
  if (!ctx.extracted_text && !ctx.target_roles?.length && !ctx.current_title) {
    return { role: null, reason: 'no_profile' };
  }
  const profile = buildUserProfile(ctx);
  if (!profile.userPack || !profile.userOcc) return { role: null, reason: 'role_unknown' };

  const family = profile.userOcc.key;   // occupation key, any profession
  const level  = levelFromYears(profile.cvYears);

  const jobs = await query(
    `SELECT title, description, company, posted_date, occupation_key, location, experience_level, is_remote
     FROM jobs WHERE is_expired = FALSE`
  );
  const roleJobs = jobs.rows.filter((j) => roleOf(j) === family);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const postedThisWeek = roleJobs.filter((j) => j.posted_date && new Date(j.posted_date).getTime() >= weekAgo).length;

  // Skills: how many of the role's ads ask for each one
  const skillCounts = new Map(); // key → { name, count }
  for (const job of roleJobs) {
    const text = norm(`${job.title} ${job.description || ''}`);
    for (const [key, name] of skillsInAd(text, profile.userPack)) {
      const entry = skillCounts.get(key) || { name, count: 0 };
      entry.count++;
      skillCounts.set(key, entry);
    }
  }
  const userSkills = new Set(profile.allUserSkills.map(norm));
  const topSkills = [...skillCounts.entries()]
    .filter(([, v]) => v.count >= MIN_SKILL_JOBS)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP_SKILLS)
    .map(([key, v]) => ({
      name:    titleCase(v.name),
      jobs:    v.count,
      percent: Math.round((v.count / roleJobs.length) * 100),
      has:     userSkills.has(key) || hasTerm(profile.cvText, key),
    }));

  // Companies hiring most for the role (skip anonymous / "Posted by" ads)
  const companyCounts = new Map();
  for (const job of roleJobs) {
    const name = (job.company || '').trim();
    if (!name || HIDDEN_EMPLOYER.test(name)) continue;
    companyCounts.set(name, (companyCounts.get(name) || 0) + 1);
  }
  const topCompanies = [...companyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_COMPANIES)
    .map(([name, count]) => ({ name, jobs: count }));

  // Where the jobs are: city/area (first part of the location), top 4
  const locationCounts = new Map();
  for (const job of roleJobs) {
    const place = (job.location || '').split(/[,(]/)[0].trim().replace(/\s+/g, ' ');
    if (!place || /^anywhere/i.test(place)) continue;
    const key = place.charAt(0).toUpperCase() + place.slice(1);
    locationCounts.set(key, (locationCounts.get(key) || 0) + 1);
  }
  const topLocations = [...locationCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => ({ name, jobs: count }));

  // Experience levels employers ask for in this field
  const levels = { entry: 0, mid: 0, senior: 0 };
  for (const job of roleJobs) if (levels[job.experience_level] !== undefined) levels[job.experience_level]++;
  const remoteJobs = roleJobs.filter((j) => j.is_remote || /anywhere|remote/i.test(j.location || '')).length;

  const salary = await estimateForRole(family, level);

  const data = {
    role:             profile.userOcc.name,
    role_source:      profile.roleSource,   // 'confirmed' | 'target' | 'cv'
    level,
    active_jobs:      roleJobs.length,
    posted_this_week: postedThisWeek,
    salary:           salary ? { min: salary.min, max: salary.max, level: salary.level, sample_size: salary.sample_size } : null,
    top_skills:       topSkills,
    missing_skills:   topSkills.filter((s) => !s.has).map((s) => s.name),
    top_companies:    topCompanies,
    top_locations:    topLocations,
    levels,
    remote_jobs:      remoteJobs,
    // Set when the user's chosen role isn't supported by their CV, so the
    // dashboard can explain why jobs follow the CV instead
    role_note:        profile.roleNote,
    generated_at:     new Date().toISOString(),
  };
  await setCache(cacheKey, data, CACHE_TTL_S);
  return data;
};
