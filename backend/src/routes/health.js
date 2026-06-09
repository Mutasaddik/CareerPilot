import express from 'express';
import { query } from '../models/db.js';
import redis from '../models/redis.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const checks = {
    api: 'ok',
    database: 'unknown',
    redis: 'unknown',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  };
  try { await query('SELECT 1'); checks.database = 'ok'; } catch { checks.database = 'error'; }
  try { await redis.ping(); checks.redis = 'ok'; } catch { checks.redis = 'error'; }
  const allOk = checks.database === 'ok' && checks.redis === 'ok';
  res.status(allOk ? 200 : 503).json({ success: allOk, checks });
});

export default router;