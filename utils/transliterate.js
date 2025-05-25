// Qoraqolpoq tili transliteratsiya jadvallar

// Kirildan Lotinga
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
  и: "ı",
  И: "I",
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
  У: "W",
  ү: "ü",
  Ү: "Ü",
  ф: "f",
  Ф: "F",
  х: "x",
  Х: "X",
  ц: "ts",
  Ц: "Ts",
  ч: "sh",
  Ч: "Sh",
  ш: "ş",
  Ш: "Ş",
  щ: "şsh",
  Щ: "Şsh",
  ъ: "",
  Ъ: "",
  ы: "ı",
  Ы: "I",
  ь: "",
  Ь: "",
  э: "e",
  Э: "E",
  ю: "yu",
  Ю: "Yu",
  я: "ya",
  Я: "Ya",
};

// Lotindan Kirilga
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
  ı: "и",
  I: "И",
  i: "и", // alternative
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
  W: "У",
  ü: "ү",
  Ü: "Ү",
  f: "ф",
  F: "Ф",
  x: "х",
  X: "Х",
  ş: "ш",
  Ş: "Ш",
};

// Matnning qaysi alifboda ekanligini aniqlash
function detectScript(text) {
  const cyrillicCount = (text.match(/[а-яәғқңөүһ]/gi) || []).length;
  const latinCount = (text.match(/[a-zәğqńöüşi]/gi) || []).length;

  if (cyrillicCount > latinCount) return "cyrillic";
  if (latinCount > cyrillicCount) return "latin";
  return "mixed";
}

// Kirildan Lotinga transliteratsiya
function cyrillicToLatin(text) {
  let result = "";
  let i = 0;

  while (i < text.length) {
    let char = text[i];
    let nextChar = text[i + 1];

    // Ikki harfli kombinatsiyalarni tekshirish
    if (char === "т" && nextChar === "с") {
      result += "ts";
      i += 2;
      continue;
    }
    if (char === "Т" && nextChar === "с") {
      result += "Ts";
      i += 2;
      continue;
    }
    if (char === "с" && nextChar === "х") {
      result += "sh";
      i += 2;
      continue;
    }
    if (char === "С" && nextChar === "х") {
      result += "Sh";
      i += 2;
      continue;
    }

    // Oddiy harflarni almashtirib
    if (CYRILLIC_TO_LATIN.hasOwnProperty(char)) {
      result += CYRILLIC_TO_LATIN[char];
    } else {
      result += char;
    }
    i++;
  }

  return result;
}

// Lotindan Kirilga transliteratsiya
function latinToCyrillic(text) {
  let result = "";
  let i = 0;

  while (i < text.length) {
    let char = text[i];
    let nextChar = text[i + 1];
    let twoChar = char + nextChar;

    // Ikki harfli kombinatsiyalarni tekshirish
    if (twoChar === "ts") {
      result += "ц";
      i += 2;
      continue;
    }
    if (twoChar === "Ts") {
      result += "Ц";
      i += 2;
      continue;
    }
    if (twoChar === "sh") {
      result += "ч";
      i += 2;
      continue;
    }
    if (twoChar === "Sh") {
      result += "Ч";
      i += 2;
      continue;
    }
    if (twoChar === "yu") {
      result += "ю";
      i += 2;
      continue;
    }
    if (twoChar === "Yu") {
      result += "Ю";
      i += 2;
      continue;
    }
    if (twoChar === "ya") {
      result += "я";
      i += 2;
      continue;
    }
    if (twoChar === "Ya") {
      result += "Я";
      i += 2;
      continue;
    }

    // Oddiy harflarni almashtirish
    if (LATIN_TO_CYRILLIC.hasOwnProperty(char)) {
      result += LATIN_TO_CYRILLIC[char];
    } else {
      result += char;
    }
    i++;
  }

  return result;
}

// Avtomatik transliteratsiya (alifboni aniqlap)
function autoTransliterate(text) {
  const script = detectScript(text);

  if (script === "cyrillic") {
    return {
      result: cyrillicToLatin(text),
      from: "cyrillic",
      to: "latin",
    };
  } else if (script === "latin") {
    return {
      result: latinToCyrillic(text),
      from: "latin",
      to: "cyrillic",
    };
  } else {
    return {
      result: text,
      from: "mixed",
      to: "mixed",
      message: "Matnda aralash alifbo ishlatilgan",
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

module.exports = {
  detectScript,
  cyrillicToLatin,
  latinToCyrillic,
  autoTransliterate,
  manualTransliterate,
  CYRILLIC_TO_LATIN,
  LATIN_TO_CYRILLIC,
};
