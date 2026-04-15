import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import router from "./src/routes/url.js";
import { errorHandler } from "./src/middlewares/errorMiddleware.js";
import redisClient from "./src/utils/redisClient.js";

dotenv.config();

const app = express();

// Security & performance middlewares
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_URL, methods: ["GET", "POST"] }));
app.use(express.json());

// Routes
app.use("/", router);

// Error handling (must be last)
app.use(errorHandler);

// Connect DB + Redis + Start server
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    // console.log("Redis Ready");

    app.listen(process.env.PORT, () => {
      console.log(`Server running on PORT: ${process.env.PORT}`);
    });
  } catch (err) {
    console.error("Startup Error:", err);
    process.exit(1);
  }
};

startServer();
