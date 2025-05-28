// server.js ga qo'shiladigan kod - timeout muammosini hal qilish uchun

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const spellCheckRoutes = require("./routes/spellCheck");
const transliterateRoutes = require("./routes/transliterate");
const wordsRoutes = require("./routes/words");

const app = express();

// Timeout middleware - YANGI
app.use((req, res, next) => {
  // Request timeout - 30 sekund
  req.setTimeout(30000, () => {
    const err = new Error("Request Timeout");
    err.status = 408;
    next(err);
  });

  // Response timeout - 30 sekund
  res.setTimeout(30000, () => {
    const err = new Error("Response Timeout");
    err.status = 408;
    next(err);
  });

  next();
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Rate limiting - YANGILANGAN (spell check uchun yumshoqroq)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased from 1000 to 2000
  message: "Juda ko'p so'rov yuborildi, keyinroq urinib ko'ring",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Special rate limit for spell check (more lenient)
const spellCheckLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 requests per 5 minutes
  message: "Imlo tekshiruvda juda ko'p so'rov, biroz kuting",
});
app.use("/api/check", spellCheckLimiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// MongoDB ulanishi - YANGILANGAN
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/karakalpak_dict",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Connection pool size
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 30000, // 30 seconds
      bufferCommands: false,
    }
  )
  .then(() => {
    console.log("MongoDB ga muvaffaqiyatli ulandi");
    // Dictionary ni background da pre-load qilish
    preloadDictionary();
  })
  .catch((err) => console.error("MongoDB ulanish xatosi:", err));

// Dictionary ni oldindan yuklash - YANGI
async function preloadDictionary() {
  try {
    console.log("Dictionary pre-loading boshlandi...");
    const startTime = Date.now();

    // Routes/spellCheck.js dan getDictionary funksiyasini import qilish kerak
    // Yoki bu yerda to'g'ridan-to'g'ri dictionary ni yuklash
    const Word = require("./models/Word");
    const words = await Word.find({ isChecked: true })
      .select("word type trustScore")
      .limit(10000) // Birinchi 10,000 ta eng ishonchli so'z
      .sort({ trustScore: -1 })
      .lean();

    const loadTime = Date.now() - startTime;
    console.log(`Dictionary pre-loaded: ${words.length} so'z, ${loadTime}ms`);
  } catch (error) {
    console.error("Dictionary pre-loading xatosi:", error);
  }
}

// Routes
app.use("/api/check", spellCheckRoutes);
app.use("/api/convert", transliterateRoutes);
app.use("/api/words", wordsRoutes);

// Health check - YANGILANGAN
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server ishlamoqda",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Timeout error handler - YANGI
app.use((err, req, res, next) => {
  if (err.status === 408) {
    console.error(`Timeout error: ${req.method} ${req.path}`);
    return res.status(408).json({
      error: "So'rov juda uzoq vaqt oldi",
      message: "Iltimos, matnni qisqartiring yoki keyinroq urinib ko'ring",
    });
  }
  next(err);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Server xatosi yuz berdi",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Ichki server xatosi",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "API endpoint topilmadi" });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlamoqda`);
});

// Server timeout sozlamalari - YANGI
server.timeout = 30000; // 30 sekund
server.keepAliveTimeout = 30000; // 30 sekund
server.headersTimeout = 31000; // 31 sekund (timeout dan biroz ko'p)
