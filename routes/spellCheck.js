// routes/spellCheck.js - DATABASE SO'ZLAR BILAN ISHLASH

const express = require("express");
const router = express.Router();
const Word = require("../models/Word");

// Cache uchun
let dictionaryCache = null;
let dictionaryMap = new Map();
let cacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minut

// So'zni normallashtirish (faqat kichik harflarga)
function normalizeWord(word) {
  if (!word) return "";
  return word.toLowerCase().trim();
}

// Alifbo aniqlash
function detectScript(word) {
  const cyrillicChars = (word.match(/[а-яәғқңөүһҳ]/gi) || []).length;
  const latinChars = (word.match(/[a-zәğqńöüşı]/gi) || []).length;

  if (cyrillicChars > latinChars) return "cyrillic";
  if (latinChars > cyrillicChars) return "latin";
  return "mixed";
}

// Database dan barcha so'zlarni yuklash
async function getDictionary(forceRefresh = false) {
  const now = Date.now();

  if (
    !forceRefresh &&
    dictionaryCache &&
    cacheTimestamp &&
    now - cacheTimestamp < CACHE_DURATION
  ) {
    console.log(`Cache dan dictionary olinmoqda: ${dictionaryMap.size} so'z`);
    return { words: dictionaryCache, map: dictionaryMap };
  }

  try {
    console.log("DATABASE dan so'zlar yuklanmoqda...");
    const startTime = Date.now();

    // Database dan barcha tasdiqlangan so'zlarni olish
    const words = await Word.find({ isChecked: true })
      .select("word type trustScore")
      .sort({ trustScore: -1 }) // Eng ishonchli so'zlar birinchi
      .lean()
      .exec();

    console.log(`DATABASE dan ${words.length} ta so'z topildi`);

    // Map yaratish - alifbo turlariga ajratish
    dictionaryMap.clear();
    let cyrillicCount = 0;
    let latinCount = 0;
    let mixedCount = 0;

    words.forEach((wordObj) => {
      const normalizedWord = normalizeWord(wordObj.word);
      if (normalizedWord && normalizedWord.length > 0) {
        // Alifbo turini aniqlash
        const script = detectScript(wordObj.word);

        // Map ga qo'shish
        dictionaryMap.set(normalizedWord, {
          word: wordObj.word,
          type: wordObj.type || script,
          trustScore: wordObj.trustScore || 100,
          script: script,
        });

        // Statistika
        if (script === "cyrillic") cyrillicCount++;
        else if (script === "latin") latinCount++;
        else mixedCount++;
      }
    });

    dictionaryCache = words;
    cacheTimestamp = now;

    const loadTime = Date.now() - startTime;
    console.log(`=== DICTIONARY YUKLANDI ===`);
    console.log(`Jami so'zlar: ${words.length}`);
    console.log(`Map da saqlangan: ${dictionaryMap.size}`);
    console.log(`Kirill: ${cyrillicCount}`);
    console.log(`Lotin: ${latinCount}`);
    console.log(`Aralash: ${mixedCount}`);
    console.log(`Yuklash vaqti: ${loadTime}ms`);
    console.log(`========================`);

    return { words: dictionaryCache, map: dictionaryMap };
  } catch (error) {
    console.error("DATABASE xatosi:", error);

    // Agar xato bo'lsa, eski cache qaytarish
    if (dictionaryCache && dictionaryMap.size > 0) {
      console.log("DATABASE xatosi, eski cache ishlatiladi");
      return { words: dictionaryCache, map: dictionaryMap };
    }

    throw new Error("So'zlar bazasi yuklanmadi: " + error.message);
  }
}

// Matn ichidagi so'zlarni ajratish va tekshirish
function analyzeText(text, wordsMap) {
  if (!text || !wordsMap || wordsMap.size === 0) {
    return [];
  }

  console.log(`\n=== MATN TAHLILI ===`);
  console.log(`Matn: "${text}"`);
  console.log(`Dictionary hajmi: ${wordsMap.size}`);

  // So'zlarni ajratish (Qoraqolpoq harflari bilan)
  const wordRegex = /[\wәğqńöüşıĞQŃÖÜŞIа-яәғқңөүһҳ]+/g;
  const results = [];
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const originalWord = match[0];
    const normalizedWord = normalizeWord(originalWord);
    const wordScript = detectScript(originalWord);

    // Dictionary da qidirish
    const isCorrect = wordsMap.has(normalizedWord);
    const wordInfo = wordsMap.get(normalizedWord);

    console.log(
      `So'z: "${originalWord}" (${wordScript}) -> ${
        isCorrect ? "TOPILDI" : "TOPILMADI"
      }`
    );
    if (wordInfo) {
      console.log(
        `  Dictionary ma'lumot: type=${wordInfo.type}, script=${wordInfo.script}, trust=${wordInfo.trustScore}`
      );
    }

    results.push({
      word: originalWord,
      normalizedWord: normalizedWord,
      start: match.index,
      end: match.index + originalWord.length,
      isCorrect: isCorrect,
      script: wordScript,
      suggestions: [],
      wordInfo: wordInfo || null,
    });
  }

  console.log(
    `Jami ${results.length} so'z, ${
      results.filter((r) => !r.isCorrect).length
    } xato`
  );
  return results;
}

// Xato so'z uchun takliflar topish
function findSuggestions(targetWord, wordsMap, limit = 5) {
  const normalizedTarget = normalizeWord(targetWord);
  const targetScript = detectScript(targetWord);
  const suggestions = [];

  console.log(
    `"${targetWord}" uchun takliflar qidirilmoqda (${targetScript} alifbosi)...`
  );

  // Birinchi bosqich: o'xshash so'zlarni topish
  for (const [dictWord, wordInfo] of wordsMap) {
    if (suggestions.length >= limit) break;

    // Bir xil alifbo bo'lishi kerak
    if (wordInfo.script === targetScript || wordInfo.script === "mixed") {
      // Substring match
      if (
        dictWord.includes(normalizedTarget.slice(0, 3)) &&
        dictWord !== normalizedTarget
      ) {
        suggestions.push({
          word: wordInfo.word,
          confidence: 85,
          type: "substring",
          script: wordInfo.script,
        });
      }
    }
  }

  console.log(`${suggestions.length} ta taklif topildi`);
  return suggestions;
}

// POST /api/check - ASOSIY ENDPOINT
router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Matn kiritilishi shart",
      });
    }

    console.log(`\n🔍 SPELL CHECK BOSHLANDI`);
    console.log(`Kiritilgan matn: "${text}"`);

    // Dictionary yuklash
    const { map } = await getDictionary();

    if (map.size === 0) {
      return res.status(503).json({
        error: "So'zlar bazasi bo'sh yoki yuklanmagan",
      });
    }

    // Matnni tahlil qilish
    const results = analyzeText(text, map);

    // Xato so'zlar uchun takliflar topish
    const resultsWithSuggestions = results.map((result) => {
      if (!result.isCorrect) {
        result.suggestions = findSuggestions(result.word, map, 3);
      }
      return result;
    });

    const errorCount = resultsWithSuggestions.filter(
      (r) => !r.isCorrect
    ).length;

    console.log(`✅ NATIJA: ${results.length} so'z, ${errorCount} xato`);

    const response = {
      success: true,
      results: resultsWithSuggestions,
      statistics: {
        totalWords: results.length,
        correctWords: results.length - errorCount,
        incorrectWords: errorCount,
        dictionarySize: map.size,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("❌ SPELL CHECK XATOSI:", error);
    res.status(500).json({
      error: "Server xatosi",
      message: error.message,
    });
  }
});

// POST /api/check/auto-correct - AVTOMATIK TO'G'RILASH
router.post("/auto-correct", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Matn kiritilishi shart",
      });
    }

    console.log(`\n🔧 AUTO-CORRECT BOSHLANDI`);
    console.log(`Original: "${text}"`);

    const { map } = await getDictionary();
    let correctedText = text;
    let correctionCount = 0;
    const corrections = [];

    // Matnni tahlil qilish
    const results = analyzeText(text, map);

    // Har bir xato so'zni to'g'rilash
    let offset = 0;

    for (const result of results) {
      if (!result.isCorrect) {
        const suggestions = findSuggestions(result.word, map, 1);

        if (suggestions.length > 0 && suggestions[0].confidence > 75) {
          const originalStart = result.start + offset;
          const originalEnd = result.end + offset;
          const suggestion = suggestions[0].word;

          // Matnda almashtirish
          const before = correctedText.slice(0, originalStart);
          const after = correctedText.slice(originalEnd);
          correctedText = before + suggestion + after;

          // Offset yangilash
          offset += suggestion.length - result.word.length;
          correctionCount++;

          corrections.push({
            original: result.word,
            corrected: suggestion,
            position: originalStart,
          });

          console.log(
            `"${result.word}" -> "${suggestion}" (confidence: ${suggestions[0].confidence}%)`
          );
        }
      }
    }

    console.log(`✅ ${correctionCount} ta o'zgarish amalga oshirildi`);
    console.log(`Corrected: "${correctedText}"`);

    res.json({
      success: true,
      originalText: text,
      correctedText: correctedText,
      correctionCount: correctionCount,
      corrections: corrections,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ AUTO-CORRECT XATOSI:", error);
    res.status(500).json({
      error: "Server xatosi",
      message: error.message,
    });
  }
});

// Cache yangilash
router.post("/refresh-cache", async (req, res) => {
  try {
    await getDictionary(true);
    res.json({
      success: true,
      message: "Dictionary cache yangilandi",
    });
  } catch (error) {
    res.status(500).json({
      error: "Cache yangilashda xato: " + error.message,
    });
  }
});

// GET /api/check/stats - Dictionary statistikasi
router.get("/stats", async (req, res) => {
  try {
    const { map } = await getDictionary();

    let cyrillicCount = 0;
    let latinCount = 0;
    let mixedCount = 0;

    for (const [, wordInfo] of map) {
      if (wordInfo.script === "cyrillic") cyrillicCount++;
      else if (wordInfo.script === "latin") latinCount++;
      else mixedCount++;
    }

    res.json({
      success: true,
      stats: {
        totalWords: map.size,
        cyrillic: cyrillicCount,
        latin: latinCount,
        mixed: mixedCount,
        lastUpdate: cacheTimestamp
          ? new Date(cacheTimestamp).toISOString()
          : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Statistika olishda xato",
    });
  }
});

module.exports = router;
