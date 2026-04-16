import Url from "../models/Url.js";
import { nanoid } from "nanoid";
import qrcode from "qrcode";
import redisClient from "../utils/redisClient.js";
import { BASE_URL, SHORT_ID_LENGTH } from "../config.js";
import { validateSafeUrl } from "../utils/validateUrl.js";

const CACHE_TTL = 86400; // 24 h (seconds)
const ALIAS_RE = /^[a-zA-Z0-9_-]{3,30}$/;

const EXPIRY_MS = {
  "1d":  1 * 24 * 60 * 60 * 1000,
  "7d":  7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "1y":  365 * 24 * 60 * 60 * 1000,
};

// Reserved paths that must not be used as short IDs / aliases
const RESERVED = new Set(["api", "health", "shorten", "stats", "admin", "login", "signup"]);

function bad(msg, status = 400) {
  const e = new Error(msg);
  e.status = status;
  throw e;
}

async function generateShortId() {
  let shortId;
  let exists = true;
  let attempts = 0;
  while (exists) {
    if (++attempts > 10) bad("Failed to generate a unique ID — try again", 500);
    shortId = nanoid(SHORT_ID_LENGTH);
    exists = !!(await Url.exists({ shortId }));
  }
  return shortId;
}

// ---------- Public API ----------

export const shortenUrl = async (originalUrl, { alias, expiry } = {}) => {
  // 1. SSRF check
  validateSafeUrl(originalUrl);

  // 2. Custom alias validation
  if (alias) {
    alias = alias.trim().toLowerCase();
    if (!ALIAS_RE.test(alias)) {
      bad("Alias must be 3–30 chars: letters, numbers, - or _");
    }
    if (RESERVED.has(alias)) bad("That alias is reserved");
    if (await Url.exists({ shortId: alias })) bad("Alias already taken", 409);
  }

  // 3. Expiry
  let expiresAt = null;
  if (expiry && EXPIRY_MS[expiry]) {
    expiresAt = new Date(Date.now() + EXPIRY_MS[expiry]);
  }

  // 4. For plain (no alias, no expiry) requests: deduplicate
  if (!alias && !expiresAt) {
    const cached = await redisClient.get(`orig:${originalUrl}`);
    if (cached) return JSON.parse(cached);

    const existing = await Url.findOne({ originalUrl, isCustomAlias: false, expiresAt: null });
    if (existing) {
      const shortUrl = `${BASE_URL}/${existing.shortId}`;
      const qrCode = await qrcode.toDataURL(shortUrl);
      const result = { shortId: existing.shortId, shortUrl, qrCode, expiresAt: null };
      await redisClient.set(`orig:${originalUrl}`, JSON.stringify(result), "EX", CACHE_TTL);
      return result;
    }
  }

  // 5. Create
  const shortId = alias ?? (await generateShortId());
  await Url.create({ shortId, originalUrl, isCustomAlias: !!alias, expiresAt });

  const shortUrl = `${BASE_URL}/${shortId}`;
  const qrCode = await qrcode.toDataURL(shortUrl);
  const result = { shortId, shortUrl, qrCode, expiresAt };

  // 6. Cache non-expiring links
  if (!expiresAt) {
    await redisClient.set(`id:${shortId}`, originalUrl, "EX", CACHE_TTL);
    if (!alias) {
      await redisClient.set(`orig:${originalUrl}`, JSON.stringify(result), "EX", CACHE_TTL);
    }
  } else {
    const ttlSec = Math.floor((expiresAt - Date.now()) / 1000);
    if (ttlSec > 0) {
      await redisClient.set(`id:${shortId}`, originalUrl, "EX", ttlSec);
    }
  }

  return result;
};

export const redirectUrl = async (shortId) => {
  // Fast path: Redis
  let originalUrl = await redisClient.get(`id:${shortId}`);

  if (!originalUrl) {
    const doc = await Url.findOne({ shortId });
    if (!doc) return null;

    // Expired (belt-and-suspenders — TTL index removes the doc, but handle race)
    if (doc.expiresAt && doc.expiresAt < new Date()) return null;

    originalUrl = doc.originalUrl;

    // Re-cache
    const ttlSec = doc.expiresAt
      ? Math.floor((doc.expiresAt - Date.now()) / 1000)
      : CACHE_TTL;
    if (ttlSec > 0) {
      await redisClient.set(`id:${shortId}`, originalUrl, "EX", ttlSec);
    }

    // Track click synchronously on cache miss (doc already fetched)
    doc.clicks += 1;
    doc.lastClickAt = new Date();
    await doc.save();
  } else {
    // Async click tracking — don't block the redirect
    Url.findOneAndUpdate(
      { shortId },
      { $inc: { clicks: 1 }, $set: { lastClickAt: new Date() } }
    ).exec();
  }

  return originalUrl;
};

export const getUrlStats = async (shortId) => {
  const doc = await Url.findOne({ shortId });
  if (!doc) return null;
  return {
    shortId: doc.shortId,
    shortUrl: `${BASE_URL}/${doc.shortId}`,
    originalUrl: doc.originalUrl,
    clicks: doc.clicks,
    lastClickAt: doc.lastClickAt,
    isCustomAlias: doc.isCustomAlias,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
  };
};
