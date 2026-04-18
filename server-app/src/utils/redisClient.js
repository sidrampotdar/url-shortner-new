import Redis from "ioredis";
import { REDIS_URL } from "../config.js";
import logger from "./logger.js";

const redisClient = new Redis(REDIS_URL);

redisClient.on("connect", () => {
  logger.info("Redis connected");
});

redisClient.on("error", (err) => {
  logger.error("Redis error: %o", err);
});

export default redisClient;
