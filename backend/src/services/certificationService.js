// ════════════════════════════════════════════════════════════════
// Certifications for the user's profession
//   1. asked for in real job ads of their profession (counted, with how
//      many ads say "required" vs "preferred")
//   2. recognised in their field (from the catalog) — clearly labelled as
//      not yet seen in ads, never given numbers
// Certifications already on the user's CV are marked as held.
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { getCache, setCache } from '../models/redis.js';
import { getUserContext, buildUserProfile } from './matchingService.js';
import { roleOf } from './salaryService.js';
import { CERTIFICATIONS, CERT_CONTEXT, REQUIRED_WORDS, PREFERRED_WORDS } from './certificationCatalog.js';

const CACHE_TTL_S = 60 * 60; // also cleared whenever the user's matches are recalculated
const WINDOW      = 80;      // characters around a mention checked for context / wording

// Does this ad ask for the certification? → null | { required }
export const findCertMention = (cert, text) => {
  const re = new RegExp(cert.match.source, 'gi');
  let found = null;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const around = `${text.slice(Math.max(0, m.index - WINDOW), m.index)} ${text.slice(m.index + m[0].length, m.index + m[0].length + WINDOW)}`;
    if (cert.needsContext && !CERT_CONTEXT.test(around)) continue;
    const required = REQUIRED_WORDS.test(around) && !PREFERRED_WORDS.test(around);
    found = { required: Boolean(found?.required || required) };
    if (found.required) break;
  }
  return found;
};

const belongsTo = (cert, occ) => !!occ && cert.fields.some((f) =>
  f === occ.key || (f.startsWith('soc:') && occ.code && occ.code.startsWith(f.slice(4))));

const card = (cert) => ({
  id: cert.id, name: cert.name, issuer: cert.issuer, url: cert.url,
  url_verified: cert.urlVerified, proves: cert.proves,
});

export const getCertificationsForUser = async (userId) => {
  const cacheKey = `certs:${userId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const ctx = await getUserContext(userId);
  const profile = buildUserProfile(ctx);
  if (!profile.userOcc) return { role: null, certifications: [] };

  const jobs = (await query(
    `SELECT title, description, occupation_key FROM jobs WHERE is_expired = FALSE`
  )).rows;
  const roleJobs = jobs.filter((j) => roleOf(j) === profile.userOcc.key);
  const cvText = ctx.extracted_text || '';

  const adBacked = [];
  const recognised = [];
  for (const cert of CERTIFICATIONS) {
    let ads = 0, required = 0;
    for (const j of roleJobs) {
      const hit = findCertMention(cert, `${j.title} ${j.description || ''}`);
      if (hit) { ads++; if (hit.required) required++; }
    }
    const has = cert.match.test(cvText);
    if (ads > 0) {
      adBacked.push({
        ...card(cert), kind: 'ads', has,
        evidence: { ads, required, of: roleJobs.length, percent: Math.round((ads / roleJobs.length) * 100) },
      });
    } else if (belongsTo(cert, profile.userOcc)) {
      recognised.push({ ...card(cert), kind: 'recognised', has, evidence: null });
    }
  }
  adBacked.sort((a, b) => b.evidence.ads - a.evidence.ads || b.evidence.required - a.evidence.required);

  const data = {
    role: profile.userOcc.name,
    ads_considered: roleJobs.length,
    certifications: [...adBacked, ...recognised],
    generated_at: new Date().toISOString(),
  };
  await setCache(cacheKey, data, CACHE_TTL_S);
  return data;
};
