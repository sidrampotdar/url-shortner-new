import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import router from "./routes/url.js";
dotenv.config();
const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  }),
);
app.use(express.json());
app.use("/", router);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(process.env.PORT, () => {
      console.log(`Server is Deployed on PORT: ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error Connecting MongoDB: ", err);
  });
