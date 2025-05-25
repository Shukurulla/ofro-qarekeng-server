// Levenshtein Distance algoritmi - AI emas, klassik algoritm
function levenshteinDistance(str1, str2) {
  const matrix = [];

  // Matritsa yaratish
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Matritsa to'ldirish
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // almashtirish
          matrix[i][j - 1] + 1, // qo'shish
          matrix[i - 1][j] + 1 // o'chirish
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Matnni so'zlarga ajratish
function tokenizeText(text) {
  // Tinish belgilari va bo'shliqlar bilan ajratish
  const words = text.match(/[\wәğqńöüşıĞQŃÖÜŞIа-яәғқңөүһ]+/gi) || [];
  const positions = [];
  let lastIndex = 0;

  words.forEach((word) => {
    const index = text.indexOf(word, lastIndex);
    positions.push({
      word: word.toLowerCase(),
      originalWord: word,
      start: index,
      end: index + word.length,
    });
    lastIndex = index + word.length;
  });

  return positions;
}

// So'zni normallashtirish
function normalizeWord(word) {
  return word
    .toLowerCase()
    .trim()
    .replace(/[^\wәğqńöüşıĞQŃÖÜŞIа-яәғқңөүһ]/g, "");
}

// Yaqin so'zlarni topish
function findSimilarWords(
  targetWord,
  wordsList,
  maxDistance = 2,
  maxResults = 5
) {
  const suggestions = [];
  const normalizedTarget = normalizeWord(targetWord);

  wordsList.forEach((wordObj) => {
    const word = typeof wordObj === "string" ? wordObj : wordObj.word;
    const normalizedWord = normalizeWord(word);

    // Bir xil so'zni o'tkazib yuborish
    if (normalizedWord === normalizedTarget) return;

    const distance = levenshteinDistance(normalizedTarget, normalizedWord);

    if (distance <= maxDistance) {
      suggestions.push({
        word: word,
        distance: distance,
        confidence: Math.max(0, 100 - distance * 25), // Ishonch darajasi
      });
    }
  });

  // Eng yaqin so'zlarni saralash
  return suggestions
    .sort((a, b) => a.distance - b.distance || b.confidence - a.confidence)
    .slice(0, maxResults);
}

// Matn imlosini tekshirish
function checkTextSpelling(text, dictionary) {
  const tokens = tokenizeText(text);
  const results = [];

  tokens.forEach((token) => {
    const isCorrect = dictionary.some((wordObj) => {
      const word = typeof wordObj === "string" ? wordObj : wordObj.word;
      return normalizeWord(word) === normalizeWord(token.word);
    });

    if (!isCorrect) {
      const suggestions = findSimilarWords(token.word, dictionary);

      results.push({
        word: token.originalWord,
        normalizedWord: token.word,
        start: token.start,
        end: token.end,
        isCorrect: false,
        suggestions: suggestions,
      });
    } else {
      results.push({
        word: token.originalWord,
        normalizedWord: token.word,
        start: token.start,
        end: token.end,
        isCorrect: true,
        suggestions: [],
      });
    }
  });

  return results;
}

// So'z qidirish (fuzzy search)
function fuzzySearch(query, dictionary, limit = 10) {
  const normalizedQuery = normalizeWord(query);
  const results = [];

  dictionary.forEach((wordObj) => {
    const word = typeof wordObj === "string" ? wordObj : wordObj.word;
    const normalizedWord = normalizeWord(word);

    // To'g'ridan-to'g'ri mos kelish
    if (normalizedWord.includes(normalizedQuery)) {
      results.push({
        word: word,
        type: "exact",
        score: 100,
      });
    } else {
      // Yaqin so'zlar
      const distance = levenshteinDistance(normalizedQuery, normalizedWord);
      if (distance <= 3) {
        results.push({
          word: word,
          type: "similar",
          score: Math.max(0, 100 - distance * 20),
        });
      }
    }
  });

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Matn statistikasi
function getTextStatistics(text, spellResults) {
  const totalWords = spellResults.length;
  const correctWords = spellResults.filter((r) => r.isCorrect).length;
  const incorrectWords = totalWords - correctWords;
  const accuracy = totalWords > 0 ? (correctWords / totalWords) * 100 : 0;

  return {
    totalWords,
    correctWords,
    incorrectWords,
    accuracy: parseFloat(accuracy.toFixed(2)),
    textLength: text.length,
  };
}

module.exports = {
  levenshteinDistance,
  tokenizeText,
  normalizeWord,
  findSimilarWords,
  checkTextSpelling,
  fuzzySearch,
  getTextStatistics,
};
