// utils/transliterate.js - YANGILANGAN VERSIYA

// Qoraqolpoq tili transliteratsiya jadvallar - TO'LQIN VA TO'G'RI

// Kirildan Lotinga - aniq va to'liq jadval
const CYRILLIC_TO_LATIN = {
  а: "a",
  А: "A",
  ә: "ә",
  Ә: "Ә",
  б: "b",
  Б: "B",
  в: "v",
  В: "V",
  г: "g",
  Г: "G",
  ғ: "ğ",
  Ғ: "Ğ",
  д: "d",
  Д: "D",
  е: "e",
  Е: "E",
  ж: "j",
  Ж: "J",
  з: "z",
  З: "Z",
  и: "i",
  И: "I", // Bu yerda aniq: и -> i
  й: "y",
  Й: "Y",
  к: "k",
  К: "K",
  қ: "q",
  Қ: "Q",
  л: "l",
  Л: "L",
  м: "m",
  М: "M",
  н: "n",
  Н: "N",
  ң: "ń",
  Ң: "Ń",
  о: "o",
  О: "O",
  ө: "ö",
  Ө: "Ö",
  п: "p",
  П: "P",
  р: "r",
  Р: "R",
  с: "s",
  С: "S",
  т: "t",
  Т: "T",
  у: "w",
  У: "W", // Qoraqolpoq tilida у -> w
  ү: "ü",
  Ү: "Ü",
  ф: "f",
  Ф: "F",
  х: "x",
  Х: "X",
  ҳ: "h",
  Ҳ: "H", // Qoraqolpoq tilida ҳ -> h
  ц: "c",
  Ц: "C",
  ч: "ch",
  Ч: "Ch",
  ш: "sh",
  Ш: "Sh",
  щ: "shch",
  Щ: "Shch",
  ъ: "",
  Ъ: "",
  ы: "ı",
  Ы: "I", // ы -> ı (dotless i)
  ь: "",
  Ь: "",
  э: "e",
  Э: "E",
  ю: "yu",
  Ю: "Yu",
  я: "ya",
  Я: "Ya",
};

// Lotindan Kirilga - aniq va to'liq jadval
const LATIN_TO_CYRILLIC = {
  a: "а",
  A: "А",
  ә: "ә",
  Ә: "Ә",
  b: "б",
  B: "Б",
  v: "в",
  V: "В",
  g: "г",
  G: "Г",
  ğ: "ғ",
  Ğ: "Ғ",
  d: "д",
  D: "Д",
  e: "е",
  E: "Е",
  j: "ж",
  J: "Ж",
  z: "з",
  Z: "З",
  i: "и",
  I: "И", // i -> и (aniq qoida)
  ı: "ы",
  I: "Ы", // ı (dotless i) -> ы
  y: "й",
  Y: "Й",
  k: "к",
  K: "К",
  q: "қ",
  Q: "Қ",
  l: "л",
  L: "Л",
  m: "м",
  M: "М",
  n: "н",
  N: "Н",
  ń: "ң",
  Ń: "Ң",
  o: "о",
  O: "О",
  ö: "ө",
  Ö: "Ө",
  p: "п",
  P: "П",
  r: "р",
  R: "Р",
  s: "с",
  S: "С",
  t: "т",
  T: "Т",
  w: "у",
  W: "У", // w -> у (Qoraqolpoq stilida)
  ü: "ү",
  Ü: "Ү",
  f: "ф",
  F: "Ф",
  x: "х",
  X: "Х",
  h: "ҳ",
  H: "Ҳ", // h -> ҳ
  c: "ц",
  C: "Ц",
};

// Maxsus kombinatsiyalar (ikki harfli)
const SPECIAL_COMBINATIONS = {
  // Kirildan Lotinga
  cyrillic: {
    тс: "c", // тс -> c
    дз: "dz", // дз -> dz
    нг: "ng", // нг -> ng
  },
  // Lotindan Kirilga
  latin: {
    ch: "ч", // ch -> ч
    sh: "ш", // sh -> ш
    yu: "ю", // yu -> ю
    ya: "я", // ya -> я
    ng: "нг", // ng -> нг
    dz: "дз", // dz -> дз
    shch: "щ", // shch -> щ
  },
};

// Matnning qaysi alifboda ekanligini aniqlash - YAXSHILANGAN
function detectScript(text) {
  if (!text || typeof text !== "string") return "unknown";

  // Faqat harflarni sanash
  const cyrillicChars = text.match(/[а-яёәғқңөүһҳ]/gi) || [];
  const latinChars = text.match(/[a-zәğqńöüşıćžđ]/gi) || [];

  const cyrillicCount = cyrillicChars.length;
  const latinCount = latinChars.length;
  const totalChars = cyrillicCount + latinCount;

  // Agar harflar kam bo'lsa
  if (totalChars < 3) return "mixed";

  const cyrillicPercentage = (cyrillicCount / totalChars) * 100;
  const latinPercentage = (latinCount / totalChars) * 100;

  // Aniq farqlash
  if (cyrillicPercentage >= 80) return "cyrillic";
  if (latinPercentage >= 80) return "latin";
  return "mixed";
}

// Kirildan Lotinga transliteratsiya - YAXSHILANGAN
function cyrillicToLatin(text) {
  if (!text) return "";

  let result = "";
  let i = 0;

  while (i < text.length) {
    // Ikki harfli kombinatsiyalarni tekshirish
    let matched = false;

    // 4 harfli kombinatsiyalar
    if (i + 3 < text.length) {
      const fourChar = text.slice(i, i + 4).toLowerCase();
      if (SPECIAL_COMBINATIONS.cyrillic[fourChar]) {
        result += SPECIAL_COMBINATIONS.cyrillic[fourChar];
        i += 4;
        matched = true;
      }
    }

    // 3 harfli kombinatsiyalar
    if (!matched && i + 2 < text.length) {
      const threeChar = text.slice(i, i + 3).toLowerCase();
      if (SPECIAL_COMBINATIONS.cyrillic[threeChar]) {
        result += SPECIAL_COMBINATIONS.cyrillic[threeChar];
        i += 3;
        matched = true;
      }
    }

    // 2 harfli kombinatsiyalar
    if (!matched && i + 1 < text.length) {
      const twoChar = text.slice(i, i + 2).toLowerCase();
      if (SPECIAL_COMBINATIONS.cyrillic[twoChar]) {
        result += SPECIAL_COMBINATIONS.cyrillic[twoChar];
        i += 2;
        matched = true;
      }
    }

    // Bitta harf
    if (!matched) {
      const char = text[i];
      if (CYRILLIC_TO_LATIN.hasOwnProperty(char)) {
        result += CYRILLIC_TO_LATIN[char];
      } else {
        result += char; // Boshqa belgilarni o'zgartirishsiz qoldirish
      }
      i++;
    }
  }

  return result;
}

// Lotindan Kirilga transliteratsiya - YAXSHILANGAN
function latinToCyrillic(text) {
  if (!text) return "";

  let result = "";
  let i = 0;

  while (i < text.length) {
    let matched = false;

    // 4 harfli kombinatsiyalar
    if (i + 3 < text.length) {
      const fourChar = text.slice(i, i + 4).toLowerCase();
      if (SPECIAL_COMBINATIONS.latin[fourChar]) {
        result += SPECIAL_COMBINATIONS.latin[fourChar];
        i += 4;
        matched = true;
      }
    }

    // 2 harfli kombinatsiyalar
    if (!matched && i + 1 < text.length) {
      const twoChar = text.slice(i, i + 2).toLowerCase();
      if (SPECIAL_COMBINATIONS.latin[twoChar]) {
        // Katta harflarni hisobga olish
        if (text[i] === text[i].toUpperCase()) {
          result +=
            SPECIAL_COMBINATIONS.latin[twoChar].charAt(0).toUpperCase() +
            SPECIAL_COMBINATIONS.latin[twoChar].slice(1);
        } else {
          result += SPECIAL_COMBINATIONS.latin[twoChar];
        }
        i += 2;
        matched = true;
      }
    }

    // Bitta harf
    if (!matched) {
      const char = text[i];
      if (LATIN_TO_CYRILLIC.hasOwnProperty(char)) {
        result += LATIN_TO_CYRILLIC[char];
      } else {
        result += char;
      }
      i++;
    }
  }

  return result;
}

// Avtomatik transliteratsiya
function autoTransliterate(text) {
  const script = detectScript(text);

  if (script === "cyrillic") {
    return {
      result: cyrillicToLatin(text),
      from: "cyrillic",
      to: "latin",
      confidence: 95,
    };
  } else if (script === "latin") {
    return {
      result: latinToCyrillic(text),
      from: "latin",
      to: "cyrillic",
      confidence: 95,
    };
  } else {
    return {
      result: text,
      from: "mixed",
      to: "mixed",
      message: "Matnda aralash alifbo ishlatilgan",
      confidence: 50,
    };
  }
}

// Manual transliteratsiya
function manualTransliterate(text, direction) {
  if (direction === "toLatin") {
    return cyrillicToLatin(text);
  } else if (direction === "toCyrillic") {
    return latinToCyrillic(text);
  }
  return text;
}

// Qoraqolpoq tiliga xos so'zlarni to'g'rilash
function correctKarakalpakWords(text) {
  // Tez-tez uchraydigan noto'g'ri yozuvlarni to'g'rilash
  const corrections = {
    // Kirill variantlari
    карақалпақ: "қарақалпақ",
    карақалпақстан: "қарақалпақстан",
    нокис: "нөкис",
    амудария: "әмүдәрья",

    // Lotin variantlari
    qaraqolpaq: "qaraqalpaq",
    qaraqolpaqstan: "qaraqalpaqstan",
    noukis: "nökis",
    nukus: "nökis",
    amudarya: "әmüdärya",
  };

  let correctedText = text;
  Object.keys(corrections).forEach((wrong) => {
    const pattern = new RegExp(`\\b${wrong}\\b`, "gi");
    correctedText = correctedText.replace(pattern, (match) => {
      const correct = corrections[wrong];
      // Katta/kichik harflarni saqlash
      if (match === match.toUpperCase()) {
        return correct.toUpperCase();
      } else if (match[0] === match[0].toUpperCase()) {
        return correct.charAt(0).toUpperCase() + correct.slice(1).toLowerCase();
      }
      return correct.toLowerCase();
    });
  });

  return correctedText;
}

module.exports = {
  detectScript,
  cyrillicToLatin,
  latinToCyrillic,
  autoTransliterate,
  manualTransliterate,
  correctKarakalpakWords,
  CYRILLIC_TO_LATIN,
  LATIN_TO_CYRILLIC,
  SPECIAL_COMBINATIONS,
};
