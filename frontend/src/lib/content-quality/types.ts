/**
 * Shared types for the deterministic content-quality checks
 * (EXP-032 / CQV-01..03). Library-grade: no app, i18n, or storage
 * imports. The findings carry raw data only — display strings are
 * composed by the consumer.
 */

/** One card under inspection. ``id`` keys the finding back to the card;
 *  ``front`` is the target-language term, ``back`` the source-language
 *  translation. */
export interface QualityCard {
  id: string;
  front: string;
  back?: string | null;
}

/** A word that needs a diacritic in the target language but was written
 *  without one (CQV-01 accent check). */
export interface AccentFinding {
  card_id: string;
  /** The card field the word was found on (always ``"front"`` today). */
  field: string;
  /** The word as written (missing the accent). */
  word: string;
  /** The correctly-accented form. */
  expected: string;
}

/** A noun written with the wrong gender article (CQV-02 article check). */
export interface ArticleFinding {
  card_id: string;
  /** The noun whose article is wrong. */
  noun: string;
  /** The article the noun's gender requires. */
  expected_article: string;
  /** The article actually written. */
  actual: string;
}

/** Two cards in the same set that are the same question (CQV-03). */
export interface DuplicateFinding {
  card_id_a: string;
  card_id_b: string;
  /** 1.0 for an exact normalized match (the only kind reported, to avoid
   *  false positives on merely similar cards). */
  similarity: number;
}

/** The combined result of the three deterministic checks. */
export interface QualityReport {
  accents: AccentFinding[];
  articles: ArticleFinding[];
  duplicates: DuplicateFinding[];
}
