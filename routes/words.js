const express = require("express");
const router = express.Router();
const Word = require("../models/Word");

// GET /api/words - Barcha so'zlarni olish (pagination bilan)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type; // 'kiril', 'lotin', 'mixed'
    const search = req.query.search;
    const sortBy = req.query.sortBy || "word";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

    if (limit > 1000) {
      return res.status(400).json({
        error: "Limit juda katta (maksimal 1000)",
      });
    }

    // Filter obyekti
    const filter = { isChecked: true };
    if (type) {
      filter.type = type;
    }
    if (search) {
      filter.word = { $regex: search, $options: "i" };
    }

    // Sort obyekti
    const sort = {};
    sort[sortBy] = sortOrder;

    const skip = (page - 1) * limit;

    const [words, totalCount] = await Promise.all([
      Word.find(filter)
        .select("word type trustScore frequency category createdAt")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Word.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      words: words,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: {
        type: type,
        search: search,
        sortBy: sortBy,
        sortOrder: sortOrder === 1 ? "asc" : "desc",
      },
    });
  } catch (error) {
    console.error("So'zlar olish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// GET /api/words/stats - So'zlar statistikasi
router.get("/stats", async (req, res) => {
  try {
    const [
      totalWords,
      kirilWords,
      lotinWords,
      mixedWords,
      highTrustWords,
      recentWords,
    ] = await Promise.all([
      Word.countDocuments({ isChecked: true }),
      Word.countDocuments({ isChecked: true, type: "kiril" }),
      Word.countDocuments({ isChecked: true, type: "lotin" }),
      Word.countDocuments({ isChecked: true, type: "mixed" }),
      Word.countDocuments({ isChecked: true, trustScore: { $gte: 90 } }),
      Word.countDocuments({
        isChecked: true,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Eng ko'p ishlatilgan so'zlar
    const topWords = await Word.find({ isChecked: true })
      .sort({ frequency: -1 })
      .limit(10)
      .select("word frequency type");

    // Kategoriya bo'yicha statistika
    const categoryStats = await Word.aggregate([
      { $match: { isChecked: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      statistics: {
        total: {
          words: totalWords,
          kiril: kirilWords,
          lotin: lotinWords,
          mixed: mixedWords,
        },
        quality: {
          highTrust: highTrustWords,
          percentage:
            totalWords > 0
              ? ((highTrustWords / totalWords) * 100).toFixed(1)
              : 0,
        },
        recent: {
          lastMonth: recentWords,
        },
        categories: categoryStats,
        topWords: topWords,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Statistika olish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// GET /api/words/search/:query - So'z qidirish
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type;

    if (!query || query.length < 2) {
      return res.status(400).json({
        error: "Qidiruv so'zi kamida 2 ta harf bo'lishi kerak",
      });
    }

    const filter = {
      isChecked: true,
      word: { $regex: query, $options: "i" },
    };

    if (type) {
      filter.type = type;
    }

    const words = await Word.find(filter)
      .select("word type trustScore frequency")
      .sort({ trustScore: -1, frequency: -1 })
      .limit(limit);

    res.json({
      success: true,
      query: query,
      results: words,
      count: words.length,
    });
  } catch (error) {
    console.error("So'z qidirish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// GET /api/words/random - Tasodifiy so'zlar
router.get("/random", async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 10;
    const type = req.query.type;

    if (count > 100) {
      return res.status(400).json({
        error: "Juda ko'p so'z so'ralgan (maksimal 100)",
      });
    }

    const filter = { isChecked: true };
    if (type) {
      filter.type = type;
    }

    const words = await Word.aggregate([
      { $match: filter },
      { $sample: { size: count } },
      { $project: { word: 1, type: 1, trustScore: 1, category: 1 } },
    ]);

    res.json({
      success: true,
      words: words,
      count: words.length,
    });
  } catch (error) {
    console.error("Tasodifiy so'zlar olish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// POST /api/words/validate - So'z(lar)ni tekshirish
router.post("/validate", async (req, res) => {
  try {
    const { words } = req.body;

    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({
        error: "So'zlar massivi kiritilishi shart",
      });
    }

    if (words.length > 100) {
      return res.status(400).json({
        error: "Juda ko'p so'z (maksimal 100 ta)",
      });
    }

    const results = [];

    for (const word of words) {
      if (typeof word !== "string") {
        results.push({
          word: word,
          isValid: false,
          error: "So'z string bo'lishi kerak",
        });
        continue;
      }

      const foundWord = await Word.findByWord(word);

      results.push({
        word: word,
        isValid: !!foundWord,
        wordInfo: foundWord
          ? {
              type: foundWord.type,
              trustScore: foundWord.trustScore,
              category: foundWord.category,
            }
          : null,
      });
    }

    const validCount = results.filter((r) => r.isValid).length;

    res.json({
      success: true,
      results: results,
      summary: {
        total: words.length,
        valid: validCount,
        invalid: words.length - validCount,
        accuracy: ((validCount / words.length) * 100).toFixed(1),
      },
    });
  } catch (error) {
    console.error("So'z tekshirish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// GET /api/words/export - So'zlarni eksport qilish
router.get("/export", async (req, res) => {
  try {
    const type = req.query.type;
    const format = req.query.format || "json"; // json, txt, csv

    const filter = { isChecked: true };
    if (type) {
      filter.type = type;
    }

    const words = await Word.find(filter)
      .select("word type trustScore category")
      .sort({ word: 1 });

    if (format === "txt") {
      const wordList = words.map((w) => w.word).join("\n");
      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="karakalpak_words_${type || "all"}.txt"`
      );
      return res.send(wordList);
    }

    if (format === "csv") {
      const csv = ["word,type,trustScore,category"]
        .concat(
          words.map(
            (w) => `${w.word},${w.type},${w.trustScore},${w.category || ""}`
          )
        )
        .join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="karakalpak_words_${type || "all"}.csv"`
      );
      return res.send(csv);
    }

    // Default JSON format
    res.json({
      success: true,
      exportDate: new Date().toISOString(),
      filter: { type },
      count: words.length,
      words: words,
    });
  } catch (error) {
    console.error("Eksport xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

module.exports = router;
