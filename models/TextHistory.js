// models/TextHistory.js
import mongoose from "mongoose";

const textHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Qaysi sahifada ishlatilgani
    action: {
      type: String,
      enum: [
        "spellCheck",
        "correctText",
        "transliterate",
        "documentGenerator",
        "generateSong",
      ],
      required: true,
    },
    // Kirish ma'lumotlari
    input: {
      text: {
        type: String,
        required: true,
        maxlength: [10000, "Matn 10000 belgidan kam bo'lishi kerak"],
      },
      language: {
        type: String,
        enum: ["uz", "kaa", "ru"],
        default: "uz",
      },
      script: {
        type: String,
        enum: ["latin", "cyrillic"],
        default: "latin",
      },
      // Document generator uchun qo'shimcha parametrlar
      style: {
        type: String,
        enum: [
          "professional",
          "academic",
          "literary",
          "formal",
          "friendly",
          "humorous",
        ],
        default: null,
      },
      level: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      // Song generator uchun parametrlar
      topic: {
        type: String,
        default: null,
      },
      songStyle: {
        type: String,
        enum: ["classik", "rep", "adabiy", "dardli", "hkz"],
        default: null,
      },
      conditions: {
        type: String,
        default: null,
      },
    },
    // Chiqish ma'lumotlari
    output: {
      // Spell check uchun
      results: [
        {
          word: String,
          isCorrect: Boolean,
          suggestions: [String],
          start: Number,
          end: Number,
        },
      ],
      statistics: {
        totalWords: Number,
        correctWords: Number,
        incorrectWords: Number,
        accuracy: Number,
        textLength: Number,
        scriptType: String,
      },
      // Text correction va document generator uchun
      corrected: String,
      improved: String,
      // Transliteration uchun
      converted: String,
      from: String,
      to: String,
      // Song generator uchun
      song: String,
      recommendedMusic: String,
    },
    // Muvaffaqiyat holati
    success: {
      type: Boolean,
      default: true,
    },
    error: {
      type: String,
      default: null,
    },
    // Metama'lumotlar
    metadata: {
      processingTime: Number, // millisekundlarda
      apiProvider: {
        type: String,
        default: "anthropic",
      },
      userAgent: String,
      ipAddress: String,
    },
    // Yaratilgan sana
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indekslar
textHistorySchema.index({ user: 1, createdAt: -1 });
textHistorySchema.index({ user: 1, action: 1, createdAt: -1 });
textHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 kun keyin o'chirish

// Virtual maydonlar
textHistorySchema.virtual("age").get(function () {
  return Date.now() - this.createdAt.getTime();
});

// Qisqacha ma'lumot uchun virtual maydon
textHistorySchema.virtual("preview").get(function () {
  const maxLength = 100;
  const text = this.input.text;
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
});

// Statik metodlar
textHistorySchema.statics.getUserHistory = function (userId, options = {}) {
  const {
    action = null,
    limit = 50,
    page = 1,
    sortBy = "createdAt",
    sortOrder = -1,
  } = options;

  const query = { user: userId };
  if (action) query.action = action;

  const skip = (page - 1) * limit;

  return this.find(query)
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .select("-output.results -metadata") // Katta ma'lumotlarni chiqarib tashlash
    .lean();
};

textHistorySchema.statics.getUserStats = function (userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
        successCount: {
          $sum: { $cond: ["$success", 1, 0] },
        },
        totalTextLength: { $sum: { $strLenCP: "$input.text" } },
        avgProcessingTime: { $avg: "$metadata.processingTime" },
      },
    },
    {
      $project: {
        action: "$_id",
        count: 1,
        successCount: 1,
        successRate: {
          $multiply: [{ $divide: ["$successCount", "$count"] }, 100],
        },
        totalTextLength: 1,
        avgProcessingTime: 1,
        _id: 0,
      },
    },
  ]);
};

textHistorySchema.statics.deleteOldHistory = function (userId, daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    user: userId,
    createdAt: { $lt: cutoffDate },
  });
};

// Instance metodlar
textHistorySchema.methods.getFormattedDate = function () {
  return this.createdAt.toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

textHistorySchema.methods.getDuration = function () {
  if (!this.metadata.processingTime) return "Noma'lum";

  const ms = this.metadata.processingTime;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// Pre middleware
textHistorySchema.pre("save", function (next) {
  // Matn uzunligini tekshirish
  if (this.input.text && this.input.text.length > 10000) {
    return next(new Error("Matn juda uzun"));
  }
  next();
});

export default mongoose.model("TextHistory", textHistorySchema);
