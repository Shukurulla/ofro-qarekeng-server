const express = require("express");
const Word = require("../models/Word.js");
const router = express.Router();

// Levenshtein distance algoritmi
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // Agar bir so'z bo'sh bo'lsa
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Matrix yaratish
  const matrix = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  // Birinchi qator va ustunni to'ldirish
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  // Matrix to'ldirish
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // almashtirish
          matrix[j][i - 1] + 1, // qo'shish
          matrix[j - 1][i] + 1 // o'chirish
        );
      }
    }
  }

  return matrix[len2][len1];
}

// Alifbo turini aniqlash
function detectScriptType(text) {
  const cyrillicCount = (text.match(/[а-яёәғқңөүһҳ]/gi) || []).length;
  const latinCount = (text.match(/[a-zәğqńöüşı]/gi) || []).length;

  if (cyrillicCount > latinCount) return "kiril";
  if (latinCount > cyrillicCount) return "lotin";
  return "mixed";
}

// So'zni tozalash
function cleanWord(word) {
  return word
    .replace(/[^\wәғқңөүһҳğqńöüşı]/gi, "")
    .toLowerCase()
    .trim();
}

// Matnni so'zlarga ajratish
function tokenizeText(text) {
  if (!text || typeof text !== "string") return [];

  const words = [];
  const wordRegex = /[\wәғқңөүһҳğqńöüşı]+/gi;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const cleanedWord = cleanWord(match[0]);
    if (cleanedWord.length > 0) {
      words.push({
        word: cleanedWord,
        originalWord: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return words;
}

// O'xshash so'zlarni topish
async function findSimilarWords(targetWord, scriptType, limit = 5) {
  try {
    // Avval to'g'ridan-to'g'ri qidirish
    const exactMatches = await Word.find({
      word: { $regex: `^${targetWord}`, $options: "i" },
      type: scriptType,
      isChecked: true,
    })
      .limit(limit)
      .select("word trustScore");

    if (exactMatches.length >= limit) {
      return exactMatches.map((w) => ({
        word: w.word,
        similarity: 100,
        trustScore: w.trustScore,
      }));
    }

    // Agar yetarli bo'lmasa, barcha so'zlarni olib, Levenshtein distance bilan solishtirish
    const allWords = await Word.find({
      type: scriptType,
      isChecked: true,
      word: { $regex: `^[${targetWord.charAt(0)}]`, $options: "i" }, // Birinchi harf bo'yicha filter
    })
      .select("word trustScore")
      .limit(1000);

    const similarities = allWords.map((wordObj) => {
      const distance = levenshteinDistance(targetWord, wordObj.word);
      const maxLength = Math.max(targetWord.length, wordObj.word.length);
      const similarity = ((maxLength - distance) / maxLength) * 100;

      return {
        word: wordObj.word,
        similarity: Math.round(similarity),
        trustScore: wordObj.trustScore,
        distance: distance,
      };
    });

    // O'xshashlik bo'yicha saralash
    similarities.sort((a, b) => {
      if (a.similarity !== b.similarity) {
        return b.similarity - a.similarity;
      }
      return b.trustScore - a.trustScore;
    });

    // Faqat 50% dan yuqori o'xshashlikni qaytarish
    return similarities.filter((s) => s.similarity >= 50).slice(0, limit);
  } catch (error) {
    console.error("Similar words topishda xato:", error);
    return [];
  }
}

// Asosiy imlo tekshirish
router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Matn kiritilishi shart",
      });
    }

    if (text.length > 50000) {
      return res.status(400).json({
        success: false,
        error: "Matn juda uzun (maksimal 50,000 belgi)",
      });
    }

    // Matnni so'zlarga ajratish
    const words = tokenizeText(text);

    if (words.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Matnda so'z topilmadi",
      });
    }

    // Alifbo turini aniqlash
    const scriptType = detectScriptType(text);

    // Har bir so'zni tekshirish
    const results = [];
    const mistakes = [];

    for (const wordObj of words) {
      const { word, originalWord, start, end } = wordObj;

      // So'zni bazadan qidirish
      const foundWord = await Word.findOne({
        word: word,
        type: scriptType,
        isChecked: true,
      });

      if (foundWord) {
        // To'g'ri so'z
        results.push({
          word: originalWord,
          isCorrect: true,
          start: start,
          end: end,
          suggestions: [],
        });
      } else {
        // Xato so'z - o'xshash so'zlarni topish
        const similarWords = await findSimilarWords(word, scriptType, 5);

        results.push({
          word: originalWord,
          isCorrect: false,
          start: start,
          end: end,
          suggestions: similarWords,
        });

        mistakes.push({
          mistakeWord: originalWord,
          similarWords: similarWords,
        });
      }
    }

    // Statistika hisoblash
    const totalWords = results.length;
    const correctWords = results.filter((r) => r.isCorrect).length;
    const incorrectWords = totalWords - correctWords;
    const accuracy = totalWords > 0 ? (correctWords / totalWords) * 100 : 0;

    res.json({
      success: true,
      data: {
        results: results,
        mistakes: mistakes,
        statistics: {
          totalWords: totalWords,
          correctWords: correctWords,
          incorrectWords: incorrectWords,
          accuracy: Math.round(accuracy * 100) / 100,
          textLength: text.length,
          scriptType: scriptType,
        },
      },
    });
  } catch (error) {
    console.error("Imlo tekshirish xatosi:", error);
    res.status(500).json({
      success: false,
      error: "Server xatosi yuz berdi",
    });
  }
});

// Bitta so'zni tekshirish
router.post("/word", async (req, res) => {
  try {
    const { word } = req.body;

    if (!word || typeof word !== "string") {
      return res.status(400).json({
        success: false,
        error: "So'z kiritilishi shart",
      });
    }

    const cleanedWord = cleanWord(word);
    const scriptType = detectScriptType(word);

    // So'zni bazadan qidirish
    const foundWord = await Word.findOne({
      word: cleanedWord,
      type: scriptType,
      isChecked: true,
    });

    if (foundWord) {
      res.json({
        success: true,
        data: {
          word: word,
          isCorrect: true,
          wordInfo: {
            type: foundWord.type,
            trustScore: foundWord.trustScore,
            category: foundWord.category,
          },
        },
      });
    } else {
      // O'xshash so'zlarni topish
      const similarWords = await findSimilarWords(cleanedWord, scriptType, 5);

      res.json({
        success: true,
        data: {
          word: word,
          isCorrect: false,
          suggestions: similarWords,
        },
      });
    }
  } catch (error) {
    console.error("So'z tekshirish xatosi:", error);
    res.status(500).json({
      success: false,
      error: "Server xatosi yuz berdi",
    });
  }
});

// Matnni avtomatik to'g'irlash
router.post("/auto-correct", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Matn kiritilishi shart",
      });
    }

    // Avval imlo tekshirish
    const words = tokenizeText(text);
    const scriptType = detectScriptType(text);

    let correctedText = text;
    const corrections = [];
    let offsetChange = 0;

    for (const wordObj of words) {
      const { word, originalWord, start, end } = wordObj;

      // So'zni bazadan qidirish
      const foundWord = await Word.findOne({
        word: word,
        type: scriptType,
        isChecked: true,
      });

      if (!foundWord) {
        // Xato so'z - eng yaxshi taklifni topish
        const similarWords = await findSimilarWords(word, scriptType, 1);

        if (similarWords.length > 0 && similarWords[0].similarity >= 70) {
          const bestSuggestion = similarWords[0].word;
          const actualStart = start + offsetChange;
          const actualEnd = end + offsetChange;

          // Matnni to'g'irlash
          correctedText =
            correctedText.slice(0, actualStart) +
            bestSuggestion +
            correctedText.slice(actualEnd);

          offsetChange += bestSuggestion.length - originalWord.length;

          corrections.push({
            original: originalWord,
            corrected: bestSuggestion,
            position: start,
            similarity: similarWords[0].similarity,
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        original: text,
        corrected: correctedText,
        corrections: corrections,
        correctionCount: corrections.length,
      },
    });
  } catch (error) {
    console.error("Avtomatik to'g'irlash xatosi:", error);
    res.status(500).json({
      success: false,
      error: "Server xatosi yuz berdi",
    });
  }
});

module.exports = router;
