/**
 * Deterministic content-quality checks (EXP-032 / CQV-01..03).
 *
 * Offline, no API key, no network: accent (CQV-01), article (CQV-02), and
 * duplicate (CQV-03) checks over a set's cards. The barrel re-exports the
 * individual checks plus a combined {@link runContentQualityChecks}.
 *
 * @example
 * const report = runContentQualityChecks(cards, "es");
 * report.accents;     // missing-diacritic findings
 * report.articles;    // wrong-article findings
 * report.duplicates;  // duplicate-card findings
 */

import { checkAccents } from "./accent-check";
import { checkArticles } from "./article-check";
import { checkDuplicates } from "./duplicate-check";
import type { QualityCard, QualityReport } from "./types";

export { checkAccents } from "./accent-check";
export { checkArticles } from "./article-check";
export { checkDuplicates } from "./duplicate-check";
export type {
  AccentFinding,
  ArticleFinding,
  DuplicateFinding,
  QualityCard,
  QualityReport,
} from "./types";

/** True when a report has at least one finding of any kind. */
export function hasQualityFindings(report: QualityReport): boolean {
  return (
    report.accents.length > 0 ||
    report.articles.length > 0 ||
    report.duplicates.length > 0
  );
}

/** Total finding count across all three checks. */
export function countQualityFindings(report: QualityReport): number {
  return (
    report.accents.length + report.articles.length + report.duplicates.length
  );
}

/**
 * Run all three deterministic checks over a set's cards. Accent + article
 * checks need the target language (their dictionaries); the duplicate check
 * is language-agnostic.
 */
export function runContentQualityChecks(
  cards: readonly QualityCard[],
  targetLanguage: string,
): QualityReport {
  return {
    accents: checkAccents(cards, targetLanguage),
    articles: checkArticles(cards, targetLanguage),
    duplicates: checkDuplicates(cards),
  };
}
