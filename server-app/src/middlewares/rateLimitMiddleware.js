import rateLimit from "express-rate-limit";

export const shortenRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per IP per minute (adjust as needed)
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
