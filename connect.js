const mongoose = require("mongoose");

try {
  require("dotenv").config({ quiet: true });
} catch (error) {
  console.warn("dotenv could not be loaded in connect.js");
}

const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017/Banhang";
let connectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const mongoUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  connectionPromise = mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await connectionPromise;
    console.log("MongoDB connected");
    return mongoose.connection;
  } catch (err) {
    connectionPromise = null;
    console.error("MongoDB connection error:", err);
    throw err;
  }
}

module.exports = connectDB;
