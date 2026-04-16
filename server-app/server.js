import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { apiRouter, redirectRouter } from "./src/routes/url.js";
import { errorHandler } from "./src/middlewares/errorMiddleware.js";
import redisClient from "./src/utils/redisClient.js";
import logger from "./src/utils/logger.js";
import {
  MONGO_URI,
  ALLOWED_ORIGINS,
  PORT,
  NODE_ENV,
} from "./src/config.js";

const app = express();

// ── Trust reverse proxy (nginx, Cloudflare, etc.) ─────────────────────────────
// Required so req.ip returns the real client IP for rate limiting.
app.set("trust proxy", 1);

// ── Security headers ───────────────────────────────────────────────────────────
app.use(
  helmet({
    // Disable CSP in dev (Vite HMR); let nginx/CDN set it in production
    contentSecurityPolicy: NODE_ENV === "production",
    crossOriginEmbedderPolicy: false,
  })
);

// ── Compression ────────────────────────────────────────────────────────────────
app.use(compression());

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin(origin, cb) {
      // Allow requests with no origin (curl, mobile apps, server-to-server)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  })
);

// ── Body parser — cap at 10 KB to prevent payload attacks ─────────────────────
app.use(express.json({ limit: "10kb" }));

// ── Health check — before routers, always responds even under load ─────────────
app.get("/health", (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  const redisOk = redisClient.status === "ready";
  const status = mongoOk && redisOk ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({
    status,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      mongo: mongoOk ? "connected" : "disconnected",
      redis: redisOk ? "connected" : "disconnected",
    },
  });
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use("/api", apiRouter);

// ── Short-link redirects (root level — must come after /api) ───────────────────
app.use("/", redirectRouter);

// ── Global error handler ───────────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ───────────────────────────────────────────────────────────────────────
const startServer = async () => {
  if (!MONGO_URI) {
    logger.error("MONGO_URI is not configured. Exiting.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info("MongoDB connected");

    await redisClient.ping();
    logger.info("Redis connected");

    const server = app.listen(Number(PORT), () => {
      logger.info(`Server running on port ${PORT} [${NODE_ENV}]`);
    });

    // ── Graceful shutdown ──────────────────────────────────────────────────────
    const shutdown = (signal) => {
      logger.info(`${signal} — graceful shutdown…`);
      server.close(async () => {
        try {
          await mongoose.disconnect();
          await redisClient.quit();
          logger.info("Shutdown complete.");
          process.exit(0);
        } catch (e) {
          logger.error("Shutdown error: %o", e);
          process.exit(1);
        }
      });
      // Force-kill after 10 s if connections don't drain
      setTimeout(() => {
        logger.error("Forced shutdown after timeout.");
        process.exit(1);
      }, 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
  } catch (err) {
    logger.error("Startup failed: %o", err);
    process.exit(1);
  }
};

startServer();
