/**
 * index.js
 * Product CRUD API (Express + CORS + MongoDB/Mongoose)
 *
 * Run:
 * 1) npm init -y
 * 2) npm i express cors mongoose dotenv
 * 3) create .env with: MONGO_URI=your_mongodb_connection_string
 * 4) node index.js
 */

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// ====== Middlewares ======
app.use(cors({origin:'*'})); // or customize origin if needed
app.use(express.json());

// ====== Mongo Connect ======
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    autoIndex: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ====== Product Model ======
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    inStock: { type: Boolean, default: true },
    quantity: { type: Number, default: 0, min: 0 },
    category: { type: String, default: "", trim: true, maxlength: 120 },
    images: { type: [String], default: [] },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

// ====== Helpers ======
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// ====== Routes ======

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, service: "product-crud", time: new Date().toISOString() });
});

// CREATE product
app.post(
  "/api/products",
  asyncHandler(async (req, res) => {
    const payload = req.body;

    // Basic validation
    if (!payload?.name) return res.status(400).json({ message: "name is required" });
    if (payload?.price === undefined || payload?.price === null)
      return res.status(400).json({ message: "price is required" });

    const created = await Product.create(payload);
    res.status(201).json(created);
  })
);

// READ all products (supports search + pagination)
app.get(
  "/api/products",
  asyncHandler(async (req, res) => {
    const {
      q, // search text (name/category)
      page = 1,
      limit = 10,
      sort = "-createdAt", // default newest
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const filter = {};
    if (q && String(q).trim()) {
      const s = String(q).trim();
      filter.$or = [
        { name: { $regex: s, $options: "i" } },
        { category: { $regex: s, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.json({
      items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  })
);

// READ single product
app.get(
  "/api/products/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  })
);

// UPDATE product (PUT = full/partial here)
app.put(
  "/api/products/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const updated = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  })
);

// PATCH product (partial update)
app.patch(
  "/api/products/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const updated = await Product.findByIdAndUpdate(id, { $set: req.body }, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  })
);

// DELETE product
app.delete(
  "/api/products/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });

    res.json({ ok: true, message: "Product deleted", id });
  })
);

// ====== Error handler ======
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || "Server error",
  });
});

// ====== Start server ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
