import Redis from 'ioredis';
import logger from '../services/loggerService.js';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis reconnecting... attempt ${times}`);
    return delay;
  },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('ready', () => logger.info('Redis ready'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

export const getCache = async (key) => {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value);
  } catch (err) {
    logger.error('Cache get error', { key, error: err.message });
    return null;
  }
};

export const setCache = async (key, value, ttlSeconds) => {
  try {
    const ttl = Math.max(Math.floor(ttlSeconds), 1); // already in seconds
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.error('Cache set error', { key, error: err.message });
  }
};

export const deleteCache = async (key) => {
  try {
    await redis.del(key);
  } catch (err) {
    logger.error('Cache delete error', { key, error: err.message });
  }
};

export const deleteCachePattern = async (pattern) => {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    logger.error('Cache pattern delete error', { pattern, error: err.message });
  }
};

export const testConnection = async () => {
  try {
    await redis.ping();
    logger.info('Redis ping successful');
    return true;
  } catch (err) {
    logger.error('Redis ping failed', { error: err.message });
    return false;
  }
};

export default redis;