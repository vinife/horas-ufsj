import { createClient, type RedisClientType } from "redis";

type GlobalForRedis = {
  redis?: RedisClientType;
};

const globalForRedis = globalThis as unknown as GlobalForRedis;

export const redis =
  globalForRedis.redis ??
  createClient({
    url: process.env.REDIS_URL,
  });

redis.on("error", (err) => {
  console.error("Redis Client Error", err);
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export async function getRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}
