import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../../logs');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

const fileFormat = combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), json());

const consoleTransport = new winston.transports.Console({
  format: combine(colorize({ all: true }), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), consoleFormat),
});

const generalFileTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  format: fileFormat,
  zippedArchive: true,
});

const errorFileTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  format: fileFormat,
  zippedArchive: true,
});

const scraperFileTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'scraper-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '14d',
  format: fileFormat,
  zippedArchive: true,
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [consoleTransport, generalFileTransport, errorFileTransport],
  exitOnError: false,
});

export const scraperLogger = winston.createLogger({
  level: 'info',
  transports: [scraperFileTransport, consoleTransport],
  exitOnError: false,
});

export const logError = (err, req = null) => {
  const meta = req ? { user_id: req.user?.id || null, route: `${req.method} ${req.originalUrl}`, ip: req.ip } : {};
  logger.error(err.message, { stack: err.stack, ...meta });
};

export default logger;