import { shortenUrl, redirectUrl } from "../services/urlService.js";

export const shorten = async (req, res, next) => {
  try {
    const { originalUrl } = req.body;
    const result = await shortenUrl(originalUrl);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const redirect = async (req, res, next) => {
  try {
    const { shortId } = req.params;
    const originalUrl = await redirectUrl(shortId);

    if (!originalUrl) {
      return res.status(404).json({ error: "URL Not Found" });
    }

    return res.redirect(originalUrl);
  } catch (error) {
    next(error);
  }
};
