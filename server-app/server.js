import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import router from "./src/routes/url.js";
import { errorHandler } from "./src/middlewares/errorMiddleware.js";
import redisClient from "./src/utils/redisClient.js";
import logger from "./src/utils/logger.js";
import { MONGO_URI, CLIENT_URL, PORT } from "./src/config.js";

const app = express();

// Security & performance middlewares
app.use(helmet());
app.use(compression());
app.use(cors({ origin: CLIENT_URL, methods: ["GET", "POST"] }));
app.use(express.json());

// Routes
app.use("/", router);

// Error handling (must be last)
app.use(errorHandler);

// Connect DB + Redis + Start server
const startServer = async () => {
  try {
    if (!MONGO_URI) {
      logger.error("MONGO_URI is not configured.");
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    logger.info("MongoDB Connected");

    const port = Number(PORT);
    app.listen(port, () => {
      logger.info(`Server running on PORT: ${port}`);
    });
  } catch (err) {
    logger.error("Startup Error: %o", err);
    process.exit(1);
  }
};

startServer();
