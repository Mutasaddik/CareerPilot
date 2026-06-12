// ════════════════════════════════════════════════════════════════
// CareerPilot ATS Engine v2 — two-dimensional scoring
//
// 1. COMPATIBILITY (always, role-agnostic): "Is this CV ATS-friendly?"
//    Parseability & sections 30 · Contact 15 · Writing quality 35 · Length/structure 20
//
// 2. ROLE MATCH (only when profile context exists): "Does it match the target?"
//    Keywords 40 · Skills 30 · Experience 20 · Format 10
//
// Headline ats_score = Compatibility. Role match shown alongside.
// Skill detection backed by O*NET taxonomy (8,800+ skills, all industries).
// ════════════════════════════════════════════════════════════════
import {
  extractSkillsFromText,
  extractCertificationsFromText,
  isKnownJobTitle,
  detectRoleFromCV,
  getExpectedSkillsForRole,
  getCuratedPack,
  getQualityExpectedSkills,
} from './taxonomyService.js';

const ACTION_VERBS = [
  'achieved','built','created','designed','developed','implemented','improved','increased',
  'launched','led','managed','optimized','reduced','automated','delivered','engineered',
  'established','executed','initiated','migrated','resolved','spearheaded','streamlined',
  'architected','collaborated','deployed','enhanced','integrated','maintained','tested',
  'analyzed','accelerated','championed','consolidated','transformed','mentored','authored',
  'coordinated','organized','supervised','trained','negotiated','ran','directed','produced',
];

const WEAK_PHRASES = [
  'responsible for','duties included','worked on','helped with','assisted in',
  'was involved in','participated in','familiar with','exposure to',
  'hard working','hardworking','team player','go-getter','think outside the box',
  'self-motivated','results-driven','dynamic','synergy',
];

const PLACEHOLDER_PATTERNS = [
  /\[name to be provided\]/i, /\[designation\]/i, /\[organization\]/i,
  /\[phone number\]/i, /\[email address\]/i, /\[address\]/i,
  /lorem ipsum/i, /your name here/i, /\[date\]/i, /xxx-xxx/i,
];

const SECTION_PATTERNS = {
  summary:        /\b(summary|objective|profile|about\s*me|career\s*objective)\b/i,
  experience:     /\b(experience|employment|work\s*history|professional\s*background|extracurricular)\b/i,
  education:      /\b(education|academic|qualification)\b/i,
  skills:         /\b(skills|technologies|technical\s*skills|competencies|tech\s*stack)\b/i,
  projects:       /\b(projects|portfolio)\b/i,
  certifications: /\b(certifications?|licenses?|courses?|training)\b/i,
};

const normalize   = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsTerm = (text, term) =>
  new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}($|[^a-z0-9])`, 'i').test(text);

// ── Extractors ────────────────────────────────────────────────────
export const extractContactInfo = (text) => ({
  email:    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text),
  phone:    /(\+?880|0)?1[3-9]\d{8}|\+?\d[\d\s().-]{8,}\d/.test(text),
  linkedin: /linkedin\.com\/in\/|linkedin:|\blinkedin\b/i.test(text),
  location: /\b(dhaka|chattogram|chittagong|sylhet|rajshahi|khulna|barisal|rangpur|bangladesh|address)\b/i.test(text),
});

export const detectSections = (text) => {
  const found = {};
  for (const [name, pattern] of Object.entries(SECTION_PATTERNS)) found[name] = pattern.test(text);
  return found;
};

export const extractExperienceYears = (text) => {
  const norm = normalize(text);
  const yearMentions = [...norm.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*years?/g)]
    .map((m) => parseFloat(m[1])).filter((y) => y > 0 && y <= 50);
  const currentYear = new Date().getFullYear();
  const ranges = [...norm.matchAll(/(20\d{2}|19\d{2})\s*[-–—to]+\s*(20\d{2}|19\d{2}|present|current|now)/g)];
  let rangeYears = 0;
  for (const r of ranges) {
    const start = parseInt(r[1]);
    const end   = /present|current|now/.test(r[2]) ? currentYear : parseInt(r[2]);
    if (end >= start && end - start <= 50) rangeYears += (end - start);
  }
  const fromMentions = yearMentions.length ? Math.max(...yearMentions) : 0;
  return Math.max(fromMentions, rangeYears);
};

export const analyzeWritingPattern = (text) => {
  const lines = text.split(/\n|•|●|▪|‣|·/).map((l) => l.trim()).filter((l) => l.length > 10);
  const norm  = normalize(text);
  const placeholders = PLACEHOLDER_PATTERNS.filter((p) => p.test(text)).length;
  return {
    word_count:               norm.split(' ').length,
    action_verb_count:        ACTION_VERBS.filter((v) => containsTerm(norm, v)).length,
    bullet_lines:             lines.length,
    lines_starting_with_verb: lines.filter((l) => ACTION_VERBS.some((v) => l.toLowerCase().startsWith(v))).length,
    quantified_achievements:  (text.match(/\d+\s*%|\$\s*\d|৳\s*\d|gpa[:\s]*\d|cgpa[:\s]*\d|\d+\s*(users|clients|projects|tests|bugs|hours|days|members|people|platforms|events|campaigns|x\b)/gi) || []).length,
    weak_phrases_found:       WEAK_PHRASES.filter((p) => norm.includes(p)),
    placeholder_count:        placeholders,
  };
};

// ════════════════════════════════════════════════════════════════
// DIMENSION 1 — ATS COMPATIBILITY (role-agnostic, 0–100)
// ════════════════════════════════════════════════════════════════
const scoreCompatibility = ({ contact, sections, writing, detectedSkills, certifications }) => {
  let pts = 0;
  const issues = [];

  // Parseability & sections — 30
  let sec = 0;
  if (sections.experience)     sec += 8;
  if (sections.education)      sec += 7;
  if (sections.skills)         sec += 8;
  if (sections.summary)        sec += 4;
  if (sections.certifications) sec += 3;
  if (!sections.experience) issues.push('No clearly-labeled Experience section found.');
  if (!sections.skills)     issues.push('No clearly-labeled Skills section found.');
  pts += Math.min(sec, 30);

  // Contact — 15
  let con = 0;
  if (contact.email)    con += 5; else issues.push('No email address detected.');
  if (contact.phone)    con += 4; else issues.push('No phone number detected.');
  if (contact.linkedin) con += 3;
  if (contact.location) con += 3;
  pts += Math.min(con, 15);

  // Writing quality — 35
  let wq = 0;
  wq += Math.min((writing.quantified_achievements / 5) * 12, 12);
  wq += Math.min((writing.lines_starting_with_verb / 6) * 10, 10);
  wq += Math.min((writing.action_verb_count / 8) * 6, 6);
  wq += Math.min((detectedSkills.length / 10) * 5, 5);   // taxonomy-detected skills present
  if (certifications.length > 0) wq += 2;
  wq -= Math.min(writing.weak_phrases_found.length * 1.5, 6);
  wq -= Math.min(writing.placeholder_count * 3, 9);
  if (writing.placeholder_count > 0) issues.push(`Placeholder text found (e.g. "[Name To Be Provided]") — remove or complete it; ATS systems read it literally.`);
  pts += Math.max(Math.min(wq, 35), 0);

  // Length & structure — 20
  let ls = 0;
  if (writing.word_count >= 300 && writing.word_count <= 1200) ls += 10;
  else if (writing.word_count >= 200) ls += 6;
  else issues.push('CV is very short — aim for 300–1200 words.');
  if (writing.bullet_lines >= 8) ls += 6; else if (writing.bullet_lines >= 4) ls += 3;
  if (writing.bullet_lines < 4) issues.push('Use more bullet points — large paragraphs parse poorly in ATS.');
  ls += 4; // text extracted successfully = machine-readable baseline
  pts += Math.min(ls, 20);

  return { score: Math.round(Math.max(Math.min(pts, 100), 0)), issues };
};

// ════════════════════════════════════════════════════════════════
// DIMENSION 2 — ROLE MATCH (only with profile context, 0–100)
// ════════════════════════════════════════════════════════════════
const scoreRoleMatch = (cvText, detectedSkills, cvYears, writing, profile) => {
  const targetRole    = (profile.target_roles && profile.target_roles[0]) || profile.current_title || '';
  const profileSkills = (profile.skills || []).map(normalize);

  // Detect the CV's OWN role from its text
  const cvRole = detectRoleFromCV(cvText);

  // If the CV's own role differs from the user's target role, base
  // recommendations on the CV's role (O*NET expected skills), not the profile.
  // Priority: curated pack → quality-filtered O*NET (hot tools + non-generic competencies)
  const curated = cvRole ? getCuratedPack(cvRole.title) : null;
  const cvRoleSkills = curated
    ? [...curated.keywords, ...curated.tools].map(normalize)
    : (cvRole ? getQualityExpectedSkills(cvRole.onet_code).map(normalize) : []);
  if (cvRole && cvRoleSkills.length > 0 && targetRole && !normalize(cvRole.title).includes(normalize(targetRole)) &&
      !normalize(targetRole).includes(normalize(cvRole.title))) {
    const expected = cvRoleSkills;
    const norm = normalize(cvText);
    const matched = expected.filter((s) => containsTerm(norm, s));
    const missing = expected.filter((s) => !containsTerm(norm, s));
    const ratio = expected.length ? matched.length / expected.length : 0.5;
    return {
      score: Math.round(Math.min(ratio * 70 + Math.min((writing.quantified_achievements / 4) * 15, 15) + 15, 100)),
      matched_keywords: matched,
      missing_keywords: missing.slice(0, 10),
      target_role: cvRole.title,
      basis: 'cv_detected_role',
    };
  }

  if (!targetRole && profileSkills.length === 0) {
    // No profile context — fall back to CV's own role if detected
    if (cvRole && cvRoleSkills.length > 0) {
      const expected = cvRoleSkills;
      const norm = normalize(cvText);
      const matched = expected.filter((s) => containsTerm(norm, s));
      const missing = expected.filter((s) => !containsTerm(norm, s));
      const ratio = expected.length ? matched.length / expected.length : 0.5;
      return {
        score: Math.round(Math.min(ratio * 70 + 30, 100)),
        matched_keywords: matched,
        missing_keywords: missing.slice(0, 10),
        target_role: cvRole.title,
        basis: 'cv_detected_role',
      };
    }
    return null;
  }

  const norm = normalize(cvText);

  // Keywords 40 — profile skills + role title words as the target set
  const targets = [...new Set([
    ...profileSkills,
    ...normalize(targetRole).split(' ').filter((w) => w.length > 2),
  ])];
  const matchedKw = targets.filter((t) => containsTerm(norm, t));
  const missingKw = targets.filter((t) => !containsTerm(norm, t));
  const kwPts = targets.length ? (matchedKw.length / targets.length) * 40 : 0;

  // Skills 30 — profile skills vs taxonomy-detected CV skills
  const cvSkillsNorm = detectedSkills.map(normalize);
  const matchedSk = profileSkills.filter((p) => cvSkillsNorm.some((c) => c === p || c.includes(p) || p.includes(c)));
  const skPts = profileSkills.length ? (matchedSk.length / profileSkills.length) * 30 : 15;

  // Experience 20
  const profYears = parseFloat(profile.experience_years) || 0;
  let exPts = profYears > 0
    ? Math.min((cvYears / profYears), 1.2) * 12
    : (cvYears > 0 ? Math.min((cvYears / 3) * 12, 12) : 0);
  exPts += Math.min((writing.quantified_achievements / 4) * 8, 8);

  // Format 10 — title alignment + structure echo
  let fmPts = 6;
  if (targetRole && isKnownJobTitle(targetRole) && containsTerm(norm, normalize(targetRole))) fmPts += 4;

  return {
    score: Math.round(Math.min(kwPts + skPts + Math.min(exPts, 20) + fmPts, 100)),
    matched_keywords: matchedKw,
    missing_keywords: missingKw.slice(0, 12),
    target_role: targetRole || null,
    basis: 'user_profile',
  };
};

// ── Suggestions (rule-based; AI layer may override text) ─────────
const buildSuggestions = ({ contact, sections, writing, detectedSkills, certifications, compatibility, roleMatch }) => {
  const strengths = [];
  const improvements = [...compatibility.issues];

  if (contact.email && contact.phone) strengths.push('Contact information is complete and machine-readable.');
  if (sections.experience && sections.education && sections.skills) strengths.push('All core sections present — good ATS structure.');
  if (writing.quantified_achievements >= 4) strengths.push(`Good use of numbers and metrics (${writing.quantified_achievements} found).`);
  if (writing.lines_starting_with_verb >= 5) strengths.push('Bullets lead with action verbs — strong writing pattern.');
  if (detectedSkills.length >= 8) strengths.push(`${detectedSkills.length} recognized skills detected across the taxonomy.`);
  if (certifications.length > 0) strengths.push(`Certifications recognized: ${certifications.slice(0, 3).join(', ')}.`);

  if (!contact.linkedin) improvements.push('Add your LinkedIn URL.');
  if (!sections.summary) improvements.push('Add a 2–3 line summary targeting your desired role.');
  if (writing.quantified_achievements < 4) improvements.push('Quantify more achievements (numbers, %, scale).');
  if (writing.weak_phrases_found.length > 0) improvements.push(`Replace weak phrases: ${writing.weak_phrases_found.slice(0, 3).map((p) => `"${p}"`).join(', ')}.`);
  if (roleMatch && roleMatch.missing_keywords.length > 0) improvements.push(`For your target role, consider adding: ${roleMatch.missing_keywords.slice(0, 5).join(', ')}.`);

  return { strengths, improvements: [...new Set(improvements)] };
};

// ── Path to 90+: concrete fixes with exact point gains ───────────
const buildScorePath = ({ contact, sections, writing, compatibility }) => {
  const fixes = [];

  // Each fix: what to do + how many compatibility points it recovers
  if (!sections.summary)
    fixes.push({ action: 'Add a 2-3 line professional summary at the top', points: 4 });
  if (!sections.certifications && writing.word_count > 250)
    fixes.push({ action: 'Add a Certifications / Courses section', points: 3 });
  if (!contact.linkedin)
    fixes.push({ action: 'Add your LinkedIn profile URL in the header', points: 3 });
  if (!contact.location)
    fixes.push({ action: 'Add your city/location in the contact line', points: 3 });

  if (writing.quantified_achievements < 5) {
    const gain = Math.round(((5 - writing.quantified_achievements) / 5) * 12);
    fixes.push({ action: `Add ${5 - writing.quantified_achievements} more quantified results (numbers, %, scale — e.g. "managed 3 campaigns reaching 5,000+ people")`, points: gain });
  }
  if (writing.lines_starting_with_verb < 6) {
    const gain = Math.round(((6 - writing.lines_starting_with_verb) / 6) * 10);
    fixes.push({ action: `Rewrite ${6 - writing.lines_starting_with_verb} more bullets to start with action verbs (Led, Built, Reduced…)`, points: gain });
  }
  if (writing.weak_phrases_found.length > 0)
    fixes.push({ action: `Remove weak phrases (${writing.weak_phrases_found.slice(0, 2).map((p) => `"${p}"`).join(', ')}) and state impact instead`, points: Math.min(writing.weak_phrases_found.length * 2, 6) });
  if (writing.placeholder_count > 0)
    fixes.push({ action: 'Remove or complete placeholder text like "[Name To Be Provided]"', points: Math.min(writing.placeholder_count * 3, 9) });
  if (writing.word_count < 300)
    fixes.push({ action: `Expand your CV to at least 300 words (currently ~${writing.word_count})`, points: 6 });
  if (writing.bullet_lines < 8)
    fixes.push({ action: 'Break dense paragraphs into bullet points (aim for 8+)', points: writing.bullet_lines < 4 ? 6 : 3 });

  // Sort by impact, compute projection
  fixes.sort((a, b) => b.points - a.points);
  const totalGain = fixes.reduce((s, f) => s + f.points, 0);
  const projected = Math.min(compatibility.score + totalGain, 98);

  return {
    current_score: compatibility.score,
    projected_score: projected,
    total_possible_gain: totalGain,
    fixes: fixes.slice(0, 6),
  };
};

// ── Main entry — signature unchanged ──────────────────────────────
export const runATSAnalysis = (cvText, userProfile = {}) => {
  const contact        = extractContactInfo(cvText);
  const sections       = detectSections(cvText);
  const detectedSkills = extractSkillsFromText(cvText);
  const certifications = extractCertificationsFromText(cvText);
  const cvYears        = extractExperienceYears(cvText);
  const writing        = analyzeWritingPattern(cvText);

  const compatibility = scoreCompatibility({ contact, sections, writing, detectedSkills, certifications });
  const roleMatch     = scoreRoleMatch(cvText, detectedSkills, cvYears, writing, userProfile);

  const scorePath = buildScorePath({ contact, sections, writing, compatibility });
  const { strengths, improvements } = buildSuggestions({
    contact, sections, writing, detectedSkills, certifications, compatibility, roleMatch,
  });

  const breakdown = {
    ats_compatibility: compatibility.score,
    ...(roleMatch ? { role_match: roleMatch.score } : {}),
    writing_quality: Math.round(Math.min(
      ((Math.min(writing.quantified_achievements / 5, 1) * 40) +
       (Math.min(writing.lines_starting_with_verb / 6, 1) * 40) +
       (Math.min(writing.action_verb_count / 8, 1) * 20)), 100)),
    section_structure: Math.round(
      (Object.values(sections).filter(Boolean).length / Object.keys(sections).length) * 100),
  };

  return {
    ats_score: compatibility.score,            // headline = compatibility (role-agnostic)
    role_match_score: roleMatch ? roleMatch.score : null,
    breakdown,
    missing_keywords: roleMatch ? roleMatch.missing_keywords : [],
    detected: {
      skills: detectedSkills,
      certifications,
      experience_years: cvYears,
      contact, sections,
      writing_pattern: writing,
      target_role: roleMatch ? roleMatch.target_role : null,
    },
    strengths,
    improvements,
    score_path: scorePath,
    engine: 'careerpilot-ats-v2-onet',
  };
};
