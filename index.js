const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const multer = require('multer');
const connect = require('./connect');
const Product = require('./models/Product');
const DonHang = require('./models/DonHang');
const Category = require('./models/Category');
const User = require('./models/User');
const Cart = require('./models/Cart');
const session = require("express-session");
const cookieParser = require("cookie-parser");
const app = express();

try {
  require('dotenv').config({ quiet: true });
} catch (e) {
  console.warn('dotenv not available or failed to load, continuing without .env');
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const uploadDir = path.join(__dirname, "./public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

connect();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));


app.use(cookieParser());

app.use(session({
  secret: "banhang_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: false
  }
}));

app.use(async (req, res, next) => {
  try {
    res.locals.userId = req.session ? req.session.userId : null;
    res.locals.username = req.session ? req.session.username || null : null;
    next();
  } catch (err) {
    console.error('Middleware set locals error:', err);
    next();
  }
});

app.get("/", (req, res) => {
  res.redirect("/trangchu");
});

// Trang admin
app.get("/admin", (req, res) => {
  res.render("admin/index");
});

app.get("/admin/san_pham", async (req, res) => {
  try {
    const [products, categories] = await Promise.all([
      Product.find().populate('danhmuc'), // Thêm populate()
      Category.find()
    ]);
    res.render("admin/san_pham", { products, categories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi mở trang sản phẩm");
  }
});

async function getProductStats() {
    const products = await Product.find().lean();

    const stats = await Promise.all(products.map(async (p) => {
        // Tổng số lượng đã bán từ DonHang
        const sold = await DonHang.aggregate([
            { $match: { id_sp: p._id } },
            { $group: { _id: '$id_sp', totalSold: { $sum: '$soluong' } } }
        ]);

        return {
            name: p.name,
            image: p.image,
            total: p.soluong,
            sold: sold.length > 0 ? sold[0].totalSold : 0,
            remaining: p.soluong - (sold.length > 0 ? sold[0].totalSold : 0)
        };
    }));

    return stats;
}
async function getRevenueByMonth(year) {
    const revenue = await DonHang.aggregate([
        { $match: { date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) } } },
        {
            $group: {
                _id: { $month: "$date" },
                totalRevenue: { $sum: "$total" }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    // Chuyển thành mảng 12 tháng
    const result = Array(12).fill(0);
    revenue.forEach(r => {
        result[r._id - 1] = r.totalRevenue;
    });

    return result;
}
app.get("/api/product-stats", async (req, res) => {
  try {
    const stats = await getProductStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không lấy được thống kê sản phẩm" });
  }
});

app.get("/api/revenue/:year", async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const revenue = await getRevenueByMonth(year);
    res.json(revenue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không lấy được doanh thu" });
  }
});

app.post("/admin/san_pham/add", upload.single("image"), async (req, res) => {
  try {
    const { name, salary, danhmuc, soluong, mota } = req.body;
    let imagePath = "";

    if (req.file) {
      imagePath = "/uploads/" + req.file.filename;
    }

    await Product.create({
      name,
      image: imagePath,
      date: new Date(),
      danhmuc: danhmuc || null,
      salary: Number(salary),
      soluong: Number(soluong),
      mota,
    });

    res.redirect("/admin/san_pham");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi thêm sản phẩm");
  }
});
app.post("/admin/san_pham/update/:id", async (req, res) => {
  try {
    const { name, danhmuc, salary, soluong, mota } = req.body;
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      { name, danhmuc, salary, soluong, mota },
      { new: true }
    ).populate('danhmuc');
    
    res.json({ 
      success: true,
      danhmucName: updatedProduct.danhmuc ? updatedProduct.danhmuc.danhmuc : 'Chưa có danh mục'
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});
app.get("/admin/san_pham/delete/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/admin/san_pham");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi xóa sản phẩm");
  }
});
// danh mục
app.get("/admin/danh_muc", async (req, res) => {
  try {
    const categories = await Category.find();
    // truyền biến 'category' để khớp với template
    res.render("admin/danh_muc", { category: categories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi mở trang danh mục");
  }
});

app.post("/admin/danh_muc/add", async (req, res) => {
  try {
    // Kiểm tra dữ liệu đầu vào
    if (!req.body.danhmuc) {
      throw new Error('Tên danh mục không được để trống');
    }
    
    const { danhmuc } = req.body;
    await Category.create({ danhmuc });
    res.redirect("/admin/danh_muc");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi thêm danh mục: " + err.message);
  }
});
app.post("/admin/danh_muc/update/:id", async (req, res) => {
  try {
    const { danhmuc } = req.body;
    await Category.findByIdAndUpdate(req.params.id, { danhmuc });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});
app.get("/admin/danh_muc/delete/:id", async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.redirect("/admin/danh_muc");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi xóa danh mục");
  }
});
// đơn hàng
app.get("/admin/don_hang", async (req, res) => {
  try {
    const donhang = await DonHang.find();
    res.render("admin/don_hang", { donhang });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi mở trang đơn hàng");
  }
});

app.get("/admin/nguoi_dung", async (req, res) => {
  try {
    const users = await User.find().lean();
    res.render("admin/nguoi_dung", { users });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi mở trang quản lý người dùng");
  }
});

app.post("/admin/nguoi_dung/add", async (req, res) => {
  try {
    const { username, name, email, phone, password, role } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
    }
    
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
    }

    const newUser = new User({
      username,
      name,
      email,
      phone,
      password,
      role: role || 'user'
    });
    
    await newUser.save();
    res.redirect('/admin/nguoi_dung');
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi thêm người dùng");
  }
});

app.post("/admin/nguoi_dung/update/:id", async (req, res) => {
  try {
    const { username, name, email, phone, role } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { username, name, email, phone, role },
      { new: true }
    ).lean();
    
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật người dùng' });
  }
});

app.get("/admin/nguoi_dung/delete/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/nguoi_dung');
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi xóa người dùng");
  }
});

// Trang đăng ký
app.get("/register", async (req, res) => {
  res.render("trangchu/register");
});

// Trang đăng nhập
app.get("/login", async (req, res) => {
  res.render("trangchu/login", { error: null });
});

// Đăng nhập
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.render("trangchu/login", { error: "Sai tài khoản hoặc mật khẩu!" });
    }
    req.session.userId = user._id;
    req.session.username = user.username;
    console.log("Đăng nhập thành công:", req.session);
    res.redirect("/trangchu");
  } catch (err) {
    console.error("Lỗi khi đăng nhập:", err);
    res.render("login", { error: "Đăng nhập thất bại, vui lòng thử lại!" });
  }
});


// Đăng ký
app.post("/register", async (req, res) => {
  try {
    const { name, email, phone, gender, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }
    const user = new User({
      name,
      email,
      phone,
      gender,
      password 
    });
    await user.save();
    res.redirect('/login');
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Trang tìm kiếm
app.get('/timkiem', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.redirect('/san_pham');

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 6);
    const skip = (page - 1) * limit;

    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(esc, 'i');

    const query = { $or: [{ name: regex }, { mota: regex }] };

    const [totalCount, categories] = await Promise.all([
      Product.countDocuments(query),
      Category.find().lean()
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const safePage = Math.min(page, totalPages);

    const products = await Product.find(query)
      .populate('danhmuc')
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean();

    res.render('trangchu/timkiem', {
      products: products || [],
      categories: categories || [],
      query: q,
      page: safePage,
      totalPages,
      limit
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).render('trangchu/timkiem', { products: [], categories: [], query: req.query.q || '', page: 1, totalPages: 1, limit: 6 });
  }
});

// Trang chủ
app.post('/api/trangchu', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      $or: [{ email: username }, { phone: username }]
    });
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không đúng' });
    }
    req.session.userId = user._id;
    req.session.username = user.name;
    req.session.isLoggedIn = true;

    return res.json({
      success: true,
      userId: user._id,
      username: user.name,
      message: 'Đăng nhập thành công',
      redirectUrl: '/trangchu'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Chức năng chat với tìm kiếm vector + Gemini
const chatPrompts = require('./data/chat-prompts');
const chatState = require('./data/chat-state');

// Hỗ trợ SDK tuỳ chọn
let GoogleGenerativeAI = null;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  GoogleGenerativeAI = null;
}
let sdkEmbeddingAvailable = !!GoogleGenerativeAI;
let sdkGenerationAvailable = !!GoogleGenerativeAI;

// Chat với vector search + Gemini
app.post('/chat', async (req, res) => {
  const userMessage = (req.body.message || '').trim();
  const userId = req.session.userId || req.sessionID || 'anonymous';

  try {
    if (!GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY chưa được cấu hình trên server — một số chức năng AI sẽ không khả dụng');
    }

    const conversation = chatState.getConversation(userId);

    if (chatPrompts.isGreeting(userMessage)) {
      chatState.updateConversation(userId, { state: 'greeted' });
      return res.json({ reply: chatPrompts.prompts.greeting });
    }
    if (chatPrompts.isConsultRequest(userMessage)) {
      chatState.updateConversation(userId, { state: 'consulting', criteria: {} });
      if ((userMessage || '').trim().length <= 8) {
        return res.json({ reply: chatPrompts.prompts.consultation });
      }
    }

    const products = await Product.find({}).limit(500).lean();

    async function computeEmbedding(text) {
      if (!text) return null;
      if (GoogleGenerativeAI && sdkEmbeddingAvailable) {
        try {
          const client = new GoogleGenerativeAI(GEMINI_API_KEY);
          const model = client.getGenerativeModel({ model: 'text-embedding-004' });
          const r = await model.embedContent(text);
          const emb = r?.embedding?.values || r?.embeddings?.[0]?.embedding?.values || r?.data?.[0]?.embedding || r?.content?.embedding || r?.embedding || null;
          if (Array.isArray(emb)) return emb.map(Number);
        } catch (e) {
          sdkEmbeddingAvailable = false;
          console.warn('SDK embedding failed (disabling SDK fallback), falling back to HTTP:', e.message || e);
        }
      }

      try {
        let fetchFn = global.fetch;
        if (!fetchFn) {
          try {
            fetchFn = require('node-fetch');
            if (fetchFn.default) fetchFn = fetchFn.default;
            global.fetch = fetchFn;
          } catch (e) {
            console.error('Fetch not available for embedding');
            return null;
          }
        }
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedText?key=${GEMINI_API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }
        );
        const raw = await resp.text();
        if (!raw) return null;
        const j = JSON.parse(raw);
        const emb = j.embedding?.values || j.embeddings?.[0]?.embedding?.values || j.data?.[0]?.embedding || j.embedding || null;
        if (Array.isArray(emb)) return emb.map(Number);
      } catch (e) {
        console.error('Embedding HTTP error:', e);
      }
      return null;
    }

    // small cosine helper
    function cosine(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return -1;
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
      if (na === 0 || nb === 0) return -1; return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    // Ensure product embeddings exist (async but sequential to avoid rate spikes)
    // If no API key is configured, skip attempting to compute or persist embeddings
    // — this avoids long-running network calls and keeps the consult/greeting flow responsive.
    if (GEMINI_API_KEY) {
      for (const p of products) {
        if (!p.embedding || !Array.isArray(p.embedding) || p.embedding.length === 0) {
          const text = `${p.name || ''} - ${p.mota || ''}`.trim();
          if (!text) continue;
          const emb = await computeEmbedding(text);
          if (emb) {
            try { await Product.updateOne({ _id: p._id }, { embedding: emb }); p.embedding = emb; } catch (e) { console.warn('Failed to persist embedding', e); }
          }
        }
      }
    } else {
      // No GEMINI_API_KEY — do not attempt embeddings. Rely on simple ranked candidates instead.
    }

  // compute user embedding (skipped when GEMINI_API_KEY is not configured)
  const userEmb = GEMINI_API_KEY ? await computeEmbedding(userMessage || '') : null;

    // Apply filters based on criteria
    let filteredProducts = products;
    if (conversation.state === 'consulting' && conversation.criteria) {
      const criteria = conversation.criteria;
      
      // Filter by product type/name if specified
      if (criteria.productType) {
        const typeRegex = new RegExp(criteria.productType, 'i');
        filteredProducts = filteredProducts.filter(p => 
          typeRegex.test(p.name) || typeRegex.test(p.mota || '')
        );
      }
      
      // Add other criteria filters here if needed
    }

    let candidates = filteredProducts.slice(0, 5);
    
    if (userEmb) {
      const scored = filteredProducts.map(p => ({ 
        p, 
        score: (p.embedding && Array.isArray(p.embedding)) ? cosine(userEmb, p.embedding) : -1 
      }));
      scored.sort((a,b) => b.score - a.score);
      const top = scored.filter(s => s.score > -1).slice(0,5).map(s => s.p);
      if (top.length) candidates = top;
    }

    const consultCriteriaPrice = (conversation.criteria && conversation.criteria.price) || null;
    if (consultCriteriaPrice === 'max' || /đắt/.test(String(consultCriteriaPrice || ''))) {
      candidates = filteredProducts.sort((a,b) => (b.salary||b.price||0) - (a.salary||a.price||0)).slice(0,5);
    } else if (consultCriteriaPrice === 'min' || /rẻ/.test(String(consultCriteriaPrice || ''))) {
      candidates = filteredProducts.sort((a,b) => (a.salary||a.price||0) - (b.salary||b.price||0)).slice(0,5);
    }

    const productText = candidates.map(p => `${p.name || ''} - ${(p.salary||p.price||0).toLocaleString('vi-VN')} VND\nMô tả: ${p.mota||p.description||''}\n`).join('\n');

    if (conversation.state === 'consulting') {
      const response = (userMessage || '').toLowerCase();
      const criteria = conversation.criteria || {};
      const productWords = new Set();
      products.forEach(p => {
        if (p.name) {
          const words = p.name.toLowerCase().split(/\s+/);
          words.forEach(w => productWords.add(w));
        }
      });

      const isPrice = /\b(đắt|rẻ|giá|giá cao|giá thấp|đắt nhất|rẻ nhất|\d+[.,]?\d*)\b/.test(response);
      const isSize = /\b(nhỏ|vừa|lớn|kích thước|cm|mm|m|size)\b/.test(response);
      const isLocation = /\b(phòng|khách|ngủ|bếp|ban công|sân|văn phòng|toilet)\b/.test(response);
      const isStyle = /\b(hiện đại|cổ điển|tối giản|minimal|scandi|vintage|retro|industrial|đương đại)\b/.test(response);
      const productTypeRegex = new RegExp(`\\b(${Array.from(productWords).join('|')})\\b`, 'i');
      const isProductType = productTypeRegex.test(response);
      if (!criteria.productType && (isProductType || (!isPrice && !isSize && !isLocation && !isStyle))) {
        criteria.productType = response;
        chatState.updateConversation(userId, { criteria });
        return res.json({ reply: 'Bạn mong muốn sản phẩm có kích thước như thế nào?' });
      }
      if (!criteria.size && (isSize || (!criteria.size && !criteria.price && !isPrice && !isLocation && !isStyle))) {
        criteria.size = response;
        chatState.updateConversation(userId, { criteria });
        return res.json({ reply: 'Khoảng giá bạn mong muốn là bao nhiêu?' });
      }
      if (!criteria.price && isPrice) {
        if (/đắt/.test(response)) criteria.price = 'max';
        else if (/rẻ/.test(response)) criteria.price = 'min';
        else {
          const m = response.match(/(\d+[.,]?\d*)/);
          criteria.price = m ? m[0].replace(',', '.') : response;
        }
        chatState.updateConversation(userId, { criteria });
        return res.json({ reply: 'Bạn dự định đặt sản phẩm ở không gian nào?' });
      }
      if (!criteria.location && isLocation) {
        criteria.location = response;
        chatState.updateConversation(userId, { criteria });
        return res.json({ reply: 'Bạn thích phong cách nào? (hiện đại, cổ điển...)' });
      }
      if (!criteria.style && isStyle) {
        criteria.style = response;
        chatState.updateConversation(userId, { state: 'recommending', criteria });
      }
      if (!criteria.productType) { criteria.productType = response; chatState.updateConversation(userId, { criteria }); return res.json({ reply: 'Bạn mong muốn sản phẩm có kích thước như thế nào?' }); }
      if (!criteria.size) { criteria.size = response; chatState.updateConversation(userId, { criteria }); return res.json({ reply: 'Khoảng giá bạn mong muốn là bao nhiêu?' }); }
      if (!criteria.price) { criteria.price = response; chatState.updateConversation(userId, { criteria }); return res.json({ reply: 'Bạn dự định đặt sản phẩm ở không gian nào?' }); }
      if (!criteria.location) { criteria.location = response; chatState.updateConversation(userId, { criteria }); return res.json({ reply: 'Bạn thích phong cách nào? (hiện đại, cổ điển...)' }); }
      if (!criteria.style) { criteria.style = response; chatState.updateConversation(userId, { state: 'recommending', criteria }); }
    }
    const prompt = `Bạn là một chuyên gia tư vấn sản phẩm Decor nội thất cao cấp.\n- Hỏi thêm nếu cần để hiểu rõ nhu cầu khách hàng.\n- Đưa ra tối đa 5 gợi ý sản phẩm dựa trên thông tin có sẵn.\n- Trả lời bằng tiếng Việt, thân thiện và chính xác.\n\nLịch sử hội thoại:\n${conversation.history || ''}\n\nSản phẩm gợi ý:\n${productText}\n\nKhách hàng: ${userMessage}\n\nHãy trả lời:`;
    let aiReply = '';
    const consultCriteria = conversation.criteria || {};
      if (!GEMINI_API_KEY) {
        const lines = [];
        for (const p of candidates.slice(0,5)) {
          const price = (p.salary || p.price || 0).toLocaleString('vi-VN');
          lines.push(`- ${p.name || 'Sản phẩm'} — ${price} VND — /san_pham/${p._id}`);
        }
        aiReply = lines.join('\n');
      }
    if (GoogleGenerativeAI && sdkGenerationAvailable) {
      try {
        const client = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = client.getGenerativeModel({ model: 'gemini-1.5-realtime' });
        const request = {
          contents: [ { parts: [ { text: prompt } ] } ],
          temperature: 0.3,
          maxOutputTokens: 800
        };
        const response = await model.generateContent(request);
        aiReply = response?.candidates?.[0]?.content?.parts?.[0]?.text || response?.output?.[0]?.content?.[0]?.text || response?.response?.text || '';
      } catch (e) {
        sdkGenerationAvailable = false;
        console.warn('SDK generateContent failed (disabling SDK generation), falling back to HTTP', e.message || e);
      }
    }

    if (!aiReply) {
      let fetchFn = global.fetch;
      if (!fetchFn) {
        try { fetchFn = require('node-fetch'); if (fetchFn.default) fetchFn = fetchFn.default; global.fetch = fetchFn; } catch (e) { console.error('Fetch not available for HTTP fallback'); }
      }
      const httpPayload = { contents: [{ parts: [{ text: prompt }] }] };
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-realtime:generateContent?key=${GEMINI_API_KEY}`;
        const r = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(httpPayload) });
        const j = await r.json();
        aiReply = j?.candidates?.[0]?.content?.parts?.[0]?.text || j?.output?.[0]?.content?.[0]?.text || '';
      } catch (e) {
        console.error('HTTP generateContent error', e);
      }
    }
      if (!aiReply) {
        const lines = [];
        for (const p of candidates.slice(0,5)) {
          const price = (p.salary || p.price || 0).toLocaleString('vi-VN');
          lines.push(`- ${p.name || 'Sản phẩm'} — ${price} VND — /san_pham/${p._id}`);
        }
        aiReply = lines.join('\n');
      }
    const productsPayload = (candidates || []).slice(0,5).map(p => ({
      _id: p._id,
      name: p.name || '',
      salary: p.salary || p.price || 0,
      image: p.image || ''
    }));
    if (conversation.state === 'consulting' && productsPayload.length > 0) {
      conversation.state = 'chatting';
      aiReply = `Dưới đây là một số sản phẩm phù hợp với yêu cầu của bạn. Bạn có thể xem chi tiết và thêm vào giỏ hàng.`;
    }

    try {
      conversation.history = (conversation.history || '') + `Khách: ${userMessage}\nBot: ${aiReply}\n`;
      chatState.updateConversation(userId, conversation);
    } catch (e) { console.warn('Failed to update conversation state', e); }

    if (!aiReply) return res.status(500).json({ reply: 'Không thể tạo câu trả lời AI ở thời điểm này', products: productsPayload });
    return res.json({ reply: aiReply, products: productsPayload });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ reply: 'Lỗi hệ thống khi xử lý chat' });
  }
});

app.get('/admin/index-embeddings', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(500).send('GEMINI_API_KEY chưa cấu hình');
    let fetchFn = global.fetch;
    if (!fetchFn) {
      try {
        fetchFn = require('node-fetch');
        if (fetchFn.default) fetchFn = fetchFn.default;
        global.fetch = fetchFn;
      } catch (e) {
        return res.status(500).send('Fetch không khả dụng');
      }
    }
    const products = await Product.find({}).limit(500).lean();
    let count = 0;
    for (const p of products) {
      if (!p.embedding || !p.embedding.length) {
        const text = `${p.name || ''} - ${p.mota || ''}`.trim();
        if (!text) continue;
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedText?key=${GEMINI_API_KEY}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }
          );
          const j = await resp.json();
          const emb = j.embedding?.values || j.embeddings?.[0]?.embedding?.values || j.data?.[0]?.embedding || j.embedding || null;
          if (Array.isArray(emb)) {
            await Product.updateOne({ _id: p._id }, { embedding: emb });
            count++;
          }
        } catch (e) {
          console.error('Index embedding failed for', p._id, e);
        }
      }
    }
    res.send(`Indexed embeddings for ${count} products`);
  } catch (e) {
    console.error(e);
    res.status(500).send('Lỗi khi index embeddings');
  }
});

app.get('/admin/list-models', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(500).send('GEMINI_API_KEY chưa cấu hình');
    let fetchFn = global.fetch;
    if (!fetchFn) {
      try {
        fetchFn = require('node-fetch');
        if (fetchFn.default) fetchFn = fetchFn.default;
        global.fetch = fetchFn;
      } catch (e) {
        return res.status(500).send('Fetch không khả dụng');
      }
    }

    const versions = ['v1beta', 'v1'];
    let lastErr = null;
    for (const ver of versions) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models?key=${GEMINI_API_KEY}`;
      try {
        const resp = await fetch(url);
        const raw = await resp.text();
        if (!raw) {
          lastErr = `Empty response from ${url}`;
          continue;
        }
        let data = null;
        try { data = JSON.parse(raw); } catch (e) { lastErr = `Invalid JSON from ${url}: ${raw}`; continue; }
        return res.json({ version: ver, models: data.models || data });
      } catch (e) {
        lastErr = e.message || String(e);
      }
    }
    res.status(500).send('Không thể lấy danh sách models: ' + lastErr);
  } catch (e) {
    console.error('/admin/list-models error', e);
    res.status(500).send('Lỗi server');
  }
});
app.get("/trangchu", async (req, res) => {
  try {
    let products = [], categories;
    if (req.session.searchData) {
      products = req.session.searchData.products;
      categories = req.session.searchData.categories;
      delete req.session.searchData;
    } else {
      categories = await Category.find();
      const bestPerCategory = await Promise.all(categories.map(async cat => {
        return await Product.findOne({ danhmuc: cat._id })
          .sort({ soldCount: -1 })  
          .limit(1);
      }));
      products = bestPerCategory.filter(p => p !== null);
      if (products.length < 6) {
        const additionalProducts = await Product.find({
          _id: { $nin: products.map(p => p._id) } 
        })
        .sort({ soldCount: -1 })
        .limit(6 - products.length);
        products = [...products, ...additionalProducts];
      }
      products = products.slice(0, 6);
    }

    res.render("trangchu/index", { 
      products,
      categories,
      userId: req.session.userId || null,
      username: req.session.username || null
    });
  } catch (err) {
    console.error("Lỗi khi lấy dữ liệu:", err);
    res.render("trangchu/index", { 
      products: [],
      categories: [],
      userId: null,
      username: null
    });
  }
});
app.get("/user", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/trangchu');

    const [user, categories] = await Promise.all([
      User.findById(userId).lean(),
      Category.find().lean()
    ]);
    const orders = await DonHang.find({ user: userId }).sort({ date: -1 }).lean();
    res.render("trangchu/user", { 
      user: user || null,
      username: req.session.username || null,
      orders,
      categories
    });
  } catch (err) {
    console.error("Lỗi khi lấy thông tin user:", err);
    res.render("trangchu/user", { user: null, orders: [], categories: [] });
  }
});

app.post('/user/update', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: 'Chưa đăng nhập' });
    const { name, email, phone, gender } = req.body;
    if (!name || !email || !phone) return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    const updated = await User.findByIdAndUpdate(userId, { name, email, phone, gender }, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: 'Không tìm thấy user' });
    req.session.username = updated.name;
    return res.json({ success: true, user: updated, username: updated.name });
  } catch (err) {
    console.error('/user/update error', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
});
app.post('/user/update', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

    const { name, email, phone, gender } = req.body || {};
    const update = {};
    if (typeof name !== 'undefined') update.name = name;
    if (typeof email !== 'undefined') update.email = email;
    if (typeof phone !== 'undefined') update.phone = phone;
    if (typeof gender !== 'undefined') update.gender = gender;

    const updated = await User.findByIdAndUpdate(userId, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

    // update session display name if present
    if (updated.name) req.session.username = updated.name;

    return res.json({ success: true, user: { name: updated.name, email: updated.email, phone: updated.phone, gender: updated.gender }, username: req.session.username });
  } catch (err) {
    console.error('/user/update error', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Change password (AJAX) - requires currentPassword for verification
app.post('/user/change-password', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Thiếu trường mật khẩu' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

    // Simple password check (plaintext as in existing codebase)
    if (String(user.password) !== String(currentPassword)) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
    }

    user.password = newPassword;
    await user.save();

    // Force logout after password change and tell client to redirect to homepage
    req.session.destroy(err => {
      if (err) console.error('Session destroy error after password change', err);
      // reply telling client to redirect to the homepage
      return res.json({ success: true, message: 'Đổi mật khẩu thành công', loggedOut: true, redirect: '/trangchu' });
    });
  } catch (err) {
    console.error('/user/change-password error', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});
app.get('/orders', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/trangchu');
    const [user, categories, orders] = await Promise.all([
      User.findById(userId).lean(),
      Category.find().lean(),
      DonHang.find({ user: userId }).sort({ date: -1 }).lean()
    ]);
    res.render('trangchu/user', {
      user: user || null,
      orders: orders || [],
      categories: categories || []
    });
  } catch (err) {
    console.error("Lỗi khi lấy đơn hàng:", err);
    res.status(500).send('Lỗi server');
  }
});

app.get("/shop", (req, res) => {
  res.render("trangchu/shop");
});
app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect("/trangchu");
  });
});

app.get("/san_pham", async (req, res) => {
  try {
    const catId = req.query.cat || null;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 6; // Items per page

    const [categories, selectedCat] = await Promise.all([
      Category.find().lean(),
      catId ? Category.findById(catId).lean() : Promise.resolve(null)
    ]);

    const query = catId ? { danhmuc: catId } : {};
    
    // Get total count for pagination
    const totalItems = await Product.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    
    // Ensure page doesn't exceed total pages
    const safePage = Math.min(page, totalPages);
    
    // Get paginated products
    const products = await Product.find(query)
      .populate('danhmuc')
      .sort({ _id: -1 }) // Sort by newest first
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean();

    res.render("trangchu/san_pham", { 
      products, 
      categories, 
      selectedCat,
      currentPage: safePage,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi tải danh sách sản phẩm");
  }
});

app.get("/san_pham/danh-muc/:id", (req, res) => {
  res.redirect(`/san_pham?cat=${req.params.id}`);
});

app.get("/san_pham/ajax", async (req, res) => {
  try {
    const catId = req.query.cat || null;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 6;

    const query = catId ? { danhmuc: catId } : {};
    
    // Get total count for pagination
    const totalItems = await Product.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    
    // Ensure page doesn't exceed total pages
    const safePage = Math.min(page, totalPages);
    
    // Get paginated products
    const products = await Product.find(query)
      .populate('danhmuc')
      .sort({ _id: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      products,
      currentPage: safePage,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi tải danh sách sản phẩm" });
  }
});

app.get("/san_pham/:id", async (req, res) => {
    try {
        const productId = req.params.id;
        
        if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).render("trangchu/404", {
                categories: [],
                message: "ID sản phẩm không hợp lệ"
            });
        }

        const [product, categories] = await Promise.all([
            Product.findById(productId).populate('danhmuc').lean(),
            Category.find().lean()
        ]);
        if (!product) {
            return res.status(404).render("trangchu/404", {
                categories,
                message: "Không tìm thấy sản phẩm này"
            });
        }
        const relatedProducts = await Product.find({
            danhmuc: product.danhmuc._id,
            _id: { $ne: productId }
        }).limit(4).lean();

        return res.render("trangchu/chi_tiet_sp", {
            product,
            categories,
            relatedProducts,
            title: `${product.name} - Chi tiết sản phẩm`
        });

    } catch (err) {
        console.error("Lỗi khi tải chi tiết sản phẩm:", err);
        return res.status(500).render("trangchu/404", {
            categories: [],
            message: "Có lỗi xảy ra khi tải thông tin sản phẩm"
        });
    }
});
app.post("/cart/add", async (req, res) => {
  try {
    console.log('Session in /cart/add:', req.session);

    const { productId, quantity } = req.body;
    const userId = req.session.userId;
    if (!userId) return res.status(401).send("Bạn chưa đăng nhập");
    if (!productId) return res.status(400).send("Thiếu productId");
    const qty = parseInt(quantity, 10) > 0 ? parseInt(quantity, 10) : 1;
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).send("Không tìm thấy sản phẩm");
    const cartDoc = {
      id_user: userId,
      id_sp: product._id,
      name: product.name || '',
      image: product.image || '',
      date: new Date(),
      salary: product.salary || 0,
      soluong: qty
    };
    if (Cart.schema.path('user')) {
      cartDoc.user = userId;
    }
    const query = { id_sp: product._id, id_user: userId };
    const existing = await Cart.findOne(query);
    let saved;
    if (existing) {
      existing.soluong = (existing.soluong || 0) + qty;
      existing.salary = product.salary;
      saved = await existing.save();
    } else {
      saved = await Cart.create(cartDoc);
    }
    return res.status(201).json(saved);
  } catch (err) {
    console.error("Lỗi khi thêm sản phẩm vào giỏ hàng:", err);
    return res.status(500).send("Lỗi server");
  }
});
app.get("/cart", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/trangchu');
    const [categories, cartItems] = await Promise.all([
      Category.find().lean(),
      Cart.find({ id_user: userId }).populate('id_sp').lean()
    ]);
  res.render("trangchu/cart", { categories, cart: cartItems });
  } catch (err) {
    console.error("Lỗi khi tải giỏ hàng:", err);
    res.status(500).send("Lỗi server");
  }
});
app.get('/thanhtoan', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/trangchu');
    const [categories, cartItems] = await Promise.all([
      Category.find().lean(),
      Cart.find({ id_user: userId }).populate('id_sp').lean()
    ]);
    let subtotal = 0;
    cartItems.forEach(ci => {
      const price = (ci.salary != null) ? ci.salary : (ci.id_sp && ci.id_sp.salary) ? ci.id_sp.salary : 0;
      const qty = ci.soluong || 1;
      subtotal += price * qty;
    });
    const shipping = subtotal > 0 ? 30000 : 0;
    const grandtotal = subtotal + shipping;
    res.render('trangchu/thanhtoan', { categories, cart: cartItems, subtotal, shipping, grandtotal });
  } catch (err) {
    console.error('Lỗi khi mở trang thanh toán:', err);
    res.status(500).send('Lỗi server');
  }
});

// Buy selected from cart: render checkout with selected items and remove them from Cart
app.post('/thanhtoan/buy', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/trangchu');
    const { items, quantities } = req.body;
    const providedIds = Array.isArray(items) ? items : (items ? [items] : []);
    const qtys = Array.isArray(quantities) ? quantities : (quantities ? [quantities] : []);

    const itemsData = [];
    const cartIdsToRemove = [];

    for (let i = 0; i < providedIds.length; i++) {
      const id = providedIds[i];

      // Try to treat id as a Cart id first
      let cartDoc = null;
      try { cartDoc = await Cart.findById(id).populate('id_sp').lean(); } catch (e) { cartDoc = null; }

      if (cartDoc && cartDoc.id_sp) {
        const product = cartDoc.id_sp;
        const q = parseInt(qtys[i], 10) || cartDoc.soluong || 1;
        itemsData.push({
          _id: product._id,
          name: product.name || cartDoc.name || '',
          image: product.image || cartDoc.image || '',
          salary: product.salary || cartDoc.salary || 0,
          soluong: q,
          cartId: cartDoc._id
        });
        cartIdsToRemove.push(cartDoc._id);
        continue;
      }

      // Otherwise try to treat id as a Product id
      let product = null;
      try { product = await Product.findById(id).lean(); } catch (e) { product = null; }
      if (product) {
        const q = parseInt(qtys[i], 10) || 1;
        itemsData.push({
          _id: product._id,
          name: product.name || '',
          image: product.image || '',
          salary: product.salary || 0,
          soluong: q
        });
        continue;
      }

      // If neither found, skip
    }

    // remove selected cart documents (only when we used cart ids)
    if (cartIdsToRemove.length) {
      try { await Cart.deleteMany({ _id: { $in: cartIdsToRemove } }); } catch (e) { console.error('Failed to delete cart items', e); }
    }

    // compute server-side totals
    let subtotal = 0;
    itemsData.forEach(it => { subtotal += (it.salary || 0) * (it.soluong || 1); });
    const shipping = subtotal > 0 ? 30000 : 0;
    const grandtotal = subtotal + shipping;

    const categories = await Category.find().lean();
    res.render('trangchu/thanhtoan', { categories, items: itemsData, subtotal, shipping, grandtotal });
  } catch (err) {
    console.error('Lỗi khi mua từ giỏ hàng:', err);
    res.status(500).send('Lỗi server');
  }
});

app.post('/thanhtoan/submit', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/trangchu');
    const { name, phone, address, city, postal, payment_method, items, quantities } = req.body;
    const itemIds = Array.isArray(items) ? items : (items ? [items] : []);
    const qtys = Array.isArray(quantities) ? quantities : (quantities ? [quantities] : []);
    // fetch products to calculate totals and ensure valid data
    const products = await Product.find({ _id: { $in: itemIds } }).lean();
    const prodMap = {};
    products.forEach(p => { prodMap[p._id.toString()] = p; });

    // create a grouping orderId so multiple DonHang items belong to the same order
    const orderId = 'ORD' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);

    let subtotal = 0;
    for (let i = 0; i < itemIds.length; i++) {
      const pid = itemIds[i];
      const q = parseInt(qtys[i], 10) || 1;
      const product = prodMap[pid] || await Product.findById(pid).lean();
      if (!product) continue;
      const lineTotal = (product.salary || 0) * q;
      subtotal += lineTotal;
      await Promise.all([
        DonHang.create({
          id_sp: product._id,
          name: product.name || '',
          image: product.image || '',
          date: new Date(),
          salary: product.salary || 0,
          soluong: q,
          user: userId,
          customer_name: name || '',
          phone: phone || '',
          address: address || '',
          city: city || '',
          postal: postal || '',
          payment_method: payment_method || '',
          orderId,
          total: lineTotal,
          status: 'pending'
        }),
        Product.findByIdAndUpdate(
          product._id,
          { $inc: { soldCount: q } },  // Increment soldCount by quantity
          { new: true }
        )
      ]);
    }

    const shipping = subtotal > 0 ? 30000 : 0;
    const grandtotal = subtotal + shipping;

    // remove purchased items from the user's cart
    if (itemIds.length) {
      await Cart.deleteMany({ id_user: userId, id_sp: { $in: itemIds } });
    }

    // Optionally you could save a summarized Order document here. For now we redirect to orders view.
    res.redirect('/orders');
  } catch (err) {
    console.error('Lỗi khi submit thanh toán:', err);
    res.status(500).send('Lỗi server');
  }
});
app.post("/cart/update/:id", async (req, res) => {
  try {
    const { soluong } = req.body;
    const updatedCart = await Cart.findByIdAndUpdate(
      req.params.id,
      { soluong },
      { new: true }
    ).populate('id_sp');

    res.json({
      success: true,
      id_sp: updatedCart.id_sp ? updatedCart.id_sp.name : 'Chưa có sản phẩm'
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});
app.post("/cart/remove/:id", async (req, res) => {
  try {
    await Cart.findByIdAndDelete(req.params.id);
    res.redirect("/cart");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi xóa sản phẩm");
  }
});
app.post("/cart/remove", async (req, res) => {
  try {
    const ids = req.body.ids || req.body['ids[]'];
    if (!ids) return res.status(400).send("Không có sản phẩm để xóa");
    await Cart.deleteMany({ _id: { $in: ids } });
    res.redirect("/cart");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi xóa sản phẩm");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server chạy tại: http://localhost:${port}`));
