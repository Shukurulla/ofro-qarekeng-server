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

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: "Juda ko'p so'rov yuborildi, keyinroq urinib ko'ring",
});
app.use("/api/", limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// MongoDB ulanishi
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/karakalpak_dict",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("MongoDB ga muvaffaqiyatli ulandi"))
  .catch((err) => console.error("MongoDB ulanish xatosi:", err));

// Routes
app.use("/api/check", spellCheckRoutes);
app.use("/api/convert", transliterateRoutes);
app.use("/api/words", wordsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server ishlamoqda",
    timestamp: new Date().toISOString(),
  });
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
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlamoqda`);
});
