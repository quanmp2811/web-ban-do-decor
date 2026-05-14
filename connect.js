const mongoose = require("mongoose");

try {
  require("dotenv").config({ quiet: true });
} catch (error) {
  console.warn("dotenv could not be loaded in connect.js");
}

const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017/Banhang";

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

module.exports = connectDB;
