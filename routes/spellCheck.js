const express = require("express");
const router = express.Router();
const Word = require("../models/Word");
const {
  checkTextSpelling,
  getTextStatistics,
  fuzzySearch,
  normalizeWord,
} = require("../utils/spellCheck");

// Cache uchun
let dictionaryCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minut

// So'zlar bazasini cache qilish
async function getDictionary(forceRefresh = false) {
  const now = Date.now();

  if (
    !forceRefresh &&
    dictionaryCache &&
    cacheTimestamp &&
    now - cacheTimestamp < CACHE_DURATION
  ) {
    return dictionaryCache;
  }

  try {
    const words = await Word.find({ isChecked: true })
      .select("word type trustScore")
      .sort({ trustScore: -1 });

    dictionaryCache = words;
    cacheTimestamp = now;

    return words;
  } catch (error) {
    console.error("So'zlar bazasini olishda xato:", error);
    return dictionaryCache || [];
  }
}

// POST /api/check - Matn imlosini tekshirish
router.post("/", async (req, res) => {
  try {
    const { text, options = {} } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Matn kiritilishi shart",
      });
    }

    if (text.length > 50000) {
      return res.status(400).json({
        error: "Matn juda uzun (maksimal 50,000 belgi)",
      });
    }

    // So'zlar bazasini olish
    const dictionary = await getDictionary();

    if (dictionary.length === 0) {
      return res.status(503).json({
        error: "So'zlar bazasi mavjud emas",
      });
    }

    // Imlo tekshiruvi
    const spellResults = checkTextSpelling(text, dictionary);
    const statistics = getTextStatistics(text, spellResults);

    // Faqat xato so'zlarni qaytarish (agar kerak bo'lsa)
    const errorsOnly = options.errorsOnly === true;
    const results = errorsOnly
      ? spellResults.filter((r) => !r.isCorrect)
      : spellResults;

    res.json({
      success: true,
      results: results,
      statistics: statistics,
      dictionarySize: dictionary.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Imlo tekshirish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
      message:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/check/word - Bitta so'zni tekshirish
router.post("/word", async (req, res) => {
  try {
    const { word } = req.body;

    if (!word || typeof word !== "string") {
      return res.status(400).json({
        error: "So'z kiritilishi shart",
      });
    }

    const normalizedWord = normalizeWord(word);

    // So'zlar bazasini olish
    const dictionary = await getDictionary();

    // So'zni tekshirish
    const isCorrect = dictionary.some(
      (wordObj) => normalizeWord(wordObj.word) === normalizedWord
    );

    let suggestions = [];
    if (!isCorrect) {
      // Yaqin so'zlarni topish
      const similarWords = fuzzySearch(word, dictionary, 5);
      suggestions = similarWords.map((w) => ({
        word: w.word,
        score: w.score,
        type: w.type,
      }));
    }

    res.json({
      success: true,
      word: word,
      isCorrect: isCorrect,
      suggestions: suggestions,
    });
  } catch (error) {
    console.error("So'z tekshirish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// GET /api/check/suggestions/:word - So'z uchun takliflar
router.get("/suggestions/:word", async (req, res) => {
  try {
    const { word } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    if (!word) {
      return res.status(400).json({
        error: "So'z parametri kiritilishi shart",
      });
    }

    const dictionary = await getDictionary();
    const suggestions = fuzzySearch(word, dictionary, limit);

    res.json({
      success: true,
      word: word,
      suggestions: suggestions,
    });
  } catch (error) {
    console.error("Takliflar olish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// POST /api/check/batch - Ko'p so'zlarni bir vaqtda tekshirish
router.post("/batch", async (req, res) => {
  try {
    const { words } = req.body;

    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({
        error: "So'zlar massivi kiritilishi shart",
      });
    }

    if (words.length > 1000) {
      return res.status(400).json({
        error: "Juda ko'p so'z (maksimal 1000 ta)",
      });
    }

    const dictionary = await getDictionary();
    const results = [];

    for (const word of words) {
      if (typeof word !== "string") continue;

      const normalizedWord = normalizeWord(word);
      const isCorrect = dictionary.some(
        (wordObj) => normalizeWord(wordObj.word) === normalizedWord
      );

      let suggestions = [];
      if (!isCorrect) {
        const similarWords = fuzzySearch(word, dictionary, 3);
        suggestions = similarWords.map((w) => w.word);
      }

      results.push({
        word: word,
        isCorrect: isCorrect,
        suggestions: suggestions,
      });
    }

    res.json({
      success: true,
      results: results,
      totalChecked: results.length,
    });
  } catch (error) {
    console.error("Batch tekshirish xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// POST /api/check/refresh-cache - Cache yangilash (admin uchun)
router.post("/refresh-cache", async (req, res) => {
  try {
    await getDictionary(true);
    res.json({
      success: true,
      message: "Cache muvaffaqiyatli yangilandi",
    });
  } catch (error) {
    console.error("Cache yangilash xatosi:", error);
    res.status(500).json({
      error: "Cache yangilashda xato",
    });
  }
});

module.exports = router;
