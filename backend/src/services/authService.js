import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../models/db.js';
import logger from './loggerService.js';

export const hashPassword = async (password) => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const createUser = async ({ name, email, password, phone, currentTitle, experienceYears, location, oauthProvider, oauthId }) => {
  const passwordHash = password ? await hashPassword(password) : null;

  const result = await query(
    `INSERT INTO users (name, email, password_hash, phone, current_title, experience_years, location, oauth_provider, oauth_id, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, name, email, phone, current_title, experience_years, location, plan, oauth_provider, is_verified, theme_preference, timezone, created_at`,
    [name, email, passwordHash, phone || null, currentTitle || null, experienceYears || null, location || null, oauthProvider || null, oauthId || null, oauthProvider ? true : false]
  );

  return result.rows[0];
};

export const findUserByEmail = async (email) => {
  const result = await query(
    `SELECT id, name, email, password_hash, phone, current_title, experience_years, location, avatar_url, plan, oauth_provider, oauth_id, is_verified, theme_preference, timezone, created_at
     FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

export const findUserById = async (id) => {
  const result = await query(
    `SELECT id, name, email, phone, current_title, experience_years, location, avatar_url, plan, oauth_provider, is_verified, theme_preference, timezone, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

export const findUserByOAuth = async (provider, oauthId) => {
  const result = await query(
    `SELECT id, name, email, phone, current_title, experience_years, location, avatar_url, plan, oauth_provider, oauth_id, is_verified, theme_preference, timezone, created_at
     FROM users WHERE oauth_provider = $1 AND oauth_id = $2`,
    [provider, oauthId]
  );
  return result.rows[0] || null;
};

export const markUserVerified = async (userId) => {
  await query('UPDATE users SET is_verified = TRUE WHERE id = $1', [userId]);
};

export const updateUserPassword = async (userId, newPassword) => {
  const passwordHash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
};

export const updateUserProfile = async (userId, fields) => {
  const allowed = ['name', 'phone', 'current_title', 'experience_years', 'location', 'avatar_url', 'theme_preference', 'timezone'];
  const updates = [];
  const values = [];
  let i = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }

  if (updates.length === 0) return;
  values.push(userId);

  await query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i}`,
    values
  );
};

export const createUserProfile = async (userId) => {
  await query(
    `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
};

export const getUserAdminRole = async (userId) => {
  const result = await query(
    `SELECT role FROM admin_users WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );
  return result.rows[0]?.role || null;
};
