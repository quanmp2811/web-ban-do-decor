const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String },
    date: { type: Date, required: true },
    danhmuc: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    salary: { type: Number },
    soluong: { type: Number },
    mota: { type: String },
    soldCount: { type: Number, default: 0 },
    // Optional embedding vector for semantic search (array of numbers)
    embedding: { type: [Number], index: false }
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;