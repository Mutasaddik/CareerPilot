import express from 'express';
import { requireSuperAdminAccess } from '../middleware/adminMiddleware.js';
import {
  getPlatformStats, getAllUsers, getUserById,
  suspendUser, unsuspendUser, deleteUserPermanently,
  createAdminUser, deactivateAdminUser,
  getAuditLogs, getMaintenanceStatus, setMaintenanceMode,
  getScraperHealth, getFeatureFlags, updateFeatureFlag,
  logAudit,
} from '../services/adminService.js';
import logger from '../services/loggerService.js';

const router = express.Router();

router.use(requireSuperAdminAccess);

// ── Dashboard stats ───────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await getPlatformStats();
    res.json({ success: true, stats });
  } catch (err) {
    logger.error('SuperAdmin stats error', { error: err.message });
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

router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account.' });
    }
    await deleteUserPermanently(req.params.id);
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: 'delete_user', targetType: 'user', targetId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, message: 'User permanently deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete user.' });
  }
});

// ── Admin management ──────────────────────────────────────────────
router.post('/admins', async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!['admin', 'moderator'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role. Must be admin or moderator.' });
    }
    await createAdminUser(userId, role, req.user.id);
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: `create_${role}`, targetType: 'user', targetId: userId,
      newValue: { role },
      ip: req.ip,
    });
    res.json({ success: true, message: `${role} created successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create admin.' });
  }
});

router.delete('/admins/:userId', async (req, res) => {
  try {
    await deactivateAdminUser(req.params.userId);
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: 'deactivate_admin', targetType: 'user', targetId: req.params.userId,
      ip: req.ip,
    });
    res.json({ success: true, message: 'Admin deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to deactivate admin.' });
  }
});

// ── Maintenance mode ──────────────────────────────────────────────
router.get('/maintenance', async (req, res) => {
  try {
    const status = await getMaintenanceStatus();
    res.json({ success: true, maintenance: status });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch maintenance status.' });
  }
});

router.post('/maintenance', async (req, res) => {
  try {
    const { enabled, message } = req.body;
    await setMaintenanceMode(
      enabled,
      req.user.id,
      message || 'CareerPilot is temporarily down for maintenance.'
    );
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: enabled ? 'enable_maintenance' : 'disable_maintenance',
      targetType: 'system', targetId: null,
      ip: req.ip,
    });
    res.json({ success: true, message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update maintenance mode.' });
  }
});

// ── Feature flags ─────────────────────────────────────────────────
router.get('/feature-flags', async (req, res) => {
  try {
    const flags = await getFeatureFlags();
    res.json({ success: true, flags });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch feature flags.' });
  }
});

router.patch('/feature-flags/:featureName', async (req, res) => {
  try {
    const { isProOnly, isEnabled } = req.body;
    await updateFeatureFlag(req.params.featureName, isProOnly, isEnabled);
    await logAudit({
      performedBy: req.user.id, role: req.user.role,
      action: 'update_feature_flag', targetType: 'feature_flag',
      targetId: null, newValue: { featureName: req.params.featureName, isProOnly, isEnabled },
      ip: req.ip,
    });
    res.json({ success: true, message: 'Feature flag updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update feature flag.' });
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

// ── Audit logs (all) ──────────────────────────────────────────────
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await getAuditLogs({ page: parseInt(page), limit: parseInt(limit) });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs.' });
  }
});

export default router;
