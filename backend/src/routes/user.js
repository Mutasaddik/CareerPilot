import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getUserProfile, updateUserProfile, updateUserPreferences,
  completeOnboarding, getOnboardingStatus,
  deleteUserAccount, exportUserData,
} from '../services/userService.js';
import { revokeAllUserSessions } from '../services/sessionService.js';
import { getUserContext, buildUserProfile, recalculateUserMatches } from '../services/matchingService.js';
import { classifyOccupation, searchOccupations } from '../services/taxonomyService.js';
import { deleteCachePattern } from '../models/redis.js';
import { query } from '../models/db.js';
import { clearAuthCookies } from '../services/sessionService.js';
import logger from '../services/loggerService.js';

const router = express.Router();
router.use(requireAuth);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// ── Get full profile ──────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    res.json({ success: true, profile });
  } catch (err) {
    logger.error('Get profile error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch profile.' });
  }
});

// ── Update profile ────────────────────────────────────────────────
router.put('/profile', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().isMobilePhone(),
  body('currentTitle').optional().trim().isLength({ max: 100 }),
  body('experienceYears').optional().isInt({ min: 0, max: 50 }),
  body('location').optional().trim().isLength({ max: 100 }),
  body('timezone').optional().trim(),
  body('themePreference').optional().isIn(['dark', 'light']),
], validate, async (req, res) => {
  try {
    const { name, phone, currentTitle, experienceYears, location, timezone, themePreference } = req.body;
    await updateUserProfile(req.user.id, {
      name,
      phone,
      current_title:     currentTitle,
      experience_years:  experienceYears,
      location,
      timezone,
      theme_preference:  themePreference,
    });
    const updated = await getUserProfile(req.user.id);
    res.json({ success: true, message: 'Profile updated.', profile: updated });
  } catch (err) {
    logger.error('Update profile error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
});

// ── Update preferences ────────────────────────────────────────────
router.put('/preferences', async (req, res) => {
  try {
    await updateUserPreferences(req.user.id, req.body);
    res.json({ success: true, message: 'Preferences updated.' });
  } catch (err) {
    logger.error('Update preferences error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to update preferences.' });
  }
});

// ── Onboarding status ─────────────────────────────────────────────
router.get('/onboarding', async (req, res) => {
  try {
    const completed = await getOnboardingStatus(req.user.id);
    res.json({ success: true, completed });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch onboarding status.' });
  }
});

router.post('/onboarding/complete', async (req, res) => {
  try {
    const { preferences } = req.body;
    if (preferences) await updateUserPreferences(req.user.id, preferences);
    await completeOnboarding(req.user.id);
    res.json({ success: true, message: 'Onboarding complete.' });
  } catch (err) {
    logger.error('Complete onboarding error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to complete onboarding.' });
  }
});

// ── Profession: what we match the user as, and their confirmation ──
// GET  /user/role         — current reading (confirmed / chosen / from CV)
// PUT  /user/role         — "Yes, that's me" or a different profession
// GET  /user/role/search  — profession suggestions while typing
router.get('/role', async (req, res) => {
  try {
    const ctx = await getUserContext(req.user.id);
    const profile = buildUserProfile(ctx);
    res.json({
      success:   true,
      confirmed: ctx.confirmed_role || null,
      matched:   profile.userOcc ? profile.userOcc.name : null,  // what jobs are matched to now
      source:    profile.roleSource,                             // 'confirmed' | 'target' | 'cv' | null
      from_cv:   profile.cvOcc ? profile.cvOcc.name : null,      // what the CV alone says
      has_cv:    !!ctx.extracted_text,
      note:      profile.roleNote,
    });
  } catch (err) {
    logger.error('Get role error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to read your profession.' });
  }
});

router.get('/role/search', (req, res) => {
  res.json({ success: true, roles: searchOccupations(String(req.query.q || '').slice(0, 60)) });
});

router.put('/role', [
  body('role').optional({ values: 'null' }).isString().trim().isLength({ min: 2, max: 160 })
    .withMessage('Enter your profession (2–160 characters)'),
], validate, async (req, res) => {
  try {
    const role = req.body.role ? req.body.role.trim() : null;
    await query(
      `INSERT INTO user_profiles (user_id, confirmed_role) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET confirmed_role = $2`,
      [req.user.id, role]
    );
    // Rematch now (well under a second) so the next page load shows the new jobs
    await recalculateUserMatches(req.user.id);
    await deleteCachePattern(`market:${req.user.id}`);
    const occ = role ? classifyOccupation(role) : null;
    res.json({ success: true, confirmed: role, recognised: role ? !!occ : null, matched_as: occ ? occ.name : role });
  } catch (err) {
    logger.error('Confirm role error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to save your profession.' });
  }
});

// ── GDPR — Export data ────────────────────────────────────────────
router.get('/export', async (req, res) => {
  try {
    const data = await exportUserData(req.user.id);
    res.setHeader('Content-Disposition', 'attachment; filename="careerpilot-data.json"');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error('Export data error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to export data.' });
  }
});

// ── GDPR — Delete account ─────────────────────────────────────────
router.delete('/account', async (req, res) => {
  try {
    await revokeAllUserSessions(req.user.id);
    await deleteUserAccount(req.user.id);
    clearAuthCookies(res);
    res.json({ success: true, message: 'Account permanently deleted.' });
  } catch (err) {
    logger.error('Delete account error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to delete account.' });
  }
});

export default router;
