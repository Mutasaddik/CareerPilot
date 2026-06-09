import express from 'express';
import { body, validationResult } from 'express-validator';
import {
  createUser, findUserByEmail, findUserById,
  markUserVerified, updateUserPassword, createUserProfile,
  getUserAdminRole, comparePassword
} from '../services/authService.js';
import { createOTP, verifyOTP, resendOTP } from '../services/otpService.js';
import {
  generateTokens, setAuthCookies, clearAuthCookies,
  createSession, revokeSession, isKnownDevice
} from '../services/sessionService.js';
import { sendOTPEmail, sendWelcomeEmail } from '../services/emailService.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import logger from '../services/loggerService.js';

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ── Register ──────────────────────────────────────────────────────
router.post('/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phone').optional().isMobilePhone(),
    body('currentTitle').optional().trim().isLength({ max: 100 }),
    body('experienceYears').optional().isInt({ min: 0, max: 50 }),
    body('location').optional().trim().isLength({ max: 100 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, email, password, phone, currentTitle, experienceYears, location } = req.body;

      const existing = await findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      }

      const user = await createUser({ name, email, password, phone, currentTitle, experienceYears, location });
      await createUserProfile(user.id);

      const otp = await createOTP(email, 'registration', user.id);
      await sendOTPEmail(email, otp, 'registration');

      logger.info('User registered', { userId: user.id, email });

      res.status(201).json({
        success: true,
        message: 'Account created. Please check your email for the verification code.',
        email,
        userId: user.id,
      });
    } catch (err) {
      logger.error('Register error', { error: err.message });
      res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
    }
  }
);

// ── Verify OTP ───────────────────────────────────────────────────
router.post('/verify-otp',
  otpLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
    body('purpose').isIn(['registration', 'login', 'forgot_password', 'new_device']),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, otp, purpose } = req.body;

      const result = await verifyOTP(email, otp, purpose);
      if (!result.valid) {
        return res.status(400).json({ success: false, error: result.reason });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      if (purpose === 'registration' || purpose === 'new_device') {
        await markUserVerified(user.id);
      }

      if (purpose === 'registration') {
        await sendWelcomeEmail(email, user.name);
      }

      if (purpose !== 'forgot_password') {
        const adminRole = await getUserAdminRole(user.id);
        const role = adminRole || 'user';
        const { accessToken, refreshToken } = generateTokens(user.id, role);
        setAuthCookies(res, accessToken, refreshToken);

        await createSession(user.id, {
          deviceInfo: req.headers['user-agent'] || 'unknown',
          ipAddress:  req.ip,
          location:   req.headers['x-forwarded-for'] || req.ip,
        });

        const redirectMap = {
          superadmin: '/superadmin/dashboard',
          admin:      '/admin/dashboard',
          moderator:  '/moderator/dashboard',
          user:       '/dashboard',
        };

        return res.json({
          success: true,
          message: 'Verified successfully.',
          user: {
            id: user.id, name: user.name, email: user.email,
            plan: user.plan, role, is_verified: true,
            theme_preference: user.theme_preference,
            timezone: user.timezone,
          },
          redirect: redirectMap[role] || '/dashboard',
        });
      }

      // For forgot_password — just confirm OTP is valid, redirect to reset
      res.json({ success: true, message: 'OTP verified. You may now reset your password.', email });

    } catch (err) {
      logger.error('Verify OTP error', { error: err.message });
      res.status(500).json({ success: false, error: 'Verification failed. Please try again.' });
    }
  }
);

// ── Resend OTP ───────────────────────────────────────────────────
router.post('/resend-otp',
  otpLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('purpose').isIn(['registration', 'login', 'forgot_password', 'new_device']),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, purpose } = req.body;

      const user = await findUserByEmail(email);

      const result = await resendOTP(email, purpose, user?.id);
      if (!result.allowed) {
        return res.status(429).json({ success: false, error: result.reason });
      }

      await sendOTPEmail(email, result.otp, purpose);

      res.json({ success: true, message: 'New verification code sent to your email.' });
    } catch (err) {
      logger.error('Resend OTP error', { error: err.message });
      res.status(500).json({ success: false, error: 'Failed to resend OTP. Please try again.' });
    }
  }
);

// ── Login ────────────────────────────────────────────────────────
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await findUserByEmail(email);
      if (!user || !user.password_hash) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      if (!user.is_verified) {
        const otp = await createOTP(email, 'registration', user.id);
        await sendOTPEmail(email, otp, 'registration');
        return res.status(403).json({
          success: false,
          error: 'Email not verified. A new verification code has been sent.',
          needsVerification: true,
          email,
        });
      }

      // Check if new device
      const knownDevice = await isKnownDevice(user.id, req.ip);
      if (!knownDevice) {
        const otp = await createOTP(email, 'new_device', user.id);
        await sendOTPEmail(email, otp, 'new_device');
        return res.status(200).json({
          success: true,
          needsOTP: true,
          message: 'New device detected. Please check your email for a verification code.',
          email,
        });
      }

      const adminRole = await getUserAdminRole(user.id);
      const role = adminRole || 'user';
      const { accessToken, refreshToken } = generateTokens(user.id, role);
      setAuthCookies(res, accessToken, refreshToken);

      await createSession(user.id, {
        deviceInfo: req.headers['user-agent'] || 'unknown',
        ipAddress:  req.ip,
        location:   req.headers['x-forwarded-for'] || req.ip,
      });

      const redirectMap = {
        superadmin: '/superadmin/dashboard',
        admin:      '/admin/dashboard',
        moderator:  '/moderator/dashboard',
        user:       '/dashboard',
      };

      logger.info('User logged in', { userId: user.id, email });

      res.json({
        success: true,
        message: 'Logged in successfully.',
        user: {
          id: user.id, name: user.name, email: user.email,
          plan: user.plan, role, is_verified: user.is_verified,
          theme_preference: user.theme_preference,
          timezone: user.timezone,
          avatar_url: user.avatar_url,
        },
        redirect: redirectMap[role] || '/dashboard',
      });
    } catch (err) {
      logger.error('Login error', { error: err.message });
      res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
    }
  }
);

// ── Forgot Password ──────────────────────────────────────────────
router.post('/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await findUserByEmail(email);

      // Always return success to prevent email enumeration
      if (user) {
        const otp = await createOTP(email, 'forgot_password', user.id);
        await sendOTPEmail(email, otp, 'forgot_password');
      }

      res.json({
        success: true,
        message: 'If an account exists with this email, a reset code has been sent.',
        email,
      });
    } catch (err) {
      logger.error('Forgot password error', { error: err.message });
      res.status(500).json({ success: false, error: 'Failed to process request. Please try again.' });
    }
  }
);

// ── Reset Password ───────────────────────────────────────────────
router.post('/reset-password',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      const result = await verifyOTP(email, otp, 'forgot_password');
      if (!result.valid) {
        return res.status(400).json({ success: false, error: result.reason });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      await updateUserPassword(user.id, newPassword);
      await revokeSession(user.id);

      logger.info('Password reset', { userId: user.id });

      res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
    } catch (err) {
      logger.error('Reset password error', { error: err.message });
      res.status(500).json({ success: false, error: 'Password reset failed. Please try again.' });
    }
  }
);

// ── Get current user ─────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── Logout ───────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await revokeSession(req.user.id);
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    res.status(500).json({ success: false, error: 'Logout failed.' });
  }
});

// ── Refresh token ────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'No refresh token.' });
    }

    const { verifyRefreshToken } = await import('../services/sessionService.js');
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token.' });
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    const adminRole = await getUserAdminRole(user.id);
    const role = adminRole || 'user';
    const { accessToken: newAccess, refreshToken: newRefresh } = generateTokens(user.id, role);
    setAuthCookies(res, newAccess, newRefresh);

    res.json({ success: true, message: 'Token refreshed.' });
  } catch (err) {
    logger.error('Refresh error', { error: err.message });
    res.status(500).json({ success: false, error: 'Token refresh failed.' });
  }
});

export default router;
