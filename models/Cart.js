const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  id_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  id_sp: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  image: { type: String },
  date: { type: Date, default: Date.now },
  salary: { type: Number, default: 0 },
  soluong: { type: Number, default: 1 }
});

module.exports = mongoose.model('Cart', CartSchema);
