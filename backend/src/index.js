import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { createServer } from 'http';
import logger from './services/loggerService.js';
import { testConnection as testDB } from './models/db.js';
import { testConnection as testRedis } from './models/redis.js';
import { generalLimiter } from './middleware/rateLimiter.js';

import healthRouter      from './routes/health.js';
import maintenanceRouter from './routes/maintenance.js';
import authRouter        from './routes/auth.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.path === '/api/v1/health',
}));
app.use(generalLimiter);

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/v1/health',       healthRouter);
app.use('/api/v1/maintenance',  maintenanceRouter);
app.use('/api/v1/auth',         authRouter);

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', path: req.originalUrl });
});

// ── Global error handler ─────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(err.message, {
    stack: err.stack,
    user_id: req.user?.id || null,
    route: `${req.method} ${req.originalUrl}`,
    ip: req.ip,
  });
  const status = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';
  res.status(status).json({
    success: false,
    error: status === 500 ? 'Something went wrong. Please try again.' : err.message,
    ...(isDev && { stack: err.stack }),
  });
});

// ── Startup ───────────────────────────────────────────────────────
const start = async () => {
  logger.info('Starting CareerPilot backend...');
  const dbOk    = await testDB();
  const redisOk = await testRedis();
  if (!dbOk)    { logger.error('PostgreSQL unavailable'); process.exit(1); }
  if (!redisOk) { logger.error('Redis unavailable');      process.exit(1); }
  httpServer.listen(PORT, () => {
    logger.info(`CareerPilot API running on port ${PORT}`, {
      env: process.env.NODE_ENV,
      url: `http://localhost:${PORT}`,
    });
  });
};

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: String(reason) });
});
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  httpServer.close(() => process.exit(0));
});

start();
export { app, httpServer };
