import dotenv from "dotenv";

dotenv.config();

export const MONGO_URI = process.env.MONGO_URI;
export const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
export const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
export const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6380";
export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || "development";
