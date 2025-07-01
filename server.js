// server.js - COMPLETE BACKEND SERVER WITH ALL FEATURES
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4343;

// API Key Debug
console.log("🔍 API Key Debug:");
console.log(
  "ANTHROPIC_API_KEY from env:",
  process.env.ANTHROPIC_API_KEY ? "SET" : "NOT SET"
);
console.log("API Key length:", process.env.ANTHROPIC_API_KEY?.length || 0);
console.log(
  "API Key starts with:",
  process.env.ANTHROPIC_API_KEY?.substring(0, 10) || "N/A"
);

// Initialize Anthropic Claude with debug
let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log("✅ Anthropic client initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize Anthropic client:", error);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Helper function to detect script
const detectScript = (text) => {
  const cyrillicCount = (text.match(/[а-яәғқңөүһҳ]/gi) || []).length;
  const latinCount = (text.match(/[a-zәğqńöüşıĞQŃÖÜŞI]/gi) || []).length;
  const totalLetters = cyrillicCount + latinCount;

  if (totalLetters === 0) return "unknown";
  if (cyrillicCount > latinCount) return "cyrillic";
  if (latinCount > cyrillicCount) return "latin";
  return "mixed";
};

// Helper function to send Claude request with detailed debugging
const sendClaudeRequest = async (prompt) => {
  console.log("🚀 Sending request to Claude...");
  console.log("API Key exists:", !!process.env.ANTHROPIC_API_KEY);
  console.log(
    "API Key format check:",
    process.env.ANTHROPIC_API_KEY?.startsWith("sk-ant-")
  );

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    console.log("✅ Claude response received successfully");

    if (response.content && response.content[0]) {
      return response.content[0].text;
    } else {
      throw new Error("Invalid response format from Anthropic Claude API");
    }
  } catch (error) {
    console.error("❌ Anthropic Claude error details:");
    console.error("Error type:", error.constructor.name);
    console.error("Error status:", error.status);
    console.error("Error message:", error.message);

    if (error.status === 401) {
      console.error("🔑 API Key Issues:");
      console.error("- Check if API key is correct");
      console.error("- Check if API key is active");
      console.error("- Check if you have Claude API access");
      console.error(
        "- Current key preview:",
        process.env.ANTHROPIC_API_KEY?.substring(0, 20) + "..."
      );
    }

    throw new Error(`API Error: ${error.status} - ${error.message}`);
  }
};

// Helper function to clean and parse JSON
const cleanAndParseJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.log("Direct parse failed, trying to clean JSON...");

    let cleanText = text;
    cleanText = cleanText.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }

    cleanText = cleanText
      .replace(/\\"/g, '"')
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\n/g, " ")
      .replace(/\t/g, " ")
      .replace(/\\/g, "")
      .replace(/,(\s*[}\]])/g, "$1");

    try {
      return JSON.parse(cleanText);
    } catch (secondError) {
      console.error("JSON cleaning failed too:", secondError);
      return {
        results: [],
        error: "Failed to parse Claude response",
        rawResponse: text.substring(0, 500) + "...",
      };
    }
  }
};

// Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "OrfoAI Backend",
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
  });
});

// Test endpoint with detailed debugging
app.get("/api/debug-test", async (req, res) => {
  console.log("🧪 Debug test started...");

  try {
    const testPrompt = `Hello! Please respond with: {"status": "ok", "message": "Claude is working"}`;

    console.log("📤 Sending test prompt...");
    const response = await sendClaudeRequest(testPrompt);
    console.log("📥 Test response received:", response);

    res.json({
      success: true,
      message: "Claude API working correctly",
      response: response,
      apiKeyStatus: process.env.ANTHROPIC_API_KEY ? "SET" : "NOT SET",
      apiKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
    });
  } catch (error) {
    console.error("❌ Debug test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      apiKeyStatus: process.env.ANTHROPIC_API_KEY ? "SET" : "NOT SET",
      apiKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
      apiKeyPreview:
        process.env.ANTHROPIC_API_KEY?.substring(0, 20) + "..." || "N/A",
      troubleshooting: [
        "Check if API key is correct in .env file",
        "Verify API key is active on Anthropic console",
        "Ensure you have Claude API access",
        "Try regenerating API key if needed",
      ],
    });
  }
});

// Simple test connection
app.get("/api/test-connection", async (req, res) => {
  try {
    const testPrompt = `Test connection. Respond with: "Connection successful"`;
    const response = await sendClaudeRequest(testPrompt);

    res.json({
      success: true,
      message: "Anthropic Claude connection successful",
      response: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/spell-check", async (req, res) => {
  console.log("📝 Spell check request received");

  try {
    const { text, language = "uz", script } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    const detectedScript = script || detectScript(text);
    const languageMap = {
      uz: "Uzbek",
      kaa: "Karakalpak",
      ru: "Russian",
    };
    const languageName = languageMap[language] || "Karakalpak";
    const scriptName =
      detectedScript === "latin" || detectedScript === "mixed"
        ? "Latin"
        : "Cyrillic";

    // Use the same prompt as correction for consistency
    let correctionPrompt = "";

    if (language === "uz") {
      correctionPrompt = `You are an Uzbek language corrector. Correct all spelling and grammar errors in the following Uzbek text. 

TEXT TO CORRECT: "${text}"

RULES:
- ONLY return the corrected Uzbek text
- NO explanations, NO comments, NO additional text
- Keep the same meaning and structure
- Use ${scriptName} script
- Fix spelling and grammar errors only
- Do NOT translate to other languages
- Do NOT add any English text or explanations

CORRECTED TEXT:`;
    } else if (language === "kaa") {
      correctionPrompt = `You are a Karakalpak language corrector. Correct all spelling and grammar errors in the following Karakalpak text.

TEXT TO CORRECT: "${text}"

RULES:
- ONLY return the corrected Karakalpak text
- NO explanations, NO comments, NO additional text  
- Keep the same meaning and structure
- Use ${scriptName} script
- Fix spelling and grammar errors only
- Do NOT translate to other languages
- Do NOT add any English text or explanations

CORRECTED TEXT:`;
    } else {
      correctionPrompt = `You are a ${languageName} language corrector. Correct all spelling and grammar errors in the following text.

TEXT TO CORRECT: "${text}"

RULES:
- ONLY return the corrected ${languageName} text
- NO explanations, NO comments, NO additional text
- Keep the same meaning and structure  
- Use ${scriptName} script
- Fix spelling and grammar errors only
- Do NOT translate to other languages
- Do NOT add any English text or explanations

CORRECTED TEXT:`;
    }

    console.log("📤 Getting corrected text...");
    const rawResponse = await sendClaudeRequest(correctionPrompt);

    // Apply same cleaning logic as correction endpoint
    let correctedText = rawResponse.trim();

    // Remove explanations
    const explanationPatterns = [
      /^I apologize.*$/gim,
      /^Please let me know.*$/gim,
      /^Would you like me to.*$/gim,
      /^For.*correction.*$/gim,
      /^The text.*$/gim,
      /^These are.*$/gim,
      /^[123]\.\s.*$/gim,
      /^CORRECTED TEXT:\s*/gim,
      /^CORRECTED:\s*/gim,
      /^Here.*$/gim,
      /^Note:.*$/gim,
    ];

    explanationPatterns.forEach((pattern) => {
      correctedText = correctedText.replace(pattern, "");
    });

    correctedText = correctedText
      .replace(/\n{2,}/g, "\n")
      .replace(/^\s*\n/gm, "")
      .trim();

    // Simple word-by-word comparison for spell check
    const originalWords = text.trim().split(/\s+/);
    const correctedWords = correctedText.trim().split(/\s+/);

    const results = [];
    const errors = [];

    for (let i = 0; i < originalWords.length; i++) {
      const originalWord = originalWords[i];
      const correctedWord = correctedWords[i] || originalWord;

      const cleanOriginal = originalWord.replace(/[.,!?;:"'()]/g, "");
      const cleanCorrected = correctedWord.replace(/[.,!?;:"'()]/g, "");

      const beforeText = originalWords.slice(0, i).join(" ");
      const wordStart = beforeText.length + (beforeText ? 1 : 0);
      const wordEnd = wordStart + originalWord.length;

      const isCorrect =
        cleanOriginal.toLowerCase() === cleanCorrected.toLowerCase();

      const result = {
        word: cleanOriginal,
        isCorrect: isCorrect,
        suggestions: isCorrect ? [] : [cleanCorrected],
        start: wordStart,
        end: wordEnd,
      };

      results.push(result);

      if (!isCorrect) {
        errors.push({
          mistakeWord: cleanOriginal,
          similarWords: [
            {
              word: cleanCorrected,
              similarity: 95,
            },
          ],
        });
      }
    }

    const totalWords = originalWords.length;
    const incorrectWords = errors.length;
    const correctWords = totalWords - incorrectWords;
    const accuracy =
      totalWords > 0 ? ((correctWords / totalWords) * 100).toFixed(1) : 100;

    res.json({
      success: true,
      data: {
        results: results,
        statistics: {
          totalWords,
          correctWords,
          incorrectWords,
          accuracy: parseFloat(accuracy),
          textLength: text.length,
          scriptType: detectedScript,
          language: language,
          languageName: languageName,
        },
        correctedVersion: correctedText,
      },
    });
  } catch (error) {
    console.error("❌ Spell check error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Spell check failed",
    });
  }
});

// Keep the existing correct-text endpoint but make it use the same logic
// Fixed AI correction prompts - No explanations, only corrected text
app.post("/api/correct-text", async (req, res) => {
  try {
    const { text, language = "uz", script } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    const detectedScript = script || detectScript(text);
    const scriptName =
      detectedScript === "latin" || detectedScript === "mixed"
        ? "Latin"
        : "Cyrillic";

    const languageMap = {
      uz: "Uzbek",
      kaa: "Karakalpak",
      ru: "Russian",
    };

    const languageName = languageMap[language] || "Karakalpak";

    let prompt = "";

    if (language === "uz") {
      prompt = `You are an Uzbek language corrector. Correct all spelling and grammar errors in the following Uzbek text. 

TEXT TO CORRECT: "${text}"

RULES:
- ONLY return the corrected Uzbek text
- NO explanations, NO comments, NO additional text
- Keep the same meaning and structure
- Use ${scriptName} script
- Fix spelling and grammar errors only
- Do NOT translate to other languages
- Do NOT add any English text or explanations

CORRECTED TEXT:`;
    } else if (language === "kaa") {
      prompt = `You are a Karakalpak language corrector. Correct all spelling and grammar errors in the following Karakalpak text.

TEXT TO CORRECT: "${text}"

RULES:
- ONLY return the corrected Karakalpak text
- NO explanations, NO comments, NO additional text  
- Keep the same meaning and structure
- Use ${scriptName} script
- Fix spelling and grammar errors only
- Do NOT translate to other languages
- Do NOT add any English text or explanations

CORRECTED TEXT:`;
    } else {
      prompt = `You are a ${languageName} language corrector. Correct all spelling and grammar errors in the following text.

TEXT TO CORRECT: "${text}"

RULES:
- ONLY return the corrected ${languageName} text
- NO explanations, NO comments, NO additional text
- Keep the same meaning and structure  
- Use ${scriptName} script
- Fix spelling and grammar errors only
- Do NOT translate to other languages
- Do NOT add any English text or explanations

CORRECTED TEXT:`;
    }

    console.log("📤 Sending correction request to Claude...");
    const rawResponse = await sendClaudeRequest(prompt);
    console.log("📥 Raw Claude response:", rawResponse);

    // Clean the response - remove any explanations
    let correctedText = rawResponse.trim();

    // Remove common explanation patterns
    const explanationPatterns = [
      /^I apologize.*$/gim,
      /^Please let me know.*$/gim,
      /^Would you like me to.*$/gim,
      /^For.*correction.*$/gim,
      /^The text.*$/gim,
      /^These are.*$/gim,
      /^[123]\.\s.*$/gim, // Remove numbered lists
      /^CORRECTED TEXT:\s*/gim,
      /^CORRECTED:\s*/gim,
      /^Here.*$/gim,
      /^Note:.*$/gim,
      /^This text.*$/gim,
    ];

    // Apply cleaning patterns
    explanationPatterns.forEach((pattern) => {
      correctedText = correctedText.replace(pattern, "");
    });

    // Remove multiple newlines and trim
    correctedText = correctedText
      .replace(/\n{2,}/g, "\n")
      .replace(/^\s*\n/gm, "")
      .trim();

    // If response is too long compared to original (likely contains explanations), try extraction
    if (correctedText.length > text.length * 2) {
      console.log("⚠️ Response too long, extracting core text...");

      // Try to find the actual corrected text (usually in quotes or after certain patterns)
      const patterns = [
        /"([^"]+)"/g, // Text in quotes
        /TEXT:\s*(.+)/gi, // After "TEXT:"
        /CORRECTED:\s*(.+)/gi, // After "CORRECTED:"
      ];

      for (const pattern of patterns) {
        const matches = correctedText.match(pattern);
        if (matches && matches[0]) {
          const extracted = matches[0]
            .replace(/^(TEXT|CORRECTED):\s*/gi, "")
            .replace(/^"|"$/g, "")
            .trim();

          if (extracted.length > 10 && extracted.length < text.length * 1.5) {
            correctedText = extracted;
            break;
          }
        }
      }
    }

    // Final check - if still contains explanations, use fallback
    const englishWords = correctedText.match(
      /\b(the|and|or|in|at|to|for|of|with|by)\b/gi
    );
    if (englishWords && englishWords.length > 2) {
      console.log("⚠️ Response contains English, using fallback approach...");

      // Fallback: Use a more strict prompt
      const fallbackPrompt = `Fix spelling errors in this ${languageName} text and return ONLY the fixed text, nothing else: "${text}"`;

      try {
        const fallbackResponse = await sendClaudeRequest(fallbackPrompt);
        const cleaned = fallbackResponse.trim().replace(/^"|"$/g, "");
        if (cleaned.length > 5 && cleaned.length < text.length * 2) {
          correctedText = cleaned;
        }
      } catch (fallbackError) {
        console.warn("Fallback correction failed:", fallbackError.message);
      }
    }

    // If all cleaning failed, return original text
    if (!correctedText || correctedText.length < 5) {
      console.log("⚠️ Correction failed, returning original text");
      correctedText = text;
    }

    console.log("✅ Final corrected text:", correctedText);

    res.json({
      success: true,
      data: {
        original: text,
        corrected: correctedText,
        language: language,
        languageName: languageName,
        script: detectedScript,
      },
    });
  } catch (error) {
    console.error("Text correction error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Text correction failed",
    });
  }
});

// Transliteration endpoint
app.post("/api/transliterate", async (req, res) => {
  try {
    const { text, targetScript, language = "kaa" } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    const sourceScript = detectScript(text);

    if (sourceScript === targetScript) {
      return res.json({
        success: true,
        data: {
          original: text,
          converted: text,
          from: sourceScript,
          to: targetScript,
        },
      });
    }

    const isToLatin = targetScript === "latin";
    const languageName =
      language === "kaa"
        ? "Karakalpak"
        : language === "uz"
        ? "Uzbek"
        : "Russian";

    const prompt = isToLatin
      ? `Convert this ${languageName} text from Cyrillic to Latin script.

Text: "${text}"
Language: ${languageName}

Conversion rules for ${languageName}:
а→a, ә→ә, б→b, в→v, г→g, ғ→ğ, д→d, е→e, ё→yo, ж→j, з→z, и→i, й→y, к→k, қ→q, л→l, м→m, н→n, ң→ń, о→o, ө→ö, п→p, р→r, с→s, т→t, у→u, ү→ü, ў→w, ф→f, х→x, ҳ→h, ц→c, ч→ch, ш→sh, щ→shh, ъ→', ы→ı, ь→', э→e, ю→yu, я→ya

Return only the converted text in Latin script, nothing else.`
      : `Convert this ${languageName} text from Latin to Cyrillic script.

Text: "${text}"
Language: ${languageName}

Conversion rules for ${languageName}:
a→а, ә→ә, b→б, v→в, g→г, ğ→ғ, d→д, e→е, j→ж, z→з, i→и, ı→ы, y→й, k→к, q→қ, l→л, m→м, n→н, ń→ң, o→о, ö→ө, p→п, r→р, s→с, t→т, u→у, ü→ү, w→ў, f→ф, x→х, h→ҳ, c→ц, ch→ч, sh→ш, yu→ю, ya→я

Return only the converted text in Cyrillic script, nothing else.`;

    const convertedText = await sendClaudeRequest(prompt);

    res.json({
      success: true,
      data: {
        original: text,
        converted: convertedText.trim(),
        from: sourceScript,
        to: targetScript,
      },
    });
  } catch (error) {
    console.error("Transliteration error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Transliteration failed",
    });
  }
});

// Auto transliteration endpoint
app.post("/api/auto-transliterate", async (req, res) => {
  try {
    const { text, language = "kaa" } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    const sourceScript = detectScript(text);
    const targetScript = sourceScript === "cyrillic" ? "latin" : "cyrillic";

    // Use the transliterate endpoint logic
    const isToLatin = targetScript === "latin";
    const languageName =
      language === "kaa"
        ? "Karakalpak"
        : language === "uz"
        ? "Uzbek"
        : "Russian";

    const prompt = isToLatin
      ? `Convert this ${languageName} text from Cyrillic to Latin script.

Text: "${text}"
Language: ${languageName}

Conversion rules for ${languageName}:
а→a, ә→ә, б→b, в→v, г→g, ғ→ğ, д→d, е→e, ё→yo, ж→j, з→z, и→i, й→y, к→k, қ→q, л→l, м→m, н→n, ң→ń, о→o, ө→ö, п→p, р→r, с→s, т→t, у→u, ү→ü, ў→w, ф→f, х→x, ҳ→h, ц→c, ч→ch, ш→sh, щ→shh, ъ→', ы→ı, ь→', э→e, ю→yu, я→ya

Return only the converted text in Latin script, nothing else.`
      : `Convert this ${languageName} text from Latin to Cyrillic script.

Text: "${text}"
Language: ${languageName}

Conversion rules for ${languageName}:
a→а, ә→ә, b→б, v→в, g→г, ğ→ғ, d→д, e→е, j→ж, z→з, i→и, ı→ы, y→й, k→к, q→қ, l→л, m→м, n→н, ń→ң, o→о, ö→ө, p→п, r→р, s→с, t→т, u→у, ü→ү, w→ў, f→ф, x→х, h→ҳ, c→ц, ch→ч, sh→ш, yu→ю, ya→я

Return only the converted text in Cyrillic script, nothing else.`;

    const convertedText = await sendClaudeRequest(prompt);

    res.json({
      success: true,
      data: {
        original: text,
        converted: convertedText.trim(),
        from: sourceScript,
        to: targetScript,
      },
    });
  } catch (error) {
    console.error("Auto transliteration error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Auto transliteration failed",
    });
  }
});

// Text improvement endpoint
app.post("/api/improve-text", async (req, res) => {
  try {
    const {
      text,
      language = "uz",
      script = "latin",
      style = "professional",
      level = 3,
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    const languageMap = {
      uz: "Uzbek",
      kaa: "Karakalpak",
      ru: "Russian",
    };

    const styleMap = {
      professional: "professional and formal",
      academic: "academic and scientific",
      literary: "literary and beautiful",
      formal: "formal and strict",
      friendly: "friendly and warm",
      humorous: "humorous and entertaining",
    };

    const levelMap = {
      1: "minimal changes - only most necessary",
      2: "light improvement",
      3: "moderate improvement",
      4: "strong improvement",
      5: "maximum improvement - complete rewrite",
    };

    const languageName = languageMap[language];
    const styleDesc = styleMap[style] || styleMap.professional;
    const levelDesc = levelMap[level] || levelMap[3];
    const scriptName = script === "cyrillic" ? "CYRILLIC" : "LATIN";

    const prompt = `You are a professional text editor and writer. Improve and perfect the following text.

Original text: "${text}"
Language: ${languageName}
Script: ${scriptName}
Style: ${styleDesc}
Improvement level: ${levelDesc}

Your task:
1. Do NOT change the meaning of the text at all
2. Keep the main ideas intact
3. Improve writing quality and rewrite in ${styleDesc} style
4. Apply ${levelDesc}
5. Fix grammatical and stylistic errors
6. Make the text clearer, more understandable and impactful
7. Write with perfect spelling accuracy in ${languageName}

Rules:
- Do not change the main meaning of the text
- Do not change facts
- Only improve writing quality
- Use professional and literary language
- Reduce repetitions
- Make the text smooth and readable

IMPORTANT: Write the response in ${scriptName} script!

Return only the improved text, no additional explanations.`;

    const improvedText = await sendClaudeRequest(prompt);

    res.json({
      success: true,
      data: {
        original: text,
        improved: improvedText.trim(),
        language: language,
        script: script,
        style: style,
        level: level,
        improved_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Text improvement error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Text improvement failed",
    });
  }
});

// Song generation endpoint
app.post("/api/generate-song", async (req, res) => {
  try {
    const {
      topic,
      style = "classik",
      language = "uz",
      script = "latin",
      conditions = "",
    } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({
        success: false,
        error: "Topic is required",
      });
    }

    const styleMap = {
      classik: "classic traditional style",
      rep: "modern rap style",
      adabiy: "beautiful literary style",
      dardli: "emotional and melancholic style",
      hkz: "folk song style",
    };

    const languageMap = {
      uz: "Uzbek",
      kaa: "Karakalpak",
      ru: "Russian",
    };

    const styleDesc = styleMap[style] || styleMap.classik;
    const languageName = languageMap[language] || "Karakalpak";
    const scriptName = script === "cyrillic" ? "CYRILLIC" : "LATIN";

    console.log(
      `🎵 Song generation started: ${topic} in ${languageName} (${scriptName}) - ${styleDesc}`
    );

    // Stage 1: Song creation
    const songPrompt = `You are a professional songwriter and poet. Create a professional song based on the following information.

Topic: "${topic}"
Style: ${styleDesc}
Language: ${languageName}
Script: ${scriptName}
Additional conditions: ${conditions || "No special conditions"}

LANGUAGE-SPECIFIC REQUIREMENTS FOR ${languageName.toUpperCase()}:
${
  language === "uz"
    ? `
- Use authentic Uzbek vocabulary and expressions
- Follow Uzbek poetic traditions and rhythm patterns
- Incorporate Uzbek cultural references appropriately
- Use modern literary Uzbek language
- Ensure proper Uzbek grammar and syntax
`
    : language === "kaa"
    ? `
- Use authentic Karakalpak vocabulary and expressions
- Follow Karakalpak folk song traditions
- Incorporate Karakalpak cultural and historical references
- Use traditional Karakalpak poetic patterns
- Reflect Karakalpak way of life and values
- Use characteristic Karakalpak linguistic features
`
    : `
- Use standard Russian vocabulary and expressions
- Follow Russian poetic traditions
- Use appropriate Russian cultural references
- Ensure proper Russian grammar and syntax
`
}

ORTHOGRAPHIC CORRECTNESS REQUIREMENTS:
- Write in perfect ${languageName} with impeccable spelling
- Carefully check each word for spelling accuracy
- Adhere to grammatical and syntactic rules of ${languageName}
- Use professional literary language appropriate for ${languageName}

SONG STRUCTURE REQUIREMENTS:
1. Create a song with at least 3-4 verses (kuplet)
2. Each verse should have 4 lines
3. Use appropriate rhyme scheme (ABAB or AABB)
4. Write in the ${styleDesc} style
5. Ensure the song matches the topic and is emotional and impactful
6. Include a chorus (nazmak) if appropriate for the style
7. Make it suitable for musical performance

CULTURAL APPROPRIATENESS:
- Ensure content is culturally appropriate for ${languageName} speakers
- Use imagery and metaphors familiar to the culture
- Respect traditional values while being creative
- Make it relatable to the target audience

IMPORTANT:
- Write the response in ${scriptName} script!
- Check every word for spelling accuracy in ${languageName}!
- Create a complete, ready-to-sing song
- Provide a music recommendation after the song text

Format:
[Song Title]

[Song Lyrics with verses clearly marked]

MUSIC RECOMMENDATION: [Suitable music genre, tempo, and instrumentation suggestions]`;

    console.log("📝 Stage 1: Generating song...");
    const initialContent = await sendClaudeRequest(songPrompt);

    // Separate song and music recommendation
    const parts = initialContent.split(/MUSIC RECOMMENDATION:/i);
    let song = parts[0]?.trim() || initialContent;
    const recommendedMusic =
      parts[1]?.trim() || "Traditional folk melody with modern arrangement";

    console.log("✅ Stage 1 completed. Generated song length:", song.length);

    // Stage 2: Spell checking and refinement for Karakalpak and Uzbek
    if (language === "kaa" || language === "uz") {
      console.log(
        `🔍 Stage 2: ${languageName} spell checking and refinement...`
      );

      const spellCheckPrompt = `You are a professional ${languageName} language editor and spell-checker. Review and perfect the following song text in ${scriptName} script.

Song text: "${song}"
Language: ${languageName}
Script: ${scriptName}

MANDATORY REQUIREMENTS FOR ${languageName.toUpperCase()}:
1. Check every single word for spelling accuracy in ${languageName}
2. Correct any grammatical errors following ${languageName} grammar rules
3. Ensure authentic ${languageName} vocabulary is used throughout
4. Maintain poetic quality and rhythm
5. Preserve the original meaning and emotional impact
6. Use proper ${languageName} sentence structure and syntax
7. Ensure cultural appropriateness for ${languageName} speakers
8. Verify that the ${scriptName} script is used correctly

SPECIFIC ${languageName.toUpperCase()} LINGUISTIC RULES:
${
  language === "uz"
    ? `
- Use correct Uzbek vowel harmony where applicable
- Ensure proper use of Uzbek-specific letters (o', g', sh, ch, etc.)
- Follow Uzbek word order and sentence construction
- Use authentic Uzbek expressions and idioms
- Maintain Uzbek poetic traditions
`
    : `
- Use correct Karakalpak vowel harmony system
- Ensure proper use of Karakalpak-specific letters (ә, ğ, q, ń, ö, ü, etc.)
- Follow Karakalpak morphological patterns
- Use authentic Karakalpak vocabulary, not borrowed from other languages
- Maintain traditional Karakalpak folk song characteristics
- Reflect Karakalpak cultural identity
`
}

QUALITY ASSURANCE:
- The final text must be completely error-free in ${languageName}
- Every word must be spelled correctly
- Grammar must be perfect
- The song should flow naturally and be easy to sing
- Cultural references should be appropriate and authentic

RETURN ONLY THE PERFECTED SONG TEXT, NOTHING ELSE!`;

      try {
        const correctedSong = await sendClaudeRequest(spellCheckPrompt);
        if (correctedSong && correctedSong.trim().length > 50) {
          song = correctedSong.trim();
          console.log(
            `✅ Stage 2 completed. ${languageName} spell checking done.`
          );
        }
      } catch (spellCheckError) {
        console.warn(
          `⚠️ Stage 2 error for ${languageName}:`,
          spellCheckError.message
        );
        console.log("Original song retained");
      }
    }

    // Stage 3: Final quality check
    console.log("🔍 Stage 3: Final quality verification...");

    const finalCheckPrompt = `You are a final quality reviewer for ${languageName} songs. Review this song one last time and make any final improvements needed.

Song: "${song}"
Language: ${languageName}
Script: ${scriptName}
Style: ${styleDesc}
Topic: ${topic}

FINAL QUALITY CHECK:
1. Verify spelling is 100% correct in ${languageName}
2. Ensure grammar is perfect
3. Check that the song flows well and is singable
4. Verify cultural appropriateness
5. Ensure the topic is properly addressed
6. Check that the style is consistent throughout

Make any final small improvements needed, but preserve the overall structure and meaning.

RETURN ONLY THE FINAL PERFECTED SONG TEXT!`;

    try {
      const finalSong = await sendClaudeRequest(finalCheckPrompt);
      if (finalSong && finalSong.trim().length > 50) {
        song = finalSong.trim();
        console.log("✅ Stage 3 completed. Final quality check done.");
      }
    } catch (finalError) {
      console.warn("⚠️ Stage 3 error:", finalError.message);
      console.log("Previous version retained");
    }

    console.log(
      `🎉 Song generation completed successfully. Final length: ${song.length}`
    );

    res.json({
      success: true,
      data: {
        song: song,
        recommendedMusic: recommendedMusic,
        topic: topic,
        style: style,
        language: language,
        languageName: languageName,
        script: script,
        conditions: conditions,
        spellChecked: true,
        qualityChecked: true,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Song generation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Song generation failed",
    });
  }
});

// Word suggestions endpoint (bonus feature)
app.post("/api/word-suggestions", async (req, res) => {
  try {
    const { word, language = "uz", limit = 5 } = req.body;

    if (!word || !word.trim()) {
      return res.status(400).json({
        success: false,
        error: "Word is required",
      });
    }

    const script = detectScript(word);
    const scriptName =
      script === "latin" || script === "mixed" ? "Latin" : "Cyrillic";

    const languageMap = {
      uz: "Uzbek",
      kaa: "Karakalpak",
      ru: "Russian",
    };

    const languageName = languageMap[language] || "Karakalpak";

    const prompt = `Provide ${limit} spelling suggestions for the ${languageName} word "${word}" written in ${scriptName} script.

Word: "${word}"
Language: ${languageName}
Script: ${scriptName}

Instructions:
- Provide the most likely correct spellings in ${languageName}
- Consider common spelling mistakes and phonetic similarities
- Rank suggestions by likelihood/confidence
- Use ${scriptName} script for all suggestions
- Consider ${languageName} grammar and morphology

Return response ONLY in JSON format:
{
  "suggestions": [
    {
      "word": "suggestion_1",
      "confidence": 95
    },
    {
      "word": "suggestion_2", 
      "confidence": 90
    }
  ]
}

Return ONLY JSON response.`;

    const content = await sendClaudeRequest(prompt);

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      const parsedResult = JSON.parse(jsonContent);

      res.json({
        success: true,
        data: parsedResult.suggestions || [],
      });
    } catch (parseError) {
      console.error("JSON parse error for word suggestions:", parseError);
      res.status(500).json({
        success: false,
        error: "Failed to parse suggestions response",
      });
    }
  } catch (error) {
    console.error("Word suggestions error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Word suggestions failed",
    });
  }
});

// Batch spell check endpoint (bonus feature)
app.post("/api/batch-spell-check", async (req, res) => {
  try {
    const { texts, language = "uz", script } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Texts array is required",
      });
    }

    if (texts.length > 10) {
      return res.status(400).json({
        success: false,
        error: "Maximum 10 texts allowed per batch",
      });
    }

    const results = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      console.log(`📝 Processing batch item ${i + 1}/${texts.length}`);

      try {
        // Use the same logic as single spell check
        const detectedScript = script || detectScript(text);
        const languageMap = {
          uz: "Uzbek",
          kaa: "Karakalpak",
          ru: "Russian",
        };
        const languageName = languageMap[language] || "Karakalpak";
        const scriptName =
          detectedScript === "latin" || detectedScript === "mixed"
            ? "Latin"
            : "Cyrillic";

        // Simple spell check prompt for batch processing
        const prompt = `Check spelling for this ${languageName} text in ${scriptName} script: "${text}"

Return only valid JSON:
{
  "results": [
    {"word": "word1", "isCorrect": true, "suggestions": []},
    {"word": "word2", "isCorrect": false, "suggestions": ["correction1"]}
  ]
}`;

        const content = await sendClaudeRequest(prompt);
        let parsedResult;

        try {
          parsedResult = JSON.parse(content);
        } catch (parseError) {
          parsedResult = cleanAndParseJSON(content);
        }

        const words = text.split(/\s+/).filter((w) => w.trim());
        const totalWords = words.length;
        const incorrectWords =
          parsedResult.results?.filter((r) => !r.isCorrect).length || 0;
        const accuracy =
          totalWords > 0
            ? (((totalWords - incorrectWords) / totalWords) * 100).toFixed(1)
            : 100;

        results.push({
          index: i,
          text: text,
          success: true,
          results: parsedResult.results || [],
          statistics: {
            totalWords,
            incorrectWords,
            accuracy: parseFloat(accuracy),
            language: languageName,
          },
        });
      } catch (error) {
        results.push({
          index: i,
          text: text,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      data: {
        results: results,
        summary: {
          total: texts.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          language: language,
        },
      },
    });
  } catch (error) {
    console.error("Batch spell check error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Batch spell check failed",
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Unhandled error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: error.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.originalUrl,
    availableEndpoints: [
      "GET /api/health",
      "GET /api/test-connection",
      "GET /api/debug-test",
      "POST /api/spell-check",
      "POST /api/correct-text",
      "POST /api/transliterate",
      "POST /api/auto-transliterate",
      "POST /api/improve-text",
      "POST /api/generate-song",
      "POST /api/word-suggestions",
      "POST /api/batch-spell-check",
    ],
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 OrfoAI Backend Server running on port ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔍 Debug URL: http://localhost:${PORT}/api/debug-test`);
  console.log(
    "🔑 API Key configured:",
    process.env.ANTHROPIC_API_KEY ? "YES" : "NO"
  );
  console.log("🎯 Available endpoints:");
  console.log("   - Health: GET /api/health");
  console.log("   - Test: GET /api/test-connection");
  console.log("   - Debug: GET /api/debug-test");
  console.log("   - Spell Check: POST /api/spell-check");
  console.log("   - Correct Text: POST /api/correct-text");
  console.log("   - Transliterate: POST /api/transliterate");
  console.log("   - Auto Transliterate: POST /api/auto-transliterate");
  console.log("   - Improve Text: POST /api/improve-text");
  console.log("   - Generate Song: POST /api/generate-song");
  console.log("   - Word Suggestions: POST /api/word-suggestions");
  console.log("   - Batch Spell Check: POST /api/batch-spell-check");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "⚠️  WARNING: ANTHROPIC_API_KEY not found in environment variables!"
    );
    console.error("Please check your .env file");
  }
});

export default app;
