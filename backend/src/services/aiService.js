// ════════════════════════════════════════════════════════════════
// aiService — ATS score comes from our OWN engine (free, instant).
// Free AI (Gemini free tier) used ONLY to enhance suggestion text.
// Works with ZERO API keys (rule-based fallback).
// ════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { query } from '../models/db.js';
import { getCache, setCache } from '../models/redis.js';
import { runATSAnalysis } from './atsEngine.js';
import logger from './loggerService.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your-')
  ? process.env.GEMINI_API_KEY
  : null;

// ── Fetch user profile for scoring context ────────────────────────
const getUserProfileForScoring = async (userId) => {
  try {
    const result = await query(
      `SELECT up.target_roles, up.skills, up.experience_years, u.current_title
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0] || {};
  } catch (err) {
    logger.warn('Profile fetch for ATS failed', { error: err.message });
    return {};
  }
};

// ── Free AI suggestion enhancement (Gemini) ───────────────────────
const enhanceWithGemini = async (engineResult, cvText) => {
  if (!GEMINI_KEY) return null;
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);

    const prompt = `You are an expert ATS Resume Analyzer, Senior Recruiter, and Career Coach with deep knowledge of global hiring practices across all industries.

Analyze this CV deeply. The ATS score is already computed (${engineResult.ats_score}/100 by a deterministic engine) — do NOT provide a score. Your job is the qualitative expert analysis.

Respond with ONLY valid JSON, no markdown fences, exactly this shape:
{
  "expert_summary": "2-3 sentence overall assessment of this CV's market position",
  "improvements": ["max 6 specific, actionable items referencing actual CV content"],
  "bullet_rewrites": [
    {"current": "actual weak bullet quoted from the CV", "better": "rewritten version with tools, scope, and measurable outcome"}
  ],
  "missing_keywords_categorized": {
    "methodology": ["..."], "tools": ["..."], "domain": ["..."], "soft_skills": ["..."]
  },
  "achievements_section_suggestion": ["3-4 punchy achievement lines extracted/synthesized from the CV's real content"],
  "recommended_certifications": ["max 4, relevant to the detected role and seniority"],
  "daily_tip": "one short practical tip",
  "interview_questions": ["3 questions this candidate should prepare for"]
}

Rules:
- bullet_rewrites: pick 2-3 REAL bullets from the CV that are weakest; rewrites must keep facts truthful, never invent experience
- missing_keywords_categorized: only keywords genuinely relevant to the CV's actual role (detected: ${engineResult.detected.target_role || 'unknown'}); skip categories with nothing relevant
- achievements_section_suggestion: only from facts present in the CV
- Be specific like a senior recruiter, not generic

Engine findings for context:
- Missing keywords (rule-based): ${engineResult.missing_keywords.join(', ') || 'none'}
- Detected skills: ${engineResult.detected.skills.slice(0, 20).join(', ')}
- Quantified achievements found: ${engineResult.detected.writing_pattern.quantified_achievements}
- Weak phrases: ${engineResult.detected.writing_pattern.weak_phrases_found.join(', ') || 'none'}

FULL CV TEXT:
${cvText.slice(0, 6000)}`;

    // Model fallback chain — each pulls from a different capacity pool
    const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash'];
    let lastErr = null;
    for (const modelName of MODELS) {
      try {
        const model  = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const raw    = result.response.text().replace(/```json|```/g, '').trim();
        return JSON.parse(raw);
      } catch (err) {
        lastErr = err;
        if (!/503|429|overloaded|high demand|quota/i.test(err.message)) throw err; // non-capacity error → don't retry
        logger.warn(`Gemini model ${modelName} unavailable, trying next`, { error: err.message.slice(0, 100) });
      }
    }
    throw lastErr;
  } catch (err) {
    logger.warn('Gemini enhancement failed — using rule-based suggestions', { error: err.message });
    return null;
  }
};

// ── Main: analyze CV ──────────────────────────────────────────────
export const analyzeCV = async (cvText, userId) => {
  // Cache: same text + same user = same result (24h)
  const cacheKey = `ats:${userId}:${crypto.createHash('sha256').update(cvText).digest('hex').slice(0, 16)}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss is fine */ }

  // 1. Our own engine — deterministic score
  const profile      = await getUserProfileForScoring(userId);
  const engineResult = runATSAnalysis(cvText, profile);

  // 2. Free AI enhancement (suggestions text only — score untouched)
  const aiExtra = await enhanceWithGemini(engineResult, cvText);
  if (aiExtra) {
    if (Array.isArray(aiExtra.improvements) && aiExtra.improvements.length) {
      engineResult.improvements = aiExtra.improvements;
    }
    if (aiExtra.daily_tip)            engineResult.daily_tip = aiExtra.daily_tip;
    if (aiExtra.interview_questions)  engineResult.interview_questions = aiExtra.interview_questions;
    if (aiExtra.expert_summary)       engineResult.expert_summary = aiExtra.expert_summary;
    if (aiExtra.bullet_rewrites)      engineResult.bullet_rewrites = aiExtra.bullet_rewrites;
    if (aiExtra.missing_keywords_categorized) engineResult.missing_keywords_categorized = aiExtra.missing_keywords_categorized;
    if (aiExtra.achievements_section_suggestion) engineResult.achievements_suggestion = aiExtra.achievements_section_suggestion;
    if (aiExtra.recommended_certifications) engineResult.recommended_certifications = aiExtra.recommended_certifications;
    engineResult.suggestions_source = 'gemini-free';
  } else {
    engineResult.daily_tip = engineResult.improvements[0] || 'Keep your CV updated with your latest achievements.';
    engineResult.suggestions_source = 'rule-based';
  }

  try { await setCache(cacheKey, JSON.stringify(engineResult), 86400); } catch { /* non-fatal */ }
  return engineResult;
};
