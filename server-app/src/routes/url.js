import express from "express";
import { shorten, redirect, stats } from "../controllers/urlController.js";
import {
  shortenRateLimiter,
  statsRateLimiter,
  redirectRateLimiter,
} from "../middlewares/rateLimitMiddleware.js";

// /api/* — JSON API routes
export const apiRouter = express.Router();
apiRouter.post("/shorten", shortenRateLimiter, shorten);
apiRouter.get("/stats/:shortId", statsRateLimiter, stats);

// /* — short-link redirect routes (mounted at root)
export const redirectRouter = express.Router();
redirectRouter.get("/:shortId", redirectRateLimiter, redirect);
