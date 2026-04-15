import { createLogger, format, transports } from "winston";
import { NODE_ENV } from "../config.js";

const logger = createLogger({
  level: NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    format.printf(({ timestamp, level, message, stack }) => {
      return stack
        ? `${timestamp} [${level}] ${message} - ${stack}`
        : `${timestamp} [${level}] ${message}`;
    }),
  ),
  transports: [new transports.Console()],
});

export default logger;
