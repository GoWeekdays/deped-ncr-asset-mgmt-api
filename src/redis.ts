import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType;

import {
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
} from "./config";

export async function initRedisClient() {
  redisClient = await createClient({
    password: REDIS_PASSWORD,
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
  });
}

export function useRedisClient() {
  return redisClient;
}