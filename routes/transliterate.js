const express = require("express");
const router = express.Router();
const {
  detectScript,
  autoTransliterate,
  manualTransliterate,
  cyrillicToLatin,
  latinToCyrillic,
} = require("../utils/transliterate");

// POST /api/convert - Avtomatik transliteratsiya
router.post("/", async (req, res) => {
  try {
    const { text, mode = "auto" } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Matn kiritilishi shart",
      });
    }

    if (text.length > 100000) {
      return res.status(400).json({
        error: "Matn juda uzun (maksimal 100,000 belgi)",
      });
    }

    let result;

    if (mode === "auto") {
      result = autoTransliterate(text);
    } else if (mode === "toLatin") {
      result = {
        result: cyrillicToLatin(text),
        from: "cyrillic",
        to: "latin",
      };
    } else if (mode === "toCyrillic") {
      result = {
        result: latinToCyrillic(text),
        from: "latin",
        to: "cyrillic",
      };
    } else {
      return res.status(400).json({
        error: "Noto'g'ri rejim. Foydalaning: auto, toLatin, toCyrillic",
      });
    }

    res.json({
      success: true,
      original: text,
      converted: result.result,
      from: result.from,
      to: result.to,
      mode: mode,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Transliteratsiya xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
      message:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/convert/detect - Alifbo turini aniqlash
router.post("/detect", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Matn kiritilishi shart",
      });
    }

    const script = detectScript(text);

    // Har bir alifbo uchun statistika
    const cyrillicCount = (text.match(/[а-яәғқңөүһ]/gi) || []).length;
    const latinCount = (text.match(/[a-zәğqńöüşi]/gi) || []).length;
    const totalLetters = cyrillicCount + latinCount;

    res.json({
      success: true,
      text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
      detectedScript: script,
      statistics: {
        cyrillic: {
          count: cyrillicCount,
          percentage:
            totalLetters > 0
              ? ((cyrillicCount / totalLetters) * 100).toFixed(1)
              : 0,
        },
        latin: {
          count: latinCount,
          percentage:
            totalLetters > 0
              ? ((latinCount / totalLetters) * 100).toFixed(1)
              : 0,
        },
        total: totalLetters,
      },
    });
  } catch (error) {
    console.error("Alifbo aniqlash xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// POST /api/convert/batch - Ko'p matnlarni transliteratsiya qilish
router.post("/batch", async (req, res) => {
  try {
    const { texts, mode = "auto" } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: "Matnlar massivi kiritilishi shart",
      });
    }

    if (texts.length > 100) {
      return res.status(400).json({
        error: "Juda ko'p matn (maksimal 100 ta)",
      });
    }

    const results = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];

      if (typeof text !== "string") {
        results.push({
          index: i,
          error: "Matn string bo'lishi kerak",
          original: text,
        });
        continue;
      }

      if (text.length > 10000) {
        results.push({
          index: i,
          error: "Matn juda uzun",
          original: text.substring(0, 100) + "...",
        });
        continue;
      }

      try {
        let result;

        if (mode === "auto") {
          result = autoTransliterate(text);
        } else if (mode === "toLatin") {
          result = {
            result: cyrillicToLatin(text),
            from: "cyrillic",
            to: "latin",
          };
        } else if (mode === "toCyrillic") {
          result = {
            result: latinToCyrillic(text),
            from: "latin",
            to: "cyrillic",
          };
        }

        results.push({
          index: i,
          original: text,
          converted: result.result,
          from: result.from,
          to: result.to,
          success: true,
        });
      } catch (error) {
        results.push({
          index: i,
          error: "Transliteratsiya xatosi",
          original: text.substring(0, 100),
          success: false,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    res.json({
      success: true,
      results: results,
      summary: {
        total: texts.length,
        successful: successCount,
        failed: texts.length - successCount,
      },
      mode: mode,
    });
  } catch (error) {
    console.error("Batch transliteratsiya xatosi:", error);
    res.status(500).json({
      error: "Server xatosi yuz berdi",
    });
  }
});

// GET /api/convert/test - Test uchun
router.get("/test", (req, res) => {
  const testTexts = {
    cyrillic: "Қарақалпақстан Республикасы",
    latin: "Qaraqalpaqstan Respublikası",
    mixed: "Қарақалпақ tili ҳәм lotin",
  };

  const results = {};

  Object.keys(testTexts).forEach((key) => {
    const text = testTexts[key];
    results[key] = {
      original: text,
      detected: detectScript(text),
      auto: autoTransliterate(text),
      toLatin: cyrillicToLatin(text),
      toCyrillic: latinToCyrillic(text),
    };
  });

  res.json({
    success: true,
    message: "Transliteratsiya test natijalari",
    tests: results,
  });
});

module.exports = router;
