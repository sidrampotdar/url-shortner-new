import dotenv from "dotenv";
dotenv.config();

export const MONGO_URI = process.env.MONGO_URI;
export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
export const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
export const SHORT_ID_LENGTH = Number(process.env.SHORT_ID_LENGTH) || 7;

// Comma-separated list of allowed origins, e.g.
// ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];
