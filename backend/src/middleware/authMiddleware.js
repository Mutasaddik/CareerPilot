import { verifyAccessToken, verifyRefreshToken, generateTokens, setAuthCookies } from '../services/sessionService.js';
import { findUserById, getUserAdminRole } from '../services/authService.js';
import logger from '../services/loggerService.js';

// Protect any route — requires valid access token
export const requireAuth = async (req, res, next) => {
  try {
    const accessToken  = req.cookies?.access_token;
    const refreshToken = req.cookies?.refresh_token;

    if (!accessToken && !refreshToken) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    let payload = null;

    // Try access token first
    if (accessToken) {
      payload = verifyAccessToken(accessToken);
    }

    // Access token expired — try refresh token
    if (!payload && refreshToken) {
      const refreshPayload = verifyRefreshToken(refreshToken);
      if (!refreshPayload) {
        return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
      }

      // Issue new tokens silently
      const role = await getUserAdminRole(refreshPayload.userId);
      const { accessToken: newAccess, refreshToken: newRefresh } = generateTokens(refreshPayload.userId, role);
      setAuthCookies(res, newAccess, newRefresh);
      payload = refreshPayload;
    }

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid session. Please log in again.' });
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ success: false, error: 'Please verify your email first.', needsVerification: true });
    }

    const adminRole = await getUserAdminRole(user.id);
    req.user = { ...user, role: adminRole || 'user' };
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    res.status(500).json({ success: false, error: 'Authentication error.' });
  }
};

// Optional auth — attaches user if logged in but does not block
export const optionalAuth = async (req, res, next) => {
  try {
    const accessToken = req.cookies?.access_token;
    if (!accessToken) return next();

    const payload = verifyAccessToken(accessToken);
    if (!payload) return next();

    const user = await findUserById(payload.userId);
    if (user) {
      const adminRole = await getUserAdminRole(user.id);
      req.user = { ...user, role: adminRole || 'user' };
    }
    next();
  } catch {
    next();
  }
};

// Role guards
export const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(404).json({ success: false, error: 'Not found.' });
  }
  next();
};

export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(404).json({ success: false, error: 'Not found.' });
  }
  next();
};

export const requireModerator = (req, res, next) => {
  if (!req.user || !['moderator', 'admin', 'superadmin'].includes(req.user.role)) {
    return res.status(404).json({ success: false, error: 'Not found.' });
  }
  next();
};
