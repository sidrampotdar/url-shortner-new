import express from "express";
import { shorten, redirect } from "../controllers/urlController.js";
import { shortenRateLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

router.post("/shorten", shortenRateLimiter, shorten);
router.get("/:shortId", redirect);

export default router;
