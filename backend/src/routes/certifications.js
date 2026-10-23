import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getCertificationsForUser } from '../services/certificationService.js';
import logger from '../services/loggerService.js';

const router = express.Router();
router.use(requireAuth);

// ── GET /certifications/me — certifications for the user's profession ──
router.get('/me', async (req, res) => {
  try {
    res.json({ success: true, ...(await getCertificationsForUser(req.user.id)) });
  } catch (err) {
    logger.error('Certifications error', { error: err.message, userId: req.user.id });
    res.status(500).json({ success: false, error: 'Failed to load certifications.' });
  }
});

export default router;
