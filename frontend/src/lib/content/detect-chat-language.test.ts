/**
 * Unit tests for the import-time learning-language detector (v1.54.0).
 */

import { describe, expect, it } from "vitest";

import { detectLearningLanguage } from "./detect-chat-language";

describe("detectLearningLanguage", () => {
  it("detects French as the target in a German chat about French", () => {
    const chat =
      "Ich lerne Französisch. Wie sage ich Hallo? Bonjour! Und danke? " +
      "Merci. Erklär mir bitte das passé composé mit être und avoir.";
    expect(detectLearningLanguage(chat, "de")).toBe("fr");
  });

  it("detects Spanish as the target in a German chat about Spanish", () => {
    const chat =
      "Heute üben wir Spanisch. Hola heißt Hallo, gracias heißt danke. " +
      "Was ist der Unterschied zwischen ser und estar im pretérito?";
    expect(detectLearningLanguage(chat, "de")).toBe("es");
  });

  it("returns the app language for same-language domain content", () => {
    // German grammar explained in German, no foreign signals -> de/de.
    const chat =
      "Erkläre mir die deutsche Grammatik. Wann benutzt man den Dativ " +
      "und wann den Akkusativ? Und bitte nenne Beispiele.";
    expect(detectLearningLanguage(chat, "de")).toBe("de");
  });

  it("detects a non-Latin script (Greek) outright", () => {
    expect(detectLearningLanguage("Πώς λέμε καλημέρα;", "de")).toBe("el");
  });

  it("returns null for empty input", () => {
    expect(detectLearningLanguage("", "de")).toBeNull();
    expect(detectLearningLanguage(null, "en")).toBeNull();
  });

  it("does not pick a foreign language from a single stray word", () => {
    // One incidental 'hello' must not flip a German chat to English.
    const chat = "Wir lernen heute Grammatik. (hello)";
    expect(detectLearningLanguage(chat, "de")).toBe("de");
  });
});
