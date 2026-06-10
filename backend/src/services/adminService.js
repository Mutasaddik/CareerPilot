import { query } from '../models/db.js';
import logger from './loggerService.js';

// ── Audit logging ─────────────────────────────────────────────────
export const logAudit = async ({ performedBy, role, action, targetType, targetId, oldValue, newValue, ip }) => {
  try {
    await query(
      `INSERT INTO audit_logs
        (performed_by_user_id, performed_by_role, action, target_type, target_id, old_value_json, new_value_json, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [performedBy, role, action, targetType, targetId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ip]
    );
  } catch (err) {
    logger.error('Audit log failed', { error: err.message });
  }
};

// ── Platform stats ────────────────────────────────────────────────
export const getPlatformStats = async () => {
  const [users, activeToday, newToday, admins] = await Promise.all([
    query(`SELECT COUNT(*) FROM users`),
    query(`SELECT COUNT(DISTINCT user_id) FROM sessions WHERE created_at > NOW() - INTERVAL '24 hours' AND is_revoked = FALSE`),
    query(`SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'`),
    query(`SELECT COUNT(*) FROM admin_users WHERE is_active = TRUE`),
  ]);

  return {
    totalUsers:    parseInt(users.rows[0].count),
    activeToday:   parseInt(activeToday.rows[0].count),
    newToday:      parseInt(newToday.rows[0].count),
    totalAdmins:   parseInt(admins.rows[0].count),
  };
};

// ── User management ───────────────────────────────────────────────
export const getAllUsers = async ({ page = 1, limit = 20, search = '' }) => {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;

  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.plan, u.is_verified,
            u.created_at, u.avatar_url, u.current_title, u.location,
            a.role as admin_role
     FROM users u
     LEFT JOIN admin_users a ON a.user_id = u.id AND a.is_active = TRUE
     WHERE u.name ILIKE $1 OR u.email ILIKE $1
     ORDER BY u.created_at DESC
     LIMIT $2 OFFSET $3`,
    [searchParam, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM users WHERE name ILIKE $1 OR email ILIKE $1`,
    [searchParam]
  );

  return {
    users: result.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    limit,
  };
};

export const getUserById = async (userId) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.plan, u.is_verified,
            u.created_at, u.avatar_url, u.current_title, u.location,
            u.experience_years, u.timezone, u.theme_preference,
            a.role as admin_role
     FROM users u
     LEFT JOIN admin_users a ON a.user_id = u.id AND a.is_active = TRUE
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

export const suspendUser = async (userId) => {
  await query(
    `UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1`,
    [userId]
  );
  await query(
    `UPDATE users SET is_verified = FALSE WHERE id = $1`,
    [userId]
  );
};

export const unsuspendUser = async (userId) => {
  await query(
    `UPDATE users SET is_verified = TRUE WHERE id = $1`,
    [userId]
  );
};

export const deleteUserPermanently = async (userId) => {
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
};

// ── Admin user management ─────────────────────────────────────────
export const createAdminUser = async (userId, role, createdBy) => {
  const existing = await query(`SELECT id FROM admin_users WHERE user_id = $1`, [userId]);
  if (existing.rows.length > 0) {
    await query(
      `UPDATE admin_users SET role = $1, is_active = TRUE, created_by = $2 WHERE user_id = $3`,
      [role, createdBy, userId]
    );
  } else {
    await query(
      `INSERT INTO admin_users (user_id, role, created_by) VALUES ($1, $2, $3)`,
      [userId, role, createdBy]
    );
  }
};

export const deactivateAdminUser = async (userId) => {
  await query(`UPDATE admin_users SET is_active = FALSE WHERE user_id = $1`, [userId]);
};

// ── Audit logs ────────────────────────────────────────────────────
export const getAuditLogs = async ({ page = 1, limit = 50, performedBy = null }) => {
  const offset = (page - 1) * limit;

  let queryStr = `
    SELECT a.*, u.name as performer_name, u.email as performer_email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.performed_by_user_id
  `;
  const params = [];

  if (performedBy) {
    queryStr += ` WHERE a.performed_by_user_id = $1`;
    params.push(performedBy);
  }

  queryStr += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(queryStr, params);

  const countResult = await query(
    `SELECT COUNT(*) FROM audit_logs ${performedBy ? 'WHERE performed_by_user_id = $1' : ''}`,
    performedBy ? [performedBy] : []
  );

  return {
    logs:  result.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    limit,
  };
};

// ── Maintenance mode ──────────────────────────────────────────────
export const getMaintenanceStatus = async () => {
  const result = await query(`SELECT * FROM maintenance_mode LIMIT 1`);
  return result.rows[0];
};

export const setMaintenanceMode = async (enabled, enabledBy, message) => {
  await query(
    `UPDATE maintenance_mode SET is_enabled = $1, enabled_by = $2, message = $3, enabled_at = $4`,
    [enabled, enabledBy, message, enabled ? new Date() : null]
  );
};

// ── Scraper health ────────────────────────────────────────────────
export const getScraperHealth = async () => {
  const result = await query(
    `SELECT DISTINCT ON (source) source, started_at, finished_at, jobs_found, status, error_message, consecutive_failures
     FROM scraper_logs
     ORDER BY source, started_at DESC`
  );
  return result.rows;
};

// ── Feature flags ─────────────────────────────────────────────────
export const getFeatureFlags = async () => {
  const result = await query(`SELECT * FROM feature_flags ORDER BY feature_name`);
  return result.rows;
};

export const updateFeatureFlag = async (featureName, isProOnly, isEnabled) => {
  await query(
    `UPDATE feature_flags SET is_pro_only = $1, is_enabled = $2, updated_at = NOW()
     WHERE feature_name = $3`,
    [isProOnly, isEnabled, featureName]
  );
};
