import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getUserProfile, updateUserProfile, updateUserPreferences,
  completeOnboarding, getOnboardingStatus,
  deleteUserAccount, exportUserData,
} from '../services/userService.js';
import { revokeAllUserSessions } from '../services/sessionService.js';
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
