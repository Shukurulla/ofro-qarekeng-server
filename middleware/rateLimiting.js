// middleware/rateLimiting.js
import rateLimit from "express-rate-limit";
import MongoStore from "rate-limit-mongo";
import { AppError } from "../utils/appError.js";

// MongoDB store uchun connection string
const mongoUri = process.env.DATABASE_URI || "mongodb://localhost:27017/orfoai";

// Umumiy rate limit store
const createMongoStore = () => {
  return new MongoStore({
    uri: mongoUri,
    collectionName: "rateLimits",
    expireTimeMs: 15 * 60 * 1000, // 15 minut
  });
};

// Auth uchun rate limiting (ro'yxatdan o'tish va kirish)
export const rateLimitAuth = rateLimit({
  store: createMongoStore(),
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 5, // 15 minutda maksimal 5 ta urinish
  message: {
    success: false,
    error: "Juda ko'p urinish. 15 minutdan keyin qayta urinib ko'ring",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Juda ko'p urinish. 15 minutdan keyin qayta urinib ko'ring",
    });
  },
});

// API uchun umumiy rate limiting
export const rateLimitAPI = rateLimit({
  store: createMongoStore(),
  windowMs: 60 * 1000, // 1 minut
  max: 30, // 1 minutda maksimal 30 ta so'rov
  message: {
    success: false,
    error: "Juda ko'p so'rov. Biroz kuting",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Juda ko'p so'rov. Biroz kuting",
    });
  },
});

// Og'ir operatsiyalar uchun (imlo tekshirish, to'g'irlash)
export const rateLimitHeavy = rateLimit({
  store: createMongoStore(),
  windowMs: 60 * 1000, // 1 minut
  max: 10, // 1 minutda maksimal 10 ta so'rov
  message: {
    success: false,
    error: "Juda ko'p so'rov. Bir minutdan keyin qayta urinib ko'ring",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Juda ko'p so'rov. Bir minutdan keyin qayta urinib ko'ring",
    });
  },
});

// Umumiy operatsiyalar uchun
export const rateLimitGeneral = rateLimit({
  store: createMongoStore(),
  windowMs: 60 * 1000, // 1 minut
  max: 60, // 1 minutda maksimal 60 ta so'rov
  message: {
    success: false,
    error: "Juda ko'p so'rov. Biroz kuting",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Juda ko'p so'rov. Biroz kuting",
    });
  },
});

// IP asosida rate limiting
export const rateLimitByIP = rateLimit({
  store: createMongoStore(),
  windowMs: 24 * 60 * 60 * 1000, // 24 soat
  max: 1000, // 24 soatda maksimal 1000 ta so'rov
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    error: "Kunlik limit tugagan. Ertaga qayta urinib ko'ring",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Kunlik limit tugagan. Ertaga qayta urinib ko'ring",
    });
  },
});

// Pro foydalanuvchilar uchun yumshoq limit
export const rateLimitPro = rateLimit({
  store: createMongoStore(),
  windowMs: 60 * 1000, // 1 minut
  max: 100, // 1 minutda maksimal 100 ta so'rov
  message: {
    success: false,
    error: "Juda ko'p so'rov. Biroz kuting",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Juda ko'p so'rov. Biroz kuting",
    });
  },
});

// Start foydalanuvchilar uchun qattiq limit
export const rateLimitStart = rateLimit({
  store: createMongoStore(),
  windowMs: 60 * 1000, // 1 minut
  max: 20, // 1 minutda maksimal 20 ta so'rov
  message: {
    success: false,
    error: "Juda ko'p so'rov. Pro rejasiga o'ting yoki biroz kuting",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Juda ko'p so'rov. Pro rejasiga o'ting yoki biroz kuting",
    });
  },
});

// Dynamic rate limiting - plan asosida
export const dynamicRateLimit = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return rateLimitAPI(req, res, next);
  }

  // Pro foydalanuvchilar uchun
  if (user.plan === "pro" && user.planExpiry > new Date()) {
    return rateLimitPro(req, res, next);
  }

  // Start foydalanuvchilar uchun
  return rateLimitStart(req, res, next);
};

// Export qilish uchun rate limit
export const rateLimitExport = rateLimit({
  store: createMongoStore(),
  windowMs: 60 * 60 * 1000, // 1 soat
  max: 5, // 1 soatda maksimal 5 ta eksport
  message: {
    success: false,
    error: "Eksport limiti tugagan. 1 soatdan keyin qayta urinib ko'ring",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Eksport limiti tugagan. 1 soatdan keyin qayta urinib ko'ring",
    });
  },
});

// Rate limit ma'lumotlarini olish
export const getRateLimitInfo = (req, res, next) => {
  res.on("finish", () => {
    // Rate limit headerlarini qo'shish
    const remaining = res.get("X-RateLimit-Remaining");
    const limit = res.get("X-RateLimit-Limit");
    const reset = res.get("X-RateLimit-Reset");

    if (remaining !== undefined) {
      console.log(`Rate limit: ${remaining}/${limit}, reset: ${reset}`);
    }
  });
  next();
};
