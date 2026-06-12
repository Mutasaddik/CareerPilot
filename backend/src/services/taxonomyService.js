// ════════════════════════════════════════════════════════════════
// Loads taxonomy (skills/titles/certs) from PostgreSQL into memory
// once at boot. Engine matching stays instant — no per-request DB hits.
// Falls back to a built-in mini taxonomy if tables are empty.
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import logger from './loggerService.js';

let SKILLS = new Map();   // lowercased name → { name, category }
let TITLES = new Set();   // lowercased titles
let CERTS  = new Map();   // lowercased name → { name, field }
let loaded = false;

// Minimal built-in fallback so engine works pre-seed
const FALLBACK_SKILLS = [
  'javascript','typescript','python','java','react','node.js','sql','postgresql',
  'mongodb','docker','git','selenium','playwright','api testing','manual testing',
  'automation testing','excel','power bi','communication','leadership','teamwork',
  'problem solving','merchandising','buyer communication','vendor negotiation',
  'production follow-up','order tracking','sample coordination','adobe photoshop',
  'adobe illustrator','canva','microsoft 365','market analysis','sales strategy',
  'time management','adaptability','team collaboration','quality control',
];

export const loadTaxonomy = async () => {
  try {
    const [s, t, c] = await Promise.all([
      query('SELECT name, category FROM taxonomy_skills'),
      query('SELECT title FROM taxonomy_job_titles'),
      query('SELECT name, field FROM taxonomy_certifications'),
    ]);

    if (s.rows.length > 0) {
      SKILLS = new Map(s.rows.map((r) => [r.name.toLowerCase(), r]));
      TITLES = new Set(t.rows.map((r) => r.title.toLowerCase()));
      CERTS  = new Map(c.rows.map((r) => [r.name.toLowerCase(), r]));
      logger.info('Taxonomy loaded', { skills: SKILLS.size, titles: TITLES.size, certs: CERTS.size });
    } else {
      SKILLS = new Map(FALLBACK_SKILLS.map((n) => [n, { name: n, category: 'fallback' }]));
      logger.warn('Taxonomy tables empty — using built-in fallback. Run: npm run seed:taxonomy');
    }
    loaded = true;
  } catch (err) {
    SKILLS = new Map(FALLBACK_SKILLS.map((n) => [n, { name: n, category: 'fallback' }]));
    loaded = true;
    logger.warn('Taxonomy load failed — using fallback', { error: err.message });
  }
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Extract all known skills present in text (word-boundary safe)
export const extractSkillsFromText = (text) => {
  const norm  = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const found = [];
  for (const [key, meta] of SKILLS) {
    // skip ultra-short keys that cause false positives (e.g. 'r', 'go' needs boundary care)
    if (key.length < 2) continue;
    const re = new RegExp(`[^a-z0-9]${escapeRegex(key)}[^a-z0-9]`, 'i');
    if (re.test(norm)) found.push(meta.name);
    if (found.length >= 150) break; // sanity cap
  }
  return found;
};

export const extractCertificationsFromText = (text) => {
  const norm  = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const found = [];
  for (const [key, meta] of CERTS) {
    const re = new RegExp(`[^a-z0-9]${escapeRegex(key)}[^a-z0-9]`, 'i');
    if (re.test(norm)) found.push(meta.name);
  }
  return found;
};

export const isKnownJobTitle = (title) => {
  if (!title) return false;
  const t = title.toLowerCase().trim();
  if (TITLES.has(t)) return true;
  // partial: any known title contained in the given string
  for (const known of TITLES) {
    if (known.length > 4 && t.includes(known)) return true;
  }
  return false;
};

export const getTaxonomyStats = () => ({
  loaded, skills: SKILLS.size, titles: TITLES.size, certifications: CERTS.size,
});

// ── Role detection & role-based skill expectations ────────────────
import { query as dbQuery } from '../models/db.js';

let TITLE_TO_CODE = new Map();   // lowercased title → onet_code
let ROLE_SKILLS   = new Map();   // onet_code → [skills]

export const loadRoleMappings = async () => {
  try {
    const [t, rs] = await Promise.all([
      dbQuery('SELECT title, onet_code FROM taxonomy_job_titles WHERE onet_code IS NOT NULL'),
      dbQuery('SELECT onet_code, skill FROM taxonomy_role_skills'),
    ]);
    TITLE_TO_CODE = new Map(t.rows.map((r) => [r.title.toLowerCase(), r.onet_code]));
    ROLE_SKILLS = new Map();
    for (const r of rs.rows) {
      if (!ROLE_SKILLS.has(r.onet_code)) ROLE_SKILLS.set(r.onet_code, []);
      ROLE_SKILLS.get(r.onet_code).push(r.skill);
    }
    logger.info('Role mappings loaded', { titleCodes: TITLE_TO_CODE.size, rolesWithSkills: ROLE_SKILLS.size });
  } catch (err) { logger.warn('Role mappings load failed', { error: err.message }); }
};

// Generic single-word titles that match everywhere — never use as a detected role
const GENERIC_TITLES = new Set([
  'intern','engineer','manager','assistant','associate','specialist','analyst',
  'consultant','coordinator','officer','executive','supervisor','director',
  'developer','designer','administrator','technician','operator','agent',
  'trainee','student','fresher','professional','staff','worker','member','lead',
]);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWordBoundaryMatch = (haystack, needle) =>
  new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}($|[^a-z0-9])`, 'i').test(haystack);

// Detect the CV's own role from its text (headline/objective weighted)
export const detectRoleFromCV = (text) => {
  const head = ` ${text.slice(0, 800).toLowerCase()} `;
  const full = ` ${text.toLowerCase()} `;
  let best = null;

  for (const [title, code] of TITLE_TO_CODE) {
    if (title.length < 5) continue;
    if (GENERIC_TITLES.has(title)) continue;        // skip meaningless generics
    const inHead = hasWordBoundaryMatch(head, title);
    const inFull = inHead || hasWordBoundaryMatch(full, title);
    if (!inFull) continue;
    const hasSkills = ROLE_SKILLS.has(code) && ROLE_SKILLS.get(code).length > 0;
    // prefer: headline > skill-mapped roles > longer titles
    const score = title.length + (inHead ? 50 : 0) + (hasSkills ? 30 : 0);
    if (!best || score > best.score) best = { title, code, score };
  }
  return best ? { title: best.title, onet_code: best.code } : null;
};

export const getExpectedSkillsForRole = (onetCode, limit = 25) => {
  const skills = ROLE_SKILLS.get(onetCode) || [];
  return skills.slice(0, limit);
};

// ── Curated role keyword packs (priority over O*NET) ─────────────
let CURATED_PACKS = [];   // [{ role_name, title_synonyms, keywords, tools }]

// O*NET universal competencies — true for every job, useless as recommendations
const GENERIC_COMPETENCIES = new Set([
  'reading comprehension','active listening','speaking','writing','mathematics',
  'english language','critical thinking','complex problem solving','judgment and decision making',
  'monitoring','active learning','learning strategies','social perceptiveness','coordination',
  'time management','instructing','service orientation','operations monitoring','science',
  'computers and electronics','clerical','customer and personal service','education and training',
  'psychology','public safety and security','law and government','communications and media',
]);

export const loadCuratedPacks = async () => {
  try {
    const r = await dbQuery('SELECT role_name, title_synonyms, keywords, tools FROM taxonomy_role_keywords');
    CURATED_PACKS = r.rows;
    logger.info('Curated role packs loaded', { packs: CURATED_PACKS.length });
  } catch (err) { logger.warn('Curated packs load failed', { error: err.message }); }
};

// Find a curated pack matching a detected role title (or raw CV headline)
// Modifier words that carry no role information — stripped before token scoring
const TITLE_NOISE = new Set([
  'junior','senior','sr','jr','lead','principal','head','chief','mid','level',
  'entry','experienced','expert','remote','onsite','on-site','hybrid','contract',
  'full-time','part-time','intern','internship','trainee','fresher','urgent',
  'immediate','vacancy','job','jobs','position','opening','hiring','wanted',
  'male','female','for','the','and','with','in','at','of','to','a','an',
  'dhaka','chittagong','chattogram','sylhet','khulna','rajshahi','bangladesh','bd',
  'ai-assisted','ai','ml',
]);

// Signature tokens per family — distinctive words that strongly indicate the role.
// weight 3 = definitive (appears ~only in this family), 2 = strong, 1 = supporting
const FAMILY_TOKENS = {
  'qa engineer':          { qa: 3, sqa: 3, test: 2, tester: 3, testing: 2, quality: 1, automation: 2, sdet: 3 },
  'software engineer':    { software: 2, developer: 1, engineer: 1, programmer: 3, java: 2, python: 2, '.net': 2, dotnet: 2, laravel: 2, wordpress: 2, php: 2, web: 1 },
  'frontend developer':   { frontend: 3, 'front-end': 3, react: 2, angular: 2, vue: 2, ui: 1 },
  'backend developer':    { backend: 3, 'back-end': 3, node: 2, 'node.js': 2, api: 1, microservices: 2 },
  'full stack developer': { 'full-stack': 3, fullstack: 3, mern: 3, stack: 2 },
  'mobile developer':     { mobile: 2, flutter: 3, android: 2, ios: 2, 'react-native': 3, app: 1, dart: 2, kotlin: 2, swift: 2 },
  'devops engineer':      { devops: 3, sre: 3, infrastructure: 2, cloud: 1, kubernetes: 2, docker: 1, reliability: 2 },
  'data analyst':         { data: 2, analytics: 2, analyst: 1, bi: 2, 'power-bi': 2, tableau: 2, 'deep-learning': 2, 'machine-learning': 2, learning: 1 },
  'business analyst':     { business: 2, functional: 2, requirements: 2, product: 1 },
  'qa engineer_x':        {},
  'marketing specialist': { marketing: 3, seo: 2, digital: 1, brand: 2, content: 1, campaign: 2, growth: 2 },
  'sales executive':      { sales: 3, selling: 2, 'business-development': 2, bd: 0, revenue: 1, account: 1 },
  'merchandiser':         { merchandiser: 3, merchandising: 3, apparel: 2, garments: 2, buyer: 2, sourcing: 2 },
  'hr executive':         { hr: 3, 'human-resources': 3, recruitment: 2, talent: 2, payroll: 2, admin: 1 },
  'accountant':           { accountant: 3, accounts: 3, accounting: 3, finance: 2, audit: 2, tax: 2, bookkeeper: 3, vat: 2 },
  'customer service':     { customer: 2, support: 2, service: 1, care: 1, helpdesk: 3, 'call-center': 3 },
  'graphic designer':     { graphic: 3, designer: 2, design: 1, creative: 1, visual: 2, illustrator: 2, photoshop: 2 },
  'content writer':       { writer: 3, copywriter: 3, content: 2, editor: 2, writing: 2 },
  'project manager':      { project: 2, program: 1, scrum: 2, pmo: 3, agile: 1 },
  'management trainee':   { management: 1, trainee: 2, mto: 3, graduate: 1 },
  'event coordinator':    { event: 3, events: 3, coordination: 1, exhibition: 2 },
};

const tokenizeTitle = (title) =>
  title.toLowerCase()
    .replace(/[^a-z0-9.+#-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !TITLE_NOISE.has(w));

export const getCuratedPack = (roleTitle) => {
  if (!roleTitle) return null;
  const t = ` ${roleTitle.toLowerCase().trim()} `;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Pass 1 — exact synonym phrase, longest wins (most precise)
  let best = null;
  for (const pack of CURATED_PACKS) {
    for (const s of pack.title_synonyms) {
      if (s.length < 4) continue;
      const re = new RegExp(`(^|[^a-z0-9])${esc(s)}($|[^a-z0-9])`, 'i');
      if (re.test(t) && (!best || s.length > best.len)) best = { pack, len: s.length };
    }
  }
  if (best) return best.pack;

  // Pass 2 — signature-token evidence scoring
  const tokens = tokenizeTitle(roleTitle);
  if (tokens.length === 0) return null;
  let topFamily = null, topScore = 0, second = 0;
  for (const [family, sig] of Object.entries(FAMILY_TOKENS)) {
    let score = 0;
    for (const tok of tokens) {
      if (sig[tok]) score += sig[tok];
      // hyphen-joined bigrams: 'front end' → 'front-end'
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]}-${tokens[i+1]}`;
      if (sig[bigram]) score += sig[bigram];
    }
    if (score > topScore) { second = topScore; topScore = score; topFamily = family; }
    else if (score > second) second = score;
  }
  // Require real evidence (>=3) and a clear winner (not a tie)
  if (topScore >= 3 && topScore > second) {
    return CURATED_PACKS.find((p) => p.role_name === topFamily) || null;
  }
  return null;
};

// Filtered O*NET expectations: hot tools + non-generic competencies
export const getQualityExpectedSkills = (onetCode, limit = 25) => {
  const all = ROLE_SKILLS.get(onetCode) || [];
  return all.filter((s) => !GENERIC_COMPETENCIES.has(s.toLowerCase())).slice(0, limit);
};
