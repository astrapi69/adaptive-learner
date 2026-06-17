/**
 * Article tables for the CQV-02 article check (EXP-032).
 *
 * Per language: the recognised articles with their gender / number /
 * definiteness, and a resolver that returns the correct article for a
 * given gender while preserving the written article's number +
 * definiteness. Gender ``null`` marks a gender-neutral article (fr
 * ``les`` / ``des``) that carries no gender signal, so the check skips it.
 */

import type { Gender } from "./nouns";

export interface ArticleSpec {
  /** ``null`` when the article carries no gender signal (skip the check). */
  gender: Gender | null;
  number: "sg" | "pl";
  definite: boolean;
}

/** Recognised articles per base language code (lowercased keys). */
export const ARTICLES: Record<string, Record<string, ArticleSpec>> = {
  es: {
    el: { gender: "m", number: "sg", definite: true },
    la: { gender: "f", number: "sg", definite: true },
    los: { gender: "m", number: "pl", definite: true },
    las: { gender: "f", number: "pl", definite: true },
    un: { gender: "m", number: "sg", definite: false },
    una: { gender: "f", number: "sg", definite: false },
    unos: { gender: "m", number: "pl", definite: false },
    unas: { gender: "f", number: "pl", definite: false },
  },
  fr: {
    le: { gender: "m", number: "sg", definite: true },
    la: { gender: "f", number: "sg", definite: true },
    les: { gender: null, number: "pl", definite: true },
    un: { gender: "m", number: "sg", definite: false },
    une: { gender: "f", number: "sg", definite: false },
    des: { gender: null, number: "pl", definite: false },
  },
  de: {
    // Nominative citation forms only — vocabulary cards present nouns as
    // "der Hund" / "das Mädchen", so the case ambiguity of der/die in free
    // prose does not apply here. `ein` (masculine OR neuter) is omitted as
    // ambiguous; `eine` is unambiguously feminine.
    der: { gender: "m", number: "sg", definite: true },
    die: { gender: "f", number: "sg", definite: true },
    das: { gender: "n", number: "sg", definite: true },
    eine: { gender: "f", number: "sg", definite: false },
  },
};

/** Resolve the correct article for ``gender`` keeping the same number +
 *  definiteness as the (wrong) written article. Returns ``null`` when the
 *  language has no defined form for that slot. */
export function correctArticle(
  lang: string,
  gender: Gender,
  number: "sg" | "pl",
  definite: boolean,
): string | null {
  const table = ARTICLES[lang];
  if (!table) return null;
  for (const [article, spec] of Object.entries(table)) {
    if (
      spec.gender === gender &&
      spec.number === number &&
      spec.definite === definite
    ) {
      return article;
    }
  }
  return null;
}
