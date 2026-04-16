import Joi from "joi";
import { shortenUrl, redirectUrl, getUrlStats } from "../services/UrlService.js";

const shortenSchema = Joi.object({
  originalUrl: Joi.string()
    .uri({ scheme: ["http", "https"], allowRelative: false })
    .max(2048)
    .required()
    .messages({ "string.uri": "Must be a valid URL starting with http:// or https://" }),

  alias: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]{3,30}$/)
    .optional()
    .allow("", null)
    .messages({ "string.pattern.base": "Alias: 3–30 chars, letters/numbers/- _ only" }),

  expiry: Joi.string()
    .valid("1d", "7d", "30d", "1y")
    .optional()
    .allow("", null),
});

const SHORT_ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;

export const shorten = async (req, res, next) => {
  try {
    const { error, value } = shortenSchema.validate(req.body, { abortEarly: true });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const result = await shortenUrl(value.originalUrl, {
      alias: value.alias || null,
      expiry: value.expiry || null,
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

export const redirect = async (req, res, next) => {
  try {
    const { shortId } = req.params;
    if (!SHORT_ID_RE.test(shortId)) return res.status(404).send(notFoundHtml());

    const originalUrl = await redirectUrl(shortId);
    if (!originalUrl) return res.status(404).send(notFoundHtml());

    // 302 (temporary) keeps click analytics accurate — browser won't permanently cache
    res.redirect(302, originalUrl);
  } catch (err) {
    next(err);
  }
};

export const stats = async (req, res, next) => {
  try {
    const { shortId } = req.params;
    if (!SHORT_ID_RE.test(shortId)) return res.status(404).json({ error: "Not found" });

    const data = await getUrlStats(shortId);
    if (!data) return res.status(404).json({ error: "URL not found" });

    res.json(data);
  } catch (err) {
    next(err);
  }
};

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Link Not Found</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
    min-height:100vh;margin:0;background:#0f0f0f;color:#eee;}
    .card{text-align:center;padding:3rem 2rem;max-width:400px;}
    h1{font-size:3rem;margin:0}h2{color:#888;font-weight:400}
    a{color:#6366f1;text-decoration:none;border-bottom:1px solid #6366f1}
  </style>
</head>
<body>
  <div class="card">
    <h1>🔗</h1>
    <h2>Link not found or expired.</h2>
    <p><a href="/">Create a new short link →</a></p>
  </div>
</body>
</html>`;
}
