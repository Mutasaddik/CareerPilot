import rateLimit from 'express-rate-limit';
import logger from '../services/loggerService.js';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error:   'Too many requests. Please slow down and try again.',
    });
  },
});

// Strict auth rate limiter — 5 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error:   'Too many failed attempts. Please wait 15 minutes before trying again.',
    });
  },
});

// OTP rate limiter
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      3,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    logger.warn('OTP rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      error:   'Too many OTP requests. Please wait 60 seconds.',
    });
  },
});