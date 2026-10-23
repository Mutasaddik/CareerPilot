import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getMarketUpdate } from '../services/marketService.js';
import logger from '../services/loggerService.js';

const router = express.Router();
router.use(requireAuth);

// ── GET /market/me — market update for the user's own role ────────
router.get('/me', async (req, res) => {
  try {
    res.json({ success: true, market: await getMarketUpdate(req.user.id) });
  } catch (err) {
    logger.error('Market update error', { error: err.message, userId: req.user.id });
    res.status(500).json({ success: false, error: 'Failed to load market data.' });
  }
});

export default router;
