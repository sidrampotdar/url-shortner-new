import Url from "../models/Url.js";
import { nanoid } from "nanoid";
import qrcode from "qrcode";
import redisClient from "../utils/redisClient.js";

const CACHE_TTL = 86400; // 24 hours (in seconds)

const generateShortId = async () => {
  let shortId;
  let exists = true;
  while (exists) {
    shortId = nanoid(7);
    exists = await Url.findOne({ shortId });
  }
  return shortId;
};

export const shortenUrl = async (originalUrl) => {
  // Check cache first
  const cached = await redisClient.get(`url:${originalUrl}`);
  if (cached) {
    return JSON.parse(cached);
  }

  let shortId = await generateShortId();

  const url = await Url.create({ shortId, originalUrl });

  const shortUrl = `${process.env.BASE_URL}/${shortId}`;
  const qrCode = await qrcode.toDataURL(shortUrl); // base64 QR

  const result = { shortId, shortUrl, qrCode };

  // Cache both ways
  await redisClient.set(`url:${shortId}`, originalUrl, "EX", CACHE_TTL);
  await redisClient.set(
    `url:${originalUrl}`,
    JSON.stringify(result),
    "EX",
    CACHE_TTL,
  );

  return result;
};

export const redirectUrl = async (shortId) => {
  // Fast path: Redis
  let originalUrl = await redisClient.get(`url:${shortId}`);

  if (!originalUrl) {
    // Cache miss → Mongo
    const urlDoc = await Url.findOne({ shortId });
    if (!urlDoc) return null;

    originalUrl = urlDoc.originalUrl;

    // Cache it
    await redisClient.set(`url:${shortId}`, originalUrl, "EX", CACHE_TTL);

    // Increment clicks
    urlDoc.clicks++;
    await urlDoc.save();
  } else {
    // Increment clicks async (don't block redirect)
    Url.findOneAndUpdate({ shortId }, { $inc: { clicks: 1 } }).exec();
  }

  return originalUrl;
};
