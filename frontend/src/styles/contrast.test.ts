/**
 * Phase 58D — WCAG 2.1 AA contrast pin across ALL six themes.
 *
 * Reads the actual token values from styles/themes/theme-*.css (the
 * single source of truth) so the pin cannot drift from production CSS.
 * Fails loudly if any contributor lowers a color token below AA in any
 * theme. Originally a light+dark pin (Phase 39 C5); Phase 58D extended
 * it to ocean / forest / high-contrast / sepia.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { METHOD_COLORS, LEARNING_METHODS } from "../lib/constants";
import { readLegacyCssSum } from "./legacy-css-sum";
import { THEME_IDS } from "../lib/theme/themes";
import { AA_LARGE_TEXT_OR_UI, AA_NORMAL_TEXT, bestTextOn, contrastRatio } from "./contrast";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Read every ``--name: #hex`` declaration from a theme file. */
function readThemeTokens(themeId: string): Record<string, string> {
  const css = readFileSync(resolve(HERE, "themes", `theme-${themeId}.css`), "utf-8");
  const tokens: Record<string, string> = {};
  const re = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

const THEME_TOKENS: Record<string, Record<string, string>> = {};
for (const id of THEME_IDS) {
  THEME_TOKENS[id] = readThemeTokens(id);
}

/** Replicates CSS ``color-mix(in srgb, A pct%, B)`` — a per-channel
 *  linear blend in gamma-encoded sRGB — so the matching-feedback
 *  backgrounds (defined as color-mix in global.css) can be contrast-
 *  checked exactly as the browser computes them (#183). */
function mixSrgb(a: string, b: string, pct: number): string {
  const channels = (h: string): number[] => {
    let s = h.replace("#", "");
    if (s.length === 3)
      s = s
        .split("")
        .map((c) => c + c)
        .join("");
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  };
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const w = pct / 100;
  const ch = (x: number, y: number) =>
    Math.round(x * w + y * (1 - w))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

describe("Phase 58D — WCAG AA contrast (all themes)", () => {
  for (const id of THEME_IDS) {
    const t = () => THEME_TOKENS[id];

    describe(`theme=${id}`, () => {
      it("body text on every background passes normal-text AA", () => {
        for (const bg of ["bg-primary", "bg-surface", "bg-elevated"]) {
          expect(
            contrastRatio(t()["fg-primary"], t()[bg]),
            `fg-primary on ${bg}`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        }
      });

      it("secondary + muted text on the page background pass normal-text AA", () => {
        expect(
          contrastRatio(t()["fg-secondary"], t()["bg-primary"]),
          "fg-secondary on bg-primary",
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        expect(
          contrastRatio(t()["fg-muted"], t()["bg-primary"]),
          "fg-muted on bg-primary",
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });

      it("secondary text on surface + elevated passes normal-text AA (#207)", () => {
        // The ThemePicker tablist (and other panel UI) renders on
        // surface/elevated backgrounds, not bg-primary. Inactive tabs
        // use --fg-secondary, so it must clear AA there too — fg-muted
        // does NOT (catppuccin-latte fg-muted on bg-elevated = 3.49),
        // which is why inactive tabs were switched off fg-muted.
        for (const bg of ["bg-surface", "bg-elevated"]) {
          expect(
            contrastRatio(t()["fg-secondary"], t()[bg]),
            `fg-secondary on ${bg}`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        }
      });

      it("accent button text passes normal-text AA", () => {
        expect(
          contrastRatio(t()["accent-fg"], t()["accent"]),
          "accent-fg on accent",
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });

      // #179 — pin EVERY shadcn button-variant (background, text)
      // pair, not just the primary one. The semantic tokens map to
      // these theme tokens in styles/tailwind.css; a variant whose
      // text drops below AA on its own surface goes invisible in
      // that theme (soft-pop's secondary was white-on-teal, 1.86:1,
      // because bg-secondary was never checked as a text surface).
      it("every button-variant text passes normal-text AA on its surface", () => {
        const VARIANTS: Array<[string, string, string]> = [
          // [variant, background token, foreground token]
          ["default", "accent", "accent-fg"],
          ["secondary", "bg-secondary", "fg-primary"],
          ["outline/ghost", "bg-primary", "fg-primary"],
          ["destructive", "error", "fg-inverse"],
        ];
        for (const [variant, bg, fg] of VARIANTS) {
          expect(
            contrastRatio(t()[fg], t()[bg]),
            `${variant} button: ${fg} on ${bg}`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        }
      });

      it("status colors as text pass normal-text AA on the page", () => {
        for (const status of ["success", "error", "warning", "info"]) {
          expect(
            contrastRatio(t()[status], t()["bg-primary"]),
            `${status} on bg-primary`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        }
      });

      it("exercise feedback colors pass large-text/UI AA on a surface", () => {
        for (const ex of ["exercise-correct", "exercise-wrong"]) {
          expect(
            contrastRatio(t()[ex], t()["bg-surface"]),
            `${ex} on bg-surface`,
          ).toBeGreaterThanOrEqual(AA_LARGE_TEXT_OR_UI);
        }
      });

      // #183 — the matching result tiles tint the surface with the
      // exercise-correct / -wrong color (green / red) and render
      // fg-primary on top (--matching-correct-bg / --matching-error-bg
      // in global.css). The text must stay AA on the computed tint.
      it("matching correct/wrong feedback backgrounds keep fg-primary at AA", () => {
        const correctBg = mixSrgb(t()["exercise-correct"], t()["bg-surface"], 22);
        const wrongBg = mixSrgb(t()["exercise-wrong"], t()["bg-surface"], 22);
        expect(
          contrastRatio(t()["fg-primary"], correctBg),
          "fg-primary on --matching-correct-bg",
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        expect(
          contrastRatio(t()["fg-primary"], wrongBg),
          "fg-primary on --matching-error-bg",
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });
    });
  }
});

describe("shadcn accent-foreground passes AA on the brand accent (#82)", () => {
  const bridge = readFileSync(resolve(HERE, "tailwind.css"), "utf-8");

  it("maps --color-accent-foreground to --accent-fg, not --fg-primary", () => {
    const match = bridge.match(/--color-accent-foreground:\s*var\((--[a-z-]+)\)/);
    expect(match?.[1], "accent-foreground mapping not found").toBeTruthy();
    expect(match?.[1]).toBe("--accent-fg");
  });

  for (const id of THEME_IDS) {
    it(`theme=${id}: accent-fg on accent (ghost/outline hover) passes AA`, () => {
      const tokens = THEME_TOKENS[id];
      expect(
        contrastRatio(tokens["accent-fg"], tokens["accent"]),
        "accent-fg on accent (shipped ghost/outline hover)",
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }
});

describe("#96 — --accent used as TEXT (ghost hint / link) passes AA", () => {
  // The exercise ghost-hint + reveal links render `--accent-text` as
  // normal text on the exercise surface / page background (e.g.
  // ClozeExercise / FreeTextExercise / WordTilesExercise /
  // MatchingExercise). `--accent` itself is a FILL color and is not
  // always readable as text (supabase mint on white = 1.54), so the
  // readable `--accent-text` token exists for that purpose and is what
  // this pin guards. bg-elevated only needs large-text/UI AA (the hint
  // never renders there).
  for (const id of THEME_IDS) {
    const t = () => THEME_TOKENS[id];

    it(`theme=${id}: accent-text on bg-primary + surface passes normal-text AA`, () => {
      for (const bg of ["bg-primary", "bg-surface"]) {
        expect(
          contrastRatio(t()["accent-text"], t()[bg]),
          `accent-text on ${bg}`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    });

    it(`theme=${id}: accent-text on bg-elevated passes large-text/UI AA`, () => {
      expect(
        contrastRatio(t()["accent-text"], t()["bg-elevated"]),
        "accent-text on bg-elevated",
      ).toBeGreaterThanOrEqual(AA_LARGE_TEXT_OR_UI);
    });
  }

  it("catppuccin-mocha: --accent on bg-elevated meets normal-text AA (#96 nudge)", () => {
    // The reported gap: mocha's accent (#cba6f7) on the old elevated
    // surface (#45475a) was 4.49 — a hair under AA. bg-elevated was
    // nudged to Catppuccin surface0 (#313244) to clear 4.5.
    const tokens = THEME_TOKENS["catppuccin-mocha"];
    expect(
      contrastRatio(tokens["accent"], tokens["bg-elevated"]),
      "mocha accent on bg-elevated",
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe("#185 / #271 — raw <button> never falls back to UA system colours", () => {
  // Preflight is OFF, so a raw <button> with no author `color` /
  // `background` takes the UA `buttontext` (~black, invisible on dark
  // surfaces — #185) and `buttonface` (~#efefef, a glaring light box on
  // dark themes — #271). The base-layer defaults below make it inherit
  // the page foreground and stay transparent while still losing to any
  // explicit text-* / bg-* utility. Pin the rule so neither half of the
  // architectural fix can silently regress.
  const css = readLegacyCssSum();
  const baseButton = css.match(/@layer base\s*\{\s*button\s*\{([^}]*)\}\s*\}/);

  it("global.css declares a base-layer button color fallback (#185)", () => {
    expect(baseButton, "missing `@layer base { button { ... } }` (see #185/#271)").toBeTruthy();
    expect(baseButton?.[1], "base-layer button missing `color: inherit`").toMatch(
      /color:\s*inherit;/,
    );
  });

  it("global.css declares a base-layer button background fallback (#271)", () => {
    expect(
      baseButton?.[1],
      "base-layer button missing `background-color: transparent` (see #271)",
    ).toMatch(/background-color:\s*transparent;/);
  });

  it("the unlayered base button rule still sets no color (so utilities win)", () => {
    // The unlayered `button { font-family; cursor }` rule must NOT gain a
    // color: an unlayered color would beat the layered shadcn `text-*`
    // utilities and break every <Button> variant.
    const unlayered = css.match(/\nbutton\s*\{[^}]*\}/);
    expect(unlayered?.[0], "unlayered button rule not found").toBeTruthy();
    expect(unlayered?.[0]).not.toMatch(/color:/);
  });
});

describe("#194/#1723 — the content-link rule must not beat class-styled anchors", () => {
  // `<Link className="btn btn-primary">` renders as `<a class="btn">`, and
  // the skip link renders as `<a class="skip-to-content">`. The generic
  // content-link rule needs its `data-slot`/`.btn` carve-outs for the
  // LAYERED-utility case (#146/#194: an unlayered rule beats layered
  // utilities regardless of specificity) — but the carve-out arguments
  // count toward specificity, so a bare `a:not(...):not(.btn)` reached
  // (0,2,1) and beat EVERY unlayered class rule at (0,1,0), painting the
  // skip link's label accent-on-accent (#1723). The exclusions must
  // therefore live inside `:where()`, which keeps the matched set but
  // pins the selector at (0,0,1).
  const css = readLegacyCssSum();

  it("the generic anchor color rule keeps both carve-outs inside :where()", () => {
    const rule = css.match(
      /a:where\(:not\(\[data-slot="button"\]\):not\(\.btn\)\)\s*\{[^}]*color:\s*var\(--accent\)/,
    );
    expect(
      rule,
      'the content-link rule must be `a:where(:not([data-slot="button"]):not(.btn))` (see #194/#1723)',
    ).toBeTruthy();
  });

  it("no specificity-raising bare :not() variant of the anchor color rule exists", () => {
    // A bare `a:not(...)` (outside :where()) raises the selector to
    // (0,1,1)+ and re-introduces the #1723 class of bug: every anchor
    // whose class sets a text color (skip-to-content, .btn-*) loses.
    const unguarded = css.match(
      /\na:not\([^)]*\)(:not\([^)]*\))*\s*\{[^}]*color:\s*var\(--accent\)/,
    );
    expect(
      unguarded,
      "the anchor color rule must wrap its exclusions in :where() (see #1723)",
    ).toBeFalsy();
  });

  it(".btn sets text-decoration: none (carved-out anchors must not underline)", () => {
    const btn = css.match(/\n\.btn\s*\{[^}]*\}/);
    expect(btn?.[0], ".btn rule not found").toBeTruthy();
    expect(btn?.[0]).toMatch(/text-decoration:\s*none/);
  });

  it("the skip link keeps its on-accent label color (#1723)", () => {
    const skip = css.match(/\n\.skip-to-content\s*\{[^}]*\}/);
    expect(skip?.[0], ".skip-to-content rule not found").toBeTruthy();
    expect(skip?.[0]).toMatch(/color:\s*var\(--accent-fg\)/);
    expect(skip?.[0]).toMatch(/background:\s*var\(--accent\)/);
  });
});

describe("Phase 39 C5 — method-badge contrast (WCAG SC 1.4.3)", () => {
  for (const method of LEARNING_METHODS) {
    it(`method=${method}: text color picked by bestTextOn meets AA`, () => {
      const bg = METHOD_COLORS[method];
      const text = bestTextOn(bg);
      expect(contrastRatio(bg, text)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }
});

describe("Phase 39 C5 — bestTextOn helper", () => {
  it("returns the color with the higher contrast ratio", () => {
    expect(bestTextOn("#fafafa")).toBe("#000000");
    expect(bestTextOn("#0f0f10")).toBe("#ffffff");
    expect(bestTextOn("#f59e0b")).toBe("#000000");
  });
});

describe("Phase 39 C5 — contrast helper sanity", () => {
  it("pure black on pure white returns the WCAG ceiling (21:1)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
  it("argument order does not affect the ratio", () => {
    expect(contrastRatio("#1a1a1a", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#1a1a1a"), 5);
  });
});

describe("#108 — matching side tints pass WCAG AA (text on the tinted tile)", () => {
  // The matching tokens are color-mix(in srgb, <src> p%, var(--bg-surface)).
  // ``color-mix(in srgb)`` interpolates the gamma-encoded sRGB channels
  // linearly, so we replicate it here from the real per-theme token hexes
  // and pin the rendered tile color against its text (--fg-primary) at
  // normal-text AA. This is the computational (relative-luminance) WCAG
  // check the design tokens promise. The mix percentages mirror the CSS
  // (sides 16%, paired 22%); keep them in sync with theme-*.css + the
  // generator if they change.
  function parseHex(hex: string): [number, number, number] {
    let h = hex.replace("#", "");
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  /** color-mix(in srgb, src `frac`%, surface) — src fraction in [0,1]. */
  function mixSrgb(srcHex: string, surfaceHex: string, frac: number): string {
    const src = parseHex(srcHex);
    const surf = parseHex(surfaceHex);
    const ch = (i: number) =>
      Math.round(frac * src[i] + (1 - frac) * surf[i])
        .toString(16)
        .padStart(2, "0");
    return `#${ch(0)}${ch(1)}${ch(2)}`;
  }

  for (const id of THEME_IDS) {
    const t = () => THEME_TOKENS[id];

    it(`theme=${id}: side-a / side-b tints meet normal-text AA`, () => {
      const surface = t()["bg-surface"];
      const fg = t()["fg-primary"];
      const tints: Array<[string, string]> = [
        ["side-a", mixSrgb(t()["info"], surface, 0.16)],
        ["side-b", mixSrgb(t()["success"], surface, 0.16)],
      ];
      for (const [name, bg] of tints) {
        expect(contrastRatio(fg, bg), `matching ${name} fg on tint`).toBeGreaterThanOrEqual(
          AA_NORMAL_TEXT,
        );
      }
    });
  }
});

describe("#211 — the .btn base class declares a readable text color", () => {
  // Root-cause guard: a bare ``.btn`` (no .btn-primary/-secondary/-danger
  // variant) must define a ``color`` so it is never invisible in dark
  // themes. The variants override it; this pins the base default.
  const css = readLegacyCssSum();

  it(".btn { ... } sets a color token", () => {
    // Line-anchored so context rules like `.lesson-next-step-card .btn`
    // (which stay in global.css and precede the peeled base rule in the
    // stylesheet sum) cannot shadow the BASE `.btn` rule under test.
    const match = css.match(/^\.btn\s*\{([^}]*)\}/m);
    expect(match, ".btn rule not found in global.css + styles/legacy").toBeTruthy();
    const body = match![1];
    expect(
      /color:\s*var\(--[a-z0-9-]+\)/.test(body),
      ".btn base rule must set color: var(--...) so a variant-less .btn stays readable",
    ).toBe(true);
  });
});
