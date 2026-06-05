/**
 * Regression (#76): the Dashboard filter bar's taxonomy.* i18n keys must
 * exist in every shipped catalog. They were entirely missing, so every
 * language fell through to the English fallback.
 */

import { describe, expect, it } from "vitest";

import de from "./de.json";
import el from "./el.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import ja from "./ja.json";
import pt from "./pt.json";
import tr from "./tr.json";

const CATALOGS: Record<string, Record<string, unknown>> = {
  de,
  el,
  en,
  es,
  fr,
  ja,
  pt,
  tr,
};

const REQUIRED_TAXONOMY_KEYS = [
  "filter_title",
  "loading",
  "filter_load_failed",
  "subject",
  "all_subjects",
  "all_projects",
  "filtered_projects",
  "clear_filters",
  "tags",
  "no_user_tags_short",
  "no_matching_projects",
  "no_projects",
];

describe("taxonomy.* i18n coverage (#76)", () => {
  for (const [lang, catalog] of Object.entries(CATALOGS)) {
    it(`${lang} defines every taxonomy filter key`, () => {
      const taxonomy = catalog.taxonomy as Record<string, string> | undefined;
      expect(taxonomy, `${lang} has no taxonomy section`).toBeTruthy();
      for (const key of REQUIRED_TAXONOMY_KEYS) {
        expect(taxonomy?.[key], `${lang}.taxonomy.${key} missing`).toBeTruthy();
      }
    });
  }

  it("the count keys carry a {count} placeholder", () => {
    expect((en.taxonomy as Record<string, string>).all_projects).toContain(
      "{count}",
    );
    expect((en.taxonomy as Record<string, string>).filtered_projects).toContain(
      "{count}",
    );
  });
});
