import rateLimit from "express-rate-limit";

const make = (max, windowMs, message) =>
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // keyGenerator uses req.ip (works correctly after `trust proxy` is set)
  });

// Shorten: 15 requests / minute / IP
export const shortenRateLimiter = make(
  15,
  60_000,
  "Too many shorten requests. Please wait a minute."
);

// Stats: 60 requests / minute / IP
export const statsRateLimiter = make(
  60,
  60_000,
  "Too many stats requests. Please wait a minute."
);

// Redirect: 300 requests / minute / IP — generous for real users / bots
export const redirectRateLimiter = make(
  300,
  60_000,
  "Too many requests."
);
