const mongoose = require("mongoose");
async function connectDB() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/Banhang");
    console.log("✅ Kết nối MongoDB thành công");
  } catch (err) {
    console.error("❌ Lỗi kết nối:", err);
  }
}
module.exports = connectDB;
