/**
 * services/languageService.js
 *
 * Multilingual support powered by the existing LLM (Groq / Llama 3.3).
 * - detectLanguage:       returns ISO 639-1 code ("en", "hi", "es", …)
 * - translateToEnglish:   translates user input → English for the pipeline
 * - translateFromEnglish: translates English answer → user's language
 */

const { logger } = require("../utils/logger");
const llmService = require("./llmService");

/* ------------------------------------------------------------------ */
/*  LANGUAGE NAME MAP — for clearer translation prompts               */
/* ------------------------------------------------------------------ */
const LANG_NAMES = {
  en: "English",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
  gu: "Gujarati",
  pa: "Punjabi",
  ur: "Urdu",
  ar: "Arabic",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
  it: "Italian",
  nl: "Dutch",
  tr: "Turkish",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
  sw: "Swahili",
  pl: "Polish",
  uk: "Ukrainian",
  ro: "Romanian",
  cs: "Czech",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
  el: "Greek",
  he: "Hebrew",
  fa: "Persian",
};

function langName(code) {
  return LANG_NAMES[code] || code;
}

/* ------------------------------------------------------------------ */
/*  detectLanguage                                                     */
/* ------------------------------------------------------------------ */
/**
 * Detect the language of the given text.
 * Returns an ISO 639-1 two-letter code (e.g. "en", "hi", "es").
 * Falls back to "en" on any error.
 */
async function detectLanguage(text) {
  if (!text || text.trim().length === 0) return "en";

  // Quick heuristic: if text is purely ASCII alphanumeric + common punctuation,
  // it is almost certainly English — skip the LLM call entirely.
  if (/^[\x20-\x7E\r\n\t]+$/.test(text)) {
    return "en";
  }

  try {
    const systemPrompt = [
      "You are a language detection tool.",
      "Your ONLY job is to return the ISO 639-1 two-letter language code of the input text.",
      "Return ONLY the two-letter code, nothing else.",
      "Examples: en, hi, es, fr, ta, te, bn, ar, zh, ja, ko, ru, de, pt.",
      "Do NOT return any explanation, sentence, or extra characters.",
    ].join("\n");

    const raw = await llmService.callLlm({
      prompt: `Detect the language:\n"${text.substring(0, 300)}"`,
      systemPrompt,
    });

    // Extract the two-letter code from LLM response
    const match = raw.trim().toLowerCase().match(/^([a-z]{2})/);
    const detected = match ? match[1] : "en";

    logger.info(`🌐 Language detected: ${detected} (${langName(detected)})`);
    return detected;
  } catch (err) {
    logger.warn("⚠ Language detection failed, defaulting to 'en':", err.message);
    return "en";
  }
}

/* ------------------------------------------------------------------ */
/*  translateToEnglish                                                 */
/* ------------------------------------------------------------------ */
/**
 * Translate text from sourceLang → English.
 * Returns the English translation (clean, no tags).
 */
async function translateToEnglish(text, sourceLang) {
  if (!text || sourceLang === "en") return text;

  try {
    const systemPrompt = [
      `You are a professional translator from ${langName(sourceLang)} to English.`,
      "Translate the following text to English accurately.",
      "RULES:",
      "- Return ONLY the English translation.",
      "- Do NOT include any tags like [Translated], [Translation], [Traducido], etc.",
      "- Do NOT include the original text.",
      "- Do NOT include any explanation or notes.",
      "- Preserve the original meaning and intent.",
      "- If the text contains technical terms or proper nouns, keep them as-is.",
    ].join("\n");

    const translated = await llmService.callLlm({
      prompt: text,
      systemPrompt,
    });

    logger.info(`🔄 Translated to English: "${text.substring(0, 60)}…" → "${translated.substring(0, 60)}…"`);
    return translated.trim();
  } catch (err) {
    logger.warn("⚠ Translation to English failed, using original:", err.message);
    return text; // Fallback: send original text (LLM may still understand it)
  }
}

/* ------------------------------------------------------------------ */
/*  translateFromEnglish                                               */
/* ------------------------------------------------------------------ */
/**
 * Translate text from English → targetLang.
 * Returns the translated text (clean, no tags, no mixed languages).
 */
async function translateFromEnglish(text, targetLang) {
  if (!text || targetLang === "en") return text;

  try {
    const targetName = langName(targetLang);
    const systemPrompt = [
      `You are a professional translator from English to ${targetName}.`,
      `Translate the following text to ${targetName} accurately and naturally.`,
      "STRICT RULES:",
      `- Return ONLY the ${targetName} translation.`,
      "- Do NOT include any tags like [Translated], [Translation], [Traducido], etc.",
      "- Do NOT include the English original.",
      "- Do NOT include any explanation, notes, or prefixes.",
      "- Do NOT mix languages — the entire response must be in " + targetName + ".",
      "- Preserve the meaning, not a literal word-for-word translation.",
      "- Keep technical terms, numbers, and proper nouns as-is when appropriate.",
      "- The output should feel natural to a native " + targetName + " speaker.",
    ].join("\n");

    const translated = await llmService.callLlm({
      prompt: text,
      systemPrompt,
    });

    // Strip any accidental [Translated] / [Traducido] tags the LLM might add
    const cleaned = translated
      .replace(/\[Translat(ed|ion)\]/gi, "")
      .replace(/\[Traducid[oa]\]/gi, "")
      .replace(/\[翻訳\]/gi, "")
      .replace(/\[अनुवाद(ित)?\]/gi, "")
      .trim();

    logger.info(`🔄 Translated to ${targetName}: "${text.substring(0, 60)}…" → "${cleaned.substring(0, 60)}…"`);
    return cleaned;
  } catch (err) {
    logger.warn(`⚠ Translation to ${targetLang} failed, returning English:`, err.message);
    return text; // Fallback: return English answer
  }
}

module.exports = {
  detectLanguage,
  translateToEnglish,
  translateFromEnglish,
  LANG_NAMES,
};
