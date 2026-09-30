/**
 * First-paint coverage (#2796) — the gap treated as a COVERAGE question, not
 * another single key.
 *
 * The real language catalog is a lazily loaded chunk, so EVERY visit paints
 * first from the inline fallback catalog. A key the shell renders but the
 * inline catalog lacks shows the English literal from the code — a German user
 * meets "Add to home screen" and "What's new?" on the first screen.
 *
 * #1902 fixed exactly two such keys (``landing.intro``, ``landing.docs_link``)
 * and pinned exactly those two. Nothing asked whether the REST of the shell was
 * covered, so 25 further keys sat uncovered from May/June 2026 until a user
 * reported the mix on 2026-08-29.
 *
 * This test enumerates the keys the shell components actually render and fails
 * when any of them is missing from a fallback language. Per the gate contract
 * (#2083): it prints the size of the scanned set, and fails closed when the
 * scan finds nothing — an empty scan can never read as a clean one.
 */

import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

import {NAMESPACE, getI18n} from "./engine";
import {UI_LANGUAGES} from "../lib/i18n/languages";

/**
 * Resolve a key against ONE language's preloaded resources through the
 * real production engine (#2797) - no fallback chain, so a language
 * missing its own string surfaces as ``undefined`` instead of silently
 * reading as covered via ``i18next``'s ``fallbackLng: "en"``.
 */
function resolveFirstPaint(lang: string, key: string): unknown {
  return getI18n().getResource(lang, NAMESPACE, key);
}

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Components that can paint BEFORE the language chunk resolves: the app shell,
 * the pre-onboarding funnel and the always-mounted banners. A new eagerly
 * mounted, text-bearing component belongs in this list.
 */
const SHELL_COMPONENTS = [
  "App.tsx",
  "pages/onboarding/Landing.tsx",
  "components/nav/Navigation.tsx",
  "components/pwa/InstallPrompt.tsx",
  "components/pwa/IosInstallHint.tsx",
  "components/pwa/OfflineIndicator.tsx",
  "components/pwa/DesktopUpdateHost.tsx",
  // #3378 - the navigation renders its labels through ``nav-targets.ts``
  // (``labelKey``) and through its always-mounted children.
  "components/nav/nav-targets.ts",
  "components/nav/NavGroup.tsx",
  "components/nav/NavXpBadge.tsx",
  "components/nav/NavReviewsBadge.tsx",
  "components/nav/NavContentUpdatesBadge.tsx",
  "components/nav/NavAvatar.tsx",
  "components/nav/NavIndicators.tsx",
  "shared/layout/MenuToggleButton.tsx",
] as const;

/** ``t("some.key"...)`` and ``labelKey: "some.key"`` — the shell's shapes. */
const KEY_PATTERN = /(?:t\(\s*|labelKey:\s*)"([a-z0-9_]+(?:\.[a-z0-9_]+)+)"/g;

function shellKeys(): string[] {
  const found = new Set<string>();
  for (const rel of SHELL_COMPONENTS) {
    const source = readFileSync(join(SRC, rel), "utf-8");
    for (const match of source.matchAll(KEY_PATTERN)) found.add(match[1]);
  }
  return [...found].sort();
}

const KEYS = shellKeys();
// #3378 - every UI language paints first from the subset, not the stale
// 5-entry SUPPORTED_LANGUAGES list.
const LANGS = UI_LANGUAGES.map((meta) => meta.code);

describe("first-paint fallback coverage (#2796)", () => {
  it("scans a non-empty set of shell keys (fails closed, gate contract #2083)", () => {
    // Without this, a broken scan would report "0 gaps" and read as clean.
    expect(SHELL_COMPONENTS.length).toBeGreaterThanOrEqual(15);
    expect(KEYS.length).toBeGreaterThanOrEqual(25);
    console.log(
      `[first-paint] scanned ${SHELL_COMPONENTS.length} shell components, ` +
        `${KEYS.length} keys x ${LANGS.length} fallback languages`,
    );
  });

  it.each(LANGS)(
    "%s: every shell key resolves to a non-empty first-paint string",
    (lang) => {
      const missing = KEYS.filter((key) => {
        const value = resolveFirstPaint(lang, key);
        return typeof value !== "string" || value.trim() === "";
      });
      expect(missing).toEqual([]);
    },
  );

  it("names the navigation labels (#3378)", () => {
    expect(KEYS).toEqual(
      expect.arrayContaining(["nav.group.learn", "nav.learning_path", "nav.help", "nav.tab.content"]),
    );
  });

  it("resolves keys nested deeper than two levels (the #2796 root cause)", () => {
    // The hand-rolled lookup this gate used to call destructured into
    // exactly [section, name], so three-level keys were structurally
    // unreachable regardless of content. The real engine (#2797) resolves
    // arbitrary depth natively.
    expect(resolveFirstPaint("de", "update.banner.message")).toBeTruthy();
    expect(resolveFirstPaint("de", "install.ios.title")).toBeTruthy();
  });

  it("keeps German German — a covered key never yields the English literal", () => {
    expect(resolveFirstPaint("de", "update.banner.later")).not.toBe("Later");
    expect(resolveFirstPaint("de", "install.ios.title")).not.toBe(
      "Add to home screen",
    );
  });
});
