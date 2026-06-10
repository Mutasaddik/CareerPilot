import { requireAuth } from './authMiddleware.js';

export const requireAdminAccess = [
  requireAuth,
  (req, res, next) => {
    if (!['admin', 'superadmin'].includes(req.user?.role)) {
      // Return 404 not 403 — admin panel must not be detectable
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    next();
  },
];

export const requireSuperAdminAccess = [
  requireAuth,
  (req, res, next) => {
    if (req.user?.role !== 'superadmin') {
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    next();
  },
];

export const requireModeratorAccess = [
  requireAuth,
  (req, res, next) => {
    if (!['moderator', 'admin', 'superadmin'].includes(req.user?.role)) {
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    next();
  },
];
