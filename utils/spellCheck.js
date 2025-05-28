// utils/spellCheck.js - YANGILANGAN VA OPTIMIZATSIYA QILINGAN

const { correctKarakalpakWords } = require("./transliterate");

// Tezkor Levenshtein Distance algoritmi (optimizatsiya qilingan)
function levenshteinDistance(str1, str2, maxDistance = 3) {
  const len1 = str1.length;
  const len2 = str2.length;

  // Agar farq juda katta bo'lsa, hisoblashni to'xtatish
  if (Math.abs(len1 - len2) > maxDistance) return maxDistance + 1;

  // Kichik massiv ishlatish (memory efficient)
  const matrix = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  // Birinchi qator va ustunni to'ldirish
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

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

      // Agar juda katta bo'lsa, to'xtatish
      if (matrix[j][i] > maxDistance) return maxDistance + 1;
    }
  }

  return matrix[len2][len1];
}

// So'zlarni tezkor ajratish (regex optimizatsiya)
function tokenizeText(text) {
  if (!text || typeof text !== "string") return [];

  // Qoraqolpoq tili uchun maxsus regex
  const wordRegex = /[\wәğqńöüşıĞQŃÖÜŞIа-яәғқңөүһҳ]+/g;
  const positions = [];
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    positions.push({
      word: match[0].toLowerCase(),
      originalWord: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return positions;
}

// So'zni tezkor normallashtirish
function normalizeWord(word) {
  if (!word) return "";
  return word
    .toLowerCase()
    .trim()
    .replace(/[^\wәğqńöüşıĞQŃÖÜŞIа-яәғқңөүһҳ]/g, "");
}

// Yaqin so'zlarni topish - OPTIMIZATSIYA QILINGAN
function findSimilarWords(
  targetWord,
  wordsList,
  maxDistance = 2,
  maxResults = 5
) {
  const suggestions = [];
  const normalizedTarget = normalizeWord(targetWord);

  // Birinchi bosqich: substring matches (tezroq)
  const exactMatches = [];
  const similarMatches = [];

  for (
    let i = 0;
    i < wordsList.length && exactMatches.length < maxResults;
    i++
  ) {
    const wordObj = wordsList[i];
    const word = typeof wordObj === "string" ? wordObj : wordObj.word;
    const normalizedWord = normalizeWord(word);

    // O'zini o'tkazib yuborish
    if (normalizedWord === normalizedTarget) continue;

    // Substring match
    if (
      normalizedWord.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedWord)
    ) {
      exactMatches.push({
        word: word,
        distance: 0,
        confidence: 95,
        type: "substring",
      });
    }
  }

  // Ikkinchi bosqich: Levenshtein distance (agar kerak bo'lsa)
  if (exactMatches.length < maxResults) {
    const remaining = maxResults - exactMatches.length;

    for (
      let i = 0;
      i < wordsList.length && similarMatches.length < remaining * 2;
      i++
    ) {
      const wordObj = wordsList[i];
      const word = typeof wordObj === "string" ? wordObj : wordObj.word;
      const normalizedWord = normalizeWord(word);

      // Allaqachon exact match bo'lganlarni o'tkazib yuborish
      if (exactMatches.some((m) => normalizeWord(m.word) === normalizedWord))
        continue;

      const distance = levenshteinDistance(
        normalizedTarget,
        normalizedWord,
        maxDistance
      );

      if (distance <= maxDistance) {
        similarMatches.push({
          word: word,
          distance: distance,
          confidence: Math.max(0, 100 - distance * 25),
          type: "similar",
        });
      }
    }
  }

  // Saralash va birlashtirish
  const allSuggestions = [
    ...exactMatches,
    ...similarMatches.sort(
      (a, b) => a.distance - b.distance || b.confidence - a.confidence
    ),
  ];

  return allSuggestions.slice(0, maxResults);
}

// Matn imlosini tezkor tekshirish - YANGILANGAN
function checkTextSpelling(text, dictionary) {
  if (!text || !dictionary || dictionary.length === 0) return [];

  const tokens = tokenizeText(text);
  const results = [];

  // Dictionary ni Map ga aylantirish (tezroq qidirish uchun)
  const dictionaryMap = new Map();
  dictionary.forEach((wordObj) => {
    const word = typeof wordObj === "string" ? wordObj : wordObj.word;
    const normalizedWord = normalizeWord(word);
    dictionaryMap.set(normalizedWord, wordObj);
  });

  tokens.forEach((token) => {
    const isCorrect = dictionaryMap.has(normalizeWord(token.word));

    const result = {
      word: token.originalWord,
      normalizedWord: token.word,
      start: token.start,
      end: token.end,
      isCorrect: isCorrect,
      suggestions: [],
    };

    // Agar xato bo'lsa, takliflar topish
    if (!isCorrect) {
      result.suggestions = findSimilarWords(token.word, dictionary, 2, 3);
    }

    results.push(result);
  });

  return results;
}

// So'z qidirish (fuzzy search) - OPTIMIZATSIYA QILINGAN
function fuzzySearch(query, dictionary, limit = 10) {
  const normalizedQuery = normalizeWord(query);
  const results = [];

  dictionary.forEach((wordObj) => {
    const word = typeof wordObj === "string" ? wordObj : wordObj.word;
    const normalizedWord = normalizeWord(word);
    const wordType = typeof wordObj === "object" ? wordObj.type : null;

    // To'g'ridan-to'g'ri mos kelish
    if (normalizedWord.includes(normalizedQuery)) {
      results.push({
        word: word,
        type: wordType || "exact",
        score: 100,
        matchType: "substring",
      });
    } else {
      // Yaqin so'zlar
      const distance = levenshteinDistance(normalizedQuery, normalizedWord, 3);
      if (distance <= 3) {
        results.push({
          word: word,
          type: wordType || "similar",
          score: Math.max(0, 100 - distance * 20),
          matchType: "similar",
          distance: distance,
        });
      }
    }
  });

  return results
    .sort((a, b) => {
      // Birinchi substring matches, keyin similar
      if (a.matchType !== b.matchType) {
        return a.matchType === "substring" ? -1 : 1;
      }
      return b.score - a.score;
    })
    .slice(0, limit);
}

// Matn statistikasi - YAXSHILANGAN
function getTextStatistics(text, spellResults) {
  const totalWords = spellResults.length;
  const correctWords = spellResults.filter((r) => r.isCorrect).length;
  const incorrectWords = totalWords - correctWords;
  const accuracy = totalWords > 0 ? (correctWords / totalWords) * 100 : 0;

  // Qo'shimcha statistikalar
  const uniqueErrors = new Set(
    spellResults.filter((r) => !r.isCorrect).map((r) => r.normalizedWord)
  ).size;

  const averageWordLength =
    totalWords > 0
      ? spellResults.reduce((sum, r) => sum + r.word.length, 0) / totalWords
      : 0;

  const readingTime = Math.ceil(totalWords / 200); // 200 so'z/daqiqa

  return {
    totalWords,
    correctWords,
    incorrectWords,
    uniqueErrors,
    accuracy: Math.round(accuracy * 100) / 100,
    textLength: text.length,
    averageWordLength: Math.round(averageWordLength * 10) / 10,
    readingTime: readingTime,
    wordsPerSentence:
      totalWords > 0
        ? Math.round(
            totalWords / Math.max(1, (text.match(/[.!?]/g) || []).length)
          )
        : 0,
  };
}

// Avtomatik to'g'rilash funksiyasi - YANGI
function autoCorrectText(text, dictionary) {
  // 1. Qoraqolpoq tiliga xos xatolarni to'g'rilash
  let correctedText = correctKarakalpakWords(text);

  // 2. Imlo xatolarini avtomatik to'g'rilash
  const spellResults = checkTextSpelling(correctedText, dictionary);

  // O'zgarishlar ro'yxati
  const corrections = [];
  let offsetChange = 0;

  spellResults.forEach((result) => {
    if (!result.isCorrect && result.suggestions.length > 0) {
      // Eng yaxshi taklifni tanlash (confidence > 80)
      const bestSuggestion = result.suggestions[0];
      if (bestSuggestion.confidence > 80) {
        const originalStart = result.start + offsetChange;
        const originalEnd = result.end + offsetChange;

        const before = correctedText.slice(0, originalStart);
        const after = correctedText.slice(originalEnd);

        corrections.push({
          original: result.word,
          corrected: bestSuggestion.word,
          position: originalStart,
          confidence: bestSuggestion.confidence,
        });

        correctedText = before + bestSuggestion.word + after;
        offsetChange += bestSuggestion.word.length - result.word.length;
      }
    }
  });

  return {
    correctedText: correctedText,
    corrections: corrections,
    correctionCount: corrections.length,
    originalText: text,
  };
}

// Cache tizimi (server-side memory cache)
const spellCheckCache = new Map();
const MAX_CACHE_SIZE = 1000;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minut

function getCachedResult(key) {
  const cached = spellCheckCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedResult(key, data) {
  // Cache size ni nazorat qilish
  if (spellCheckCache.size >= MAX_CACHE_SIZE) {
    const firstKey = spellCheckCache.keys().next().value;
    spellCheckCache.delete(firstKey);
  }

  spellCheckCache.set(key, {
    data: data,
    timestamp: Date.now(),
  });
}

module.exports = {
  levenshteinDistance,
  tokenizeText,
  normalizeWord,
  findSimilarWords,
  checkTextSpelling,
  fuzzySearch,
  getTextStatistics,
  autoCorrectText,
  getCachedResult,
  setCachedResult,
};
