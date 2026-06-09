import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../models/db.js';
import logger from './loggerService.js';

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '60d';

export const generateTokens = (userId, role) => {
  const payload = { userId, role };

  const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch {
    return null;
  }
};

export const createSession = async (userId, { deviceInfo, ipAddress, location }) => {
  const sessionToken = crypto.randomUUID();
  const sessionTokenHash = await bcrypt.hash(sessionToken, 10);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);

  await query(
    `INSERT INTO sessions (user_id, session_token_hash, device_info, ip_address, location, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, sessionTokenHash, deviceInfo, ipAddress, location, expiresAt]
  );

  return sessionToken;
};

export const revokeSession = async (userId) => {
  await query(
    `UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE`,
    [userId]
  );
};

export const revokeAllUserSessions = async (userId) => {
  await query(
    `UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1`,
    [userId]
  );
};

export const isKnownDevice = async (userId, ipAddress) => {
  const result = await query(
    `SELECT id FROM sessions
     WHERE user_id = $1 AND ip_address = $2 AND is_revoked = FALSE AND expires_at > NOW()
     LIMIT 1`,
    [userId, ipAddress]
  );
  return result.rows.length > 0;
};

export const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
  });
};

export const clearAuthCookies = (res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
};