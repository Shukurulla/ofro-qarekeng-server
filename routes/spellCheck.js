const express = require("express");
const Word = require("../models/Word.js");
const router = express.Router();

function detectType(text) {
  return /[а-яё]/i.test(text) ? "kiril" : "latin";
}

function cleanWord(word) {
  return word.replace(/["'(){}\[\],.!?;:]/g, "").toLowerCase();
}

router.post("/check-text", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text required" });

  const type = detectType(text);
  const rawWords = text.split(/\s+/);
  const mistakesSet = new Set();

  // So'zlarni tozalash va takrorlanmasligini olish
  const cleanWords = [...new Set(rawWords.map(cleanWord).filter(Boolean))];

  // Ketma-ket yoki parallel tekshirish: parallel uchun Promise.all
  const checks = cleanWords.map(async (word) => {
    const found = await Word.findOne({ type, word });
    if (!found) {
      mistakesSet.add(word);
    }
  });

  await Promise.all(checks);

  res.json({ mistakes: Array.from(mistakesSet) });
});

module.exports = router;
