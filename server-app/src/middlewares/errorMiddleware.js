import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error("Unhandled error: %o", err);

  const status = err.status || 500;
  const message = status === 500 ? "Server Error" : err.message || "Error";

  res.status(status).json({ error: message });
};
