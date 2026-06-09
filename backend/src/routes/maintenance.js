import express from 'express';
import { query } from '../models/db.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const result = await query('SELECT is_enabled, message FROM maintenance_mode LIMIT 1');
    const row = result.rows[0] || { is_enabled: false, message: '' };
    res.json({ success: true, maintenance: row.is_enabled, message: row.message });
  } catch {
    res.json({ success: true, maintenance: false, message: '' });
  }
});

export default router;