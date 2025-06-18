const express = require("express");
const { HfInference } = require("@huggingface/inference");
const Word = require("../models/Word.js");
const router = express.Router();

// Hugging Face API sozlamalari
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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

  // So‘zlarni tozalash va takrorlanmasligini olish
  const cleanWords = [...new Set(rawWords.map(cleanWord).filter(Boolean))];

  // Birinchi: Ma‘lumotlar bazasidan tekshirish
  const checks = cleanWords.map(async (word) => {
    const found = await Word.findOne({ type, word });
    if (!found) {
      mistakesSet.add(word);
    }
  });

  await Promise.all(checks);

  // Ikkinchi: Mistakes massividagi so‘zlarni Hugging Face API bilan tekshirish
  const mistakes = Array.from(mistakesSet);
  const results = [];

  if (mistakes.length > 0) {
    try {
      const prompt = `
        Quyida Qoraqalpoq tilidagi so‘zlar ro‘yxati berilgan: ${mistakes.join(
          ", "
        )}.
        So‘zlar ${type === "kiril" ? "kirill" : "lotin"} yozuvida.
        Misollar: "salaam" (to‘g‘ri), "duniya" (to‘g‘ri), "dunyo" (noto‘g‘ri).
        Har bir so‘zning Qoraqalpoq tilida to‘g‘ri yoki noto‘g‘ri ekanligini aniqlang.
        Agar so‘z noto‘g‘ri bo‘lsa, Qoraqalpoq tilidagi o‘xshash to‘g‘ri so‘zlarni taklif qiling.
        Javobni JSON formatida quyidagi tuzilishda qaytaring:
        [
          {
            "word": "so‘z",
            "isCorrect": true | false,
            "suggestions": ["taklif1", "taklif2"] // faqat noto‘g‘ri bo‘lsa
          },
          ...
        ]
      `;

      const response = await hf.textGeneration({
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        inputs: `<s>[INST] ${prompt} [/INST]`,
        parameters: {
          max_new_tokens: 2000,
          return_full_text: false,
          temperature: 0.7,
        },
      });

      // Hugging Face javobini JSON sifatida olish
      let hfResponse;
      try {
        hfResponse = JSON.parse(response.generated_text);
      } catch (parseError) {
        console.error("JSON parse xatosi:", parseError);
        return res
          .status(500)
          .json({ error: "Model javobini tahlil qilishda xato" });
      }

      results.push(...hfResponse);
    } catch (error) {
      console.error("Hugging Face API xatosi:", error);
      return res
        .status(500)
        .json({ error: "Matnni tekshirishda xato yuz berdi" });
    }
  }

  // Natijani qaytarish
  res.json({
    mistakes: mistakes,
    qaraqalpaqResults: results,
  });
});

module.exports = router;
