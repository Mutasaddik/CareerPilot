import express from 'express';
import { requireAdminAccess } from '../middleware/adminMiddleware.js';
import {
  getPlatformStats, getAllUsers, getUserById,
  suspendUser, unsuspendUser, getAuditLogs,
  getScraperHealth, getFeatureFlags, logAudit,
} from '../services/adminService.js';
import logger from '../services/loggerService.js';

const router = express.Router();

// All routes require admin access
router.use(requireAdminAccess);

// ── Dashboard stats ───────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await getPlatformStats();
    res.json({ success: true, stats });
  } catch (err) {
    logger.error('Admin stats error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
  }
});

// ── User management ───────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const result = await getAllUsers({ page: parseInt(page), limit: parseInt(limit), search });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Admin get users error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch users.' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user.' });
  }
});

router.post('/users/:id/suspend', async (req, res) => {
  try {
    await suspendUser(req.params.id);
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: 'suspend_user', targetType: 'user', targetId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, message: 'User suspended.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to suspend user.' });
  }
});

router.post('/users/:id/unsuspend', async (req, res) => {
  try {
    await unsuspendUser(req.params.id);
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: 'unsuspend_user', targetType: 'user', targetId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, message: 'User unsuspended.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to unsuspend user.' });
  }
});

// ── Scraper health ────────────────────────────────────────────────
router.get('/scrapers', async (req, res) => {
  try {
    const scrapers = await getScraperHealth();
    res.json({ success: true, scrapers });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch scraper health.' });
  }
});

// ── Feature flags (view only for admin) ──────────────────────────
router.get('/feature-flags', async (req, res) => {
  try {
    const flags = await getFeatureFlags();
    res.json({ success: true, flags });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch feature flags.' });
  }
});

// ── Audit logs (own actions only for admin) ───────────────────────
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const performedBy = req.user.role === 'admin' ? req.user.id : null;
    const result = await getAuditLogs({ page: parseInt(page), limit: parseInt(limit), performedBy });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs.' });
  }
});

export default router;
