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

// ── Skill index (built lazily, rebuilt when SKILLS changes) ───────
// Most skills are plain words ("node.js" → "node js"), so we look them up
// as n-grams of the text instead of running one regex per skill per text.
// Only skills with symbols that tokenizing would lose (c++, c#) use a regex.
const tokenize = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
let skillIndex = null;   // { source, grams: Map<gram, name>, maxN, regexSkills: [[re, name]] }

const getSkillIndex = () => {
  if (skillIndex && skillIndex.source === SKILLS) return skillIndex;
  const grams = new Map();
  const regexSkills = [];
  let maxN = 1;
  for (const [key, meta] of SKILLS) {
    if (key.length < 2) continue; // ultra-short keys cause false positives
    if (/[^a-z0-9\s.\-/]/.test(key)) {
      regexSkills.push([new RegExp(`[^a-z0-9]${escapeRegex(key)}[^a-z0-9]`, 'i'), meta.name]);
      continue;
    }
    const toks = tokenize(key);
    if (toks.length === 0) continue;
    const gram = toks.join(' ');
    if (!grams.has(gram)) grams.set(gram, meta.name);
    maxN = Math.max(maxN, toks.length);
  }
  skillIndex = { source: SKILLS, grams, maxN: Math.min(maxN, 6), regexSkills };
  return skillIndex;
};

// 'technology' | 'competency' | 'soft' | 'fallback' | null
export const getSkillCategory = (name) => SKILLS.get((name || '').toLowerCase())?.category || null;

// Extract all known skills present in text (word-boundary safe)
export const extractSkillsFromText = (text) => {
  const { grams, maxN, regexSkills } = getSkillIndex();
  const toks  = tokenize(text || '');
  const found = new Set();
  for (let i = 0; i < toks.length && found.size < 150; i++) {
    let gram = '';
    for (let n = 1; n <= maxN && i + n <= toks.length; n++) {
      gram = n === 1 ? toks[i] : `${gram} ${toks[i + n - 1]}`;
      const name = grams.get(gram);
      if (name) found.add(name);
    }
  }
  if (regexSkills.length) {
    const norm = ` ${(text || '').toLowerCase().replace(/\s+/g, ' ')} `;
    for (const [re, name] of regexSkills) if (re.test(norm)) found.add(name);
  }
  return [...found].slice(0, 150); // sanity cap
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
let TITLE_CODES   = new Map();   // lowercased title → Set(onet_code) (a title can belong to several)

export const loadRoleMappings = async () => {
  try {
    const [t, rs] = await Promise.all([
      dbQuery('SELECT title, onet_code FROM taxonomy_job_titles WHERE onet_code IS NOT NULL'),
      dbQuery('SELECT onet_code, skill FROM taxonomy_role_skills'),
    ]);
    TITLE_TO_CODE = new Map(t.rows.map((r) => [r.title.toLowerCase(), r.onet_code]));
    TITLE_CODES = new Map();
    for (const r of t.rows) {
      const k = r.title.toLowerCase();
      if (!TITLE_CODES.has(k)) TITLE_CODES.set(k, new Set());
      TITLE_CODES.get(k).add(r.onet_code);
    }
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
export const getCuratedPacksRaw = () => CURATED_PACKS;

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

// strict: only an exact title-synonym match (skip the token-evidence guess)
export const getCuratedPack = (roleTitle, { strict = false } = {}) => {
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
  if (strict) return null;

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
// ── Role family of a CV ───────────────────────────────────────────
// Scores the CV against every curated role family: a family's title in the
// CV's headline is strong evidence, a title elsewhere is medium, and each of
// the family's skills/tools found adds a little. Detecting from O*NET titles
// alone mislabelled CVs (a marketing/operations CV read as "event coordinator").
const HEADLINE_CHARS      = 400;
const MIN_FAMILY_SCORE    = 4;
const MIN_SUPPORT_SCORE   = 3;

const familyEvidence = (pack, fullText, headline) => {
  let score = 0, headlineHit = false;
  const hits = [];
  for (const syn of pack.title_synonyms || []) {
    if (hasWordBoundaryMatch(headline, syn))      { score += 5; hits.push(syn); headlineHit = true; }
    else if (hasWordBoundaryMatch(fullText, syn)) { score += 2; hits.push(syn); }
  }
  for (const term of [...(pack.keywords || []), ...(pack.tools || [])]) {
    if (hasWordBoundaryMatch(fullText, term)) { score += 1; hits.push(term); }
  }
  return { score, hits, headlineHit };
};

const cvTexts = (text) => {
  const flat = ` ${(text || '').toLowerCase().replace(/\s+/g, ' ')} `;
  return { fullText: flat, headline: flat.slice(0, HEADLINE_CHARS) };
};

// Best-fitting family for a CV, or null when nothing fits clearly
export const detectFamilyFromCV = (text) => {
  const { fullText, headline } = cvTexts(text);
  let best = null;
  for (const pack of CURATED_PACKS) {
    const { score, hits, headlineHit } = familyEvidence(pack, fullText, headline);
    if (!best || score > best.score) best = { family: pack.role_name, score, hits, headlineHit };
  }
  return best && best.score >= MIN_FAMILY_SCORE ? best : null;
};

// Does the CV show real evidence of this role (e.g. the user's chosen target)?
export const cvSupportsRole = (text, roleTitle) => {
  const pack = getOccupationPack(classifyOccupation(roleTitle));
  if (!pack) return null; // unknown role — can't judge
  const { fullText, headline } = cvTexts(text);
  return familyEvidence(pack, fullText, headline).score >= MIN_SUPPORT_SCORE;
};

export const getQualityExpectedSkills = (onetCode, limit = 25) => {
  const all = ROLE_SKILLS.get(onetCode) || [];
  return all.filter((s) => !GENERIC_COMPETENCIES.has(s.toLowerCase())).slice(0, limit);
};

// ════════════════════════════════════════════════════════════════
// Occupations — so matching works for any profession
// Every job title / CV is placed in one occupation: a curated Bangladesh
// track ("cp:…", fine-tuned) or one of ~1,000 O*NET occupations
// ("onet:<SOC code>", e.g. Fashion Designers, Electrical Engineers).
// How close two occupations are comes from the SOC code hierarchy.
// ════════════════════════════════════════════════════════════════
let OCCUPATIONS = new Map();   // onet_code → { code, title, name }

// Curated tracks placed in the SOC hierarchy, so they relate to O*NET ones
const CURATED_SOC = {
  'qa engineer':          '15-1253.00', 'software engineer':  '15-1252.00', 'frontend developer':   '15-1254.00',
  'backend developer':    '15-1252.00', 'full stack developer': '15-1252.00', 'mobile developer':   '15-1252.00',
  'devops engineer':      '15-1244.00', 'data analyst':       '15-2051.00', 'business analyst':     '13-1111.00',
  'project manager':      '13-1082.00', 'marketing specialist': '13-1161.00', 'sales executive':    '41-4012.00',
  'customer service':     '43-4051.00', 'merchandiser':       '13-1022.00', 'hr executive':         '13-1071.00',
  'accountant':           '13-2011.00', 'graphic designer':   '27-1024.00', 'content writer':       '27-3043.00',
  'management trainee':   '11-1021.00', 'event coordinator':  '13-1121.00', 'operations executive': '11-1021.00',
  'banking officer':      '13-2072.00',
};

// "Accountants and Auditors" → "Accountant", "Registered Nurses" → "Registered Nurse"
const occupationName = (title) => {
  let head = title.split(',')[0].trim();
  if (!head.includes(' ')) head = title.replace(/,? and /gi, ' and ').trim(); // one word before the comma says too little
  const [first] = head.split(/ and /i);
  if (first !== head && /[^s]s$/i.test(first.trim())) head = first.trim(); // "Accountants and Auditors" → "Accountants"
  return head.replace(/(\w+)$/, (w) => (
    /^sales$/i.test(w) ? w                              // "Sales" is not a plural
      : /(wi|kni|li)ves$/i.test(w) ? w.slice(0, -3) + 'fe' // Midwives → Midwife (Representatives stays regular)
      : /ies$/i.test(w) ? w.slice(0, -3) + 'y'        // Secretaries → Secretary
      : /(ss|us)$/i.test(w) ? w : w.replace(/s$/i, '')
  ));
};

export const loadOccupations = async () => {
  try {
    const r = await dbQuery('SELECT onet_code, title FROM taxonomy_occupations');
    OCCUPATIONS = new Map(r.rows.map((o) => [o.onet_code, { code: o.onet_code, title: o.title, name: occupationName(o.title) }]));
    titleIndex = null;
    logger.info('Occupations loaded', { occupations: OCCUPATIONS.size });
  } catch (err) { logger.warn('Occupations load failed', { error: err.message }); }
};

// "qa engineer" → "QA Engineer", "hr executive" → "HR Executive"
const ACRONYM_WORDS = { qa: 'QA', sqa: 'SQA', hr: 'HR', it: 'IT', ui: 'UI', ux: 'UX', devops: 'DevOps' };
const titleCase = (s) => s.replace(/\b[a-z]+\b/g, (w) => ACRONYM_WORDS[w] || w.charAt(0).toUpperCase() + w.slice(1));

// ── Fast title lookup over all O*NET titles (n-grams, longest wins) ──
let titleIndex = null; // { grams: Map<title, code>, maxN, codeTitles: Map<code, titles[]> }
const MIN_SINGLE_WORD_TITLE = 6; // "nurse"-length words are fine, "agent"/"clerk"-style generics are not

const getTitleIndex = () => {
  if (titleIndex && titleIndex.source === TITLE_CODES) return titleIndex;
  const grams = new Map();
  const codeTitles = new Map();
  let maxN = 1;
  // An occupation's own official name (singular) always points to it, even if
  // another occupation lists the same words as an alternate title (O*NET lists
  // "Civil Engineer" under Environmental Engineers; "Civil Engineers" is 17-2051)
  for (const occ of OCCUPATIONS.values()) {
    const toks = tokenize(occ.name);
    if (toks.length < 2) continue;
    grams.set(toks.join(' '), occ.code);
    maxN = Math.max(maxN, toks.length);
  }
  for (const [title, codeSet] of TITLE_CODES) {
    const toks = tokenize(title);
    if (toks.length === 0) continue;
    const gram = toks.join(' ');
    if (GENERIC_TITLES.has(gram) || ROLE_MODIFIERS.has(gram)) continue;
    if (toks.length === 1 && gram.length < MIN_SINGLE_WORD_TITLE) continue;
    // A title shared by unrelated occupations ("systems engineer") decides nothing
    let codes = [...codeSet];
    if (new Set(codes.map((c) => c.slice(0, 6))).size > 1) {
      // "civil engineer" is listed under several occupations — keep it only
      // for the one actually named Civil Engineers
      codes = codes.filter((c) => tokenize(OCCUPATIONS.get(c)?.title || '').join(' ').includes(gram));
      if (codes.length !== 1) continue;
    }
    const code = codes[0];
    if (!grams.has(gram)) grams.set(gram, code);
    if (!codeTitles.has(code)) codeTitles.set(code, []);
    codeTitles.get(code).push(title);
    maxN = Math.max(maxN, toks.length);
  }
  titleIndex = { source: TITLE_CODES, grams, maxN: Math.min(maxN, 8), codeTitles };
  return titleIndex;
};

// Every O*NET title found in a phrase: [{ code, title, words, pos }].
// One-word titles ("deputy", "labor") only count when they are the whole
// phrase once seniority words are removed — inside longer text they mislead.
const findTitles = (text) => {
  const { grams, maxN } = getTitleIndex();
  const toks = tokenize(text || '');
  const core = toks.filter((t) => !SENIORITY.has(t));
  const found = [];
  for (let i = 0; i < toks.length; i++) {
    let gram = '';
    for (let n = 1; n <= maxN && i + n <= toks.length; n++) {
      gram = n === 1 ? toks[i] : `${gram} ${toks[i + n - 1]}`;
      if (n === 1 && !(core.length === 1 && core[0] === gram)) continue;
      const code = grams.get(gram);
      if (code) found.push({ code, title: gram, words: n, pos: i });
    }
  }
  return found;
};

// Words that describe level, not the job
const SENIORITY = new Set(['senior', 'sr', 'junior', 'jr', 'asst', 'assistant', 'deputy', 'associate', 'principal',
  'chief', 'head', 'lead', 'trainee', 'intern', 'probationary', 'executive', 'ii', 'iii', 'i']);
const ROLE_MODIFIERS = new Set(['deputy', 'labor', 'labour', 'helper', 'worker', 'incharge', 'in charge']);
// Nouns that name a job; "Officer - Operations" means "Operations Officer"
const ROLE_NOUNS = new Set(['officer', 'executive', 'manager', 'engineer', 'assistant', 'associate', 'specialist',
  'coordinator', 'analyst', 'supervisor', 'consultant', 'technician', 'designer', 'developer', 'administrator',
  'director', 'controller', 'representative', 'operator', 'incharge', 'lead', 'head']);

// Phrases worth looking up in a job title: the whole title, each part
// between separators, and Bangladeshi "Noun - Field" order flipped
// ("Officer - Operations" → "operations officer", "Engineer - Civil" →
// "civil engineer").
const titleCandidates = (title) => {
  const parts = title.split(/\s*(?:[\/|,;:()&]|\s[-–—]\s|[-–—]\s|\s[-–—]|\bat\b|\bfor\b)\s*/i)
    .map((p) => p.trim()).filter((p) => p.length > 1);
  // Never look up across separators: "Executive / Assistant" is not "executive assistant"
  const out = parts.length > 1 ? [...parts] : [title];
  const flipped = [];
  for (const a of parts) {
    const aToks = tokenize(a);
    const noun = [...aToks].reverse().find((t) => ROLE_NOUNS.has(t));
    if (!noun) continue;
    // Only a bare role word takes its field from another part ("Officer",
    // "Project Engineer"); "Trainee Patrol Officer (Operations)" already says
    // what the job is, so it is not re-read as "operations officer".
    const core = aToks.filter((t) => !SENIORITY.has(t) && !VAGUE_LEADS.has(t) && !ROLE_NOUNS.has(t));
    if (core.length > 0) continue;
    for (const b of parts) {
      if (b === a) continue;
      const bToks = tokenize(b).filter((t) => !SENIORITY.has(t));
      if (bToks.length === 0 || bToks.length > 3 || bToks.some((t) => ROLE_NOUNS.has(t))) continue;
      flipped.push(`${bToks.join(' ')} ${noun}`);
    }
  }
  return { phrases: [...new Set(out)], flipped: new Set(flipped) };
};

// A department written as the field names the track: "Manager - HR Office
// Operations" is an HR manager, not an operations manager.
const DEPARTMENT_TRACKS = {
  hr: 'hr executive', human: 'hr executive', accounts: 'accountant', accounting: 'accountant',
  finance: 'accountant', audit: 'accountant', marketing: 'marketing specialist', sales: 'sales executive',
  merchandising: 'merchandiser', admin: 'operations executive', administration: 'operations executive',
  customer: 'customer service',
};

// Leading words that make a title vague ("project engineer", "office engineer")
const VAGUE_LEADS = new Set(['project', 'office', 'technical', 'support', 'general', 'field', 'site', 'systems',
  'system', 'service', 'services', 'staff', 'plant', 'team', 'unit', 'department', 'area', 'zonal', 'regional']);
const MIN_TITLE_SPECIFICITY = 2;

// How specific an O*NET title is: words that say what the job is — level
// words ("assistant", "chief") and vague words ("project", "technical") don't
// count, so "assistant manager" or "technical support engineer" can't decide.
const specificity = (title) =>
  tokenize(title).filter((t) => !SENIORITY.has(t) && !VAGUE_LEADS.has(t)).length;

// Most specific title: most words, then earliest
const bestTitle = (found) => found.reduce((best, f) =>
  (!best || f.words > best.words || (f.words === best.words && f.pos < best.pos) ? f : best), null);

const onetOccupation = (code, matchedTitle) => {
  const occ = OCCUPATIONS.get(code);
  return { key: `onet:${code}`, code, name: occ?.name || titleCase(matchedTitle || code), curated: null };
};
const curatedOccupation = (pack) => ({
  key: `cp:${pack.role_name}`, code: CURATED_SOC[pack.role_name] || null, name: titleCase(pack.role_name), curated: pack.role_name,
});

// ── Classify a job title / role name ──────────────────────────────
// Exact curated track → most specific O*NET title → curated guess → null
export const classifyOccupation = (title) => {
  if (!title) return null;
  const strict = getCuratedPack(title, { strict: true });
  if (strict) return curatedOccupation(strict);

  // Score every candidate reading; on ties prefer our curated tracks and the
  // "field + role" reading ("civil engineer" over "project engineer").
  const { phrases, flipped } = titleCandidates(title);
  let best = null; // { occ, score }
  const consider = (occ, specific, phrase) => {
    const score = specific + (occ.curated ? 0.5 : 0) + (flipped.has(phrase) ? 0.25 : 0);
    if (!best || score > best.score) best = { occ, score };
  };
  for (const phrase of [...phrases, ...flipped]) {
    const dept = flipped.has(phrase) ? DEPARTMENT_TRACKS[tokenize(phrase)[0]] : null;
    if (dept) {
      const pack = CURATED_PACKS.find((p) => p.role_name === dept);
      if (pack) { consider(curatedOccupation(pack), tokenize(phrase).length + 1, phrase); continue; }
    }
    const pack = getCuratedPack(phrase, { strict: true });
    if (pack) { consider(curatedOccupation(pack), tokenize(phrase).length, phrase); continue; }
    const t = bestTitle(findTitles(phrase));
    if (!t) continue;
    const specific = t.words === 1 ? 2 : specificity(t.title); // a whole-phrase single word is specific
    if (specific < MIN_TITLE_SPECIFICITY) continue;
    // An O*NET title that is really one of our curated tracks stays curated
    const cp = getCuratedPack(t.title, { strict: true });
    consider(cp ? curatedOccupation(cp) : onetOccupation(t.code, t.title), specific, phrase);
  }
  if (best) return best.occ;
  const guess = getCuratedPack(title);
  return guess ? curatedOccupation(guess) : null;
};

// Rebuild an occupation from a stored key ("cp:qa engineer" / "onet:17-2071.00")
export const occupationFromKey = (key) => {
  if (!key) return null;
  if (key.startsWith('cp:')) {
    const pack = CURATED_PACKS.find((p) => p.role_name === key.slice(3));
    return pack ? curatedOccupation(pack) : null;
  }
  if (key.startsWith('onet:')) return onetOccupation(key.slice(5));
  return null;
};

// ── The CV's occupation ───────────────────────────────────────────
// A curated track named in the headline wins; otherwise an O*NET title in the
// headline; otherwise strong curated evidence; otherwise the O*NET title the
// CV mentions most.
export const detectOccupationFromCV = (text) => {
  if (!text) return null;
  const { fullText, headline } = cvTexts(text);
  const curated = detectFamilyFromCV(text);
  if (curated?.headlineHit) return curatedOccupation(CURATED_PACKS.find((p) => p.role_name === curated.family));

  const head = bestTitle(findTitles(headline));
  if (head) return classifyOccupation(head.title);

  if (curated) return curatedOccupation(CURATED_PACKS.find((p) => p.role_name === curated.family));

  const counts = new Map();
  for (const f of findTitles(fullText)) counts.set(f.code, (counts.get(f.code) || 0) + f.words);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 2 ? classifyOccupation(OCCUPATIONS.get(top[0])?.title || '') || onetOccupation(top[0]) : null;
};

// ── A pack (titles + vocabulary) for any occupation ──────────────
// Curated tracks have hand-made packs; O*NET occupations get their titles
// plus only their specific technology skills (soft skills and everyday
// office tools say nothing about the field).
const EVERYDAY_TOOLS = new Set(['microsoft excel', 'microsoft word', 'microsoft office', 'microsoft outlook',
  'microsoft powerpoint', 'microsoft teams', 'adobe acrobat', 'google docs', 'google sheets', 'google drive',
  'email software', 'web browser software', 'zoom', 'slack', 'microsoft sharepoint']);
const packCache = new Map();

export const getOccupationPack = (occ) => {
  if (!occ) return null;
  if (occ.curated) return CURATED_PACKS.find((p) => p.role_name === occ.curated) || null;
  if (packCache.has(occ.code)) return packCache.get(occ.code);
  const titles = (getTitleIndex().codeTitles.get(occ.code) || [])
    .sort((a, b) => b.length - a.length).slice(0, 30);
  const keywords = (ROLE_SKILLS.get(occ.code) || [])
    .filter((sk) => SKILLS.get(sk.toLowerCase())?.category === 'technology' && !EVERYDAY_TOOLS.has(sk.toLowerCase()))
    .slice(0, 25);
  const pack = { role_name: occ.name.toLowerCase(), title_synonyms: titles, keywords, tools: [] };
  packCache.set(occ.code, pack);
  return pack;
};

// ── How close two occupations are (SOC: major-minor-broad-detailed) ──
// same detailed (17-2071) → 'same' · same broad (17-207x) → 'related'
// same minor (17-2xxx) → 'weak' · otherwise 'different'
export const socRelation = (a, b) => {
  if (!a || !b) return null;
  if (a.slice(0, 7) === b.slice(0, 7)) return 'same';
  if (a.slice(0, 6) === b.slice(0, 6)) return 'related';
  if (a.slice(0, 4) === b.slice(0, 4)) return 'weak';
  return 'different';
};

// For role search boxes: occupation names containing the query
export const searchOccupations = (q, limit = 8) => {
  const needle = (q || '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const names = new Set([
    ...CURATED_PACKS.map((p) => titleCase(p.role_name)),
    ...[...OCCUPATIONS.values()].map((o) => o.name),
  ]);
  return [...names]
    .filter((n) => n.toLowerCase().includes(needle))
    .sort((a, b) => (a.toLowerCase().startsWith(needle) ? 0 : 1) - (b.toLowerCase().startsWith(needle) ? 0 : 1) || a.length - b.length)
    .slice(0, limit);
};
