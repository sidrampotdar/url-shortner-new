import mongoose from "mongoose";

const urlSchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    shortId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      maxlength: 64,
    },
    isCustomAlias: {
      type: Boolean,
      default: false,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    lastClickAt: {
      type: Date,
      default: null,
    },
    // Sparse TTL index: MongoDB auto-deletes docs when expiresAt is reached.
    // null = never expires.
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// TTL index — sparse so null rows are ignored
urlSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, sparse: true }
);

const Url = mongoose.model("Url", urlSchema);
export default Url;
