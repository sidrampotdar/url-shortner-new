import Joi from "joi";
import { shortenUrl, redirectUrl } from "../services/urlService.js";

const urlSchema = Joi.object({
  originalUrl: Joi.string()
    .uri({ scheme: ["http", "https"], allowRelative: false })
    .required(),
});

export const shorten = async (req, res, next) => {
  try {
    const { error, value } = urlSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await shortenUrl(value.originalUrl);
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
