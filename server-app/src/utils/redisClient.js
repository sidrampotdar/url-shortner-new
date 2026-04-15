import Redis from "ioredis";
import { REDIS_URL } from "../config.js";

const redisClient = new Redis(REDIS_URL);

redisClient.on("connect", () => {
  console.log("✅ Redis Connected");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

export default redisClient;
