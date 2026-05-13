const mongoose = require('mongoose');

const DonHangSchema = new mongoose.Schema({
  id_sp: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  image: { type: String },
  date: { type: Date, default: Date.now },
  salary: { type: Number, default: 0 },
  soluong: { type: Number, default: 1 },
  // Customer & order grouping
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customer_name: { type: String },
  phone: { type: String },
  address: { type: String },
  city: { type: String },
  postal: { type: String },
  payment_method: { type: String },
  orderId: { type: String },
  total: { type: Number, default: 0 },
  status: { type: String, default: 'pending' }
});

module.exports = mongoose.model('DonHang', DonHangSchema);
