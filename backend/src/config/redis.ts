import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient: RedisClientType = createClient({
  url: `rediss://:${process.env.UPSTASH_REDIS_PASSWORD}@${process.env.UPSTASH_REDIS_HOST}:${process.env.UPSTASH_REDIS_PORT}`,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Upstash Redis:', new Date().toISOString()));

const connectWithRetry = async () => {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await redisClient.connect();
      console.log('Upstash Redis connected successfully:', new Date().toISOString());
      return;
    } catch (err) {
      console.error(`Redis connection attempt ${attempt} failed:`, err);
      if (attempt === maxRetries) throw new Error('Failed to connect to Upstash Redis');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

connectWithRetry();

export default redisClient;