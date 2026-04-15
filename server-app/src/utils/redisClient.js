import Redis from "ioredis";

const redisClient = new Redis("redis://127.0.0.1:6380");

redisClient.on("connect", () => {
  console.log("✅ Redis Connected");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

export default redisClient;
