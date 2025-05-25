const mongoose = require("mongoose");

const wordSchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    isChecked: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: String,
      default: "System",
    },
    type: {
      type: String,
      enum: ["kiril", "lotin", "mixed"],
      required: true,
    },
    inspectors: [
      {
        type: String,
      },
    ],
    trustScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    frequency: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      enum: ["noun", "verb", "adjective", "adverb", "other"],
      default: "other",
    },
  },
  {
    timestamps: true,
  }
);

// Indekslar
wordSchema.index({ word: 1, type: 1 });
wordSchema.index({ word: "text" });
wordSchema.index({ trustScore: -1 });

// So'zni normalizatsiya qilish
wordSchema.pre("save", function (next) {
  this.word = this.word.toLowerCase().trim();
  next();
});

// Static metodlar
wordSchema.statics.findByWord = function (word, type = null) {
  const query = { word: word.toLowerCase().trim() };
  if (type) query.type = type;
  return this.findOne(query);
};

wordSchema.statics.searchSimilar = function (word, limit = 5) {
  return this.find({
    word: { $regex: word.toLowerCase(), $options: "i" },
  })
    .limit(limit)
    .sort({ trustScore: -1 });
};

wordSchema.statics.getWordsByType = function (type) {
  return this.find({ type }).select("word trustScore").sort({ word: 1 });
};

module.exports = mongoose.model("word", wordSchema);
