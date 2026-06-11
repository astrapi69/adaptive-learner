/**
 * ESLint v9 flat config (#222). Minimal, ratcheted baseline — code
 * quality on top of the TypeScript type check, NOT a Big-Bang rewrite.
 *
 * eslint is pinned to ^9 (eslint-plugin-react@7 peer-caps at ^9.7;
 * eslint 10 conflicts). Type-aware rules are intentionally NOT enabled
 * (no parserOptions.project) so the lint stays fast and config-light.
 *
 * Warnings (no-explicit-any, no-console, exhaustive-deps, security/*)
 * are surfaced but tolerated up to a CI ceiling that ratchets toward 0
 * over time. Errors (rules-of-hooks, no-unused-vars) block.
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";

export default tseslint.config(
    {
        ignores: [
            "dist/**",
            "coverage/**",
            "node_modules/**",
            "reports/**",
            "public/**",
            "src/data/i18n/**", // generated from backend YAML
            "**/*.config.{js,ts,mjs}",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.{ts,tsx}"],
        plugins: {
            react,
            "react-hooks": reactHooks,
            security,
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {ecmaFeatures: {jsx: true}},
        },
        settings: {react: {version: "detect"}},
        rules: {
            // TypeScript already flags undefined identifiers; the base
            // no-undef is redundant and would need a browser-globals list.
            "no-undef": "off",

            // Errors — block CI. Kept to rules with ZERO current
            // violations so the gate is meaningful from day one and
            // catches real future bugs (misplaced hooks, missing keys).
            "react-hooks/rules-of-hooks": "error",
            "react/jsx-key": "error",

            // Warnings — surfaced, ratcheted toward 0 over time. These
            // each have existing violations; they land as warnings so the
            // introduction is tooling-only (no Big-Bang code change) and
            // tighten to "error" in follow-ups once the code is cleaned.
            "no-unused-vars": "off", // handled by the TS-aware rule below
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {argsIgnorePattern: "^_", varsIgnorePattern: "^_"},
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "no-console": ["warn", {allow: ["warn", "error"]}],
            "no-empty": "warn",
            "prefer-const": "warn",
            "no-useless-escape": "warn",
            "react-hooks/exhaustive-deps": "warn",
            // NOTE: security/detect-object-injection is very noisy (flags
            // every obj[key] access, ~99% false positives) — it dominates
            // the warning count and is the first candidate for disabling
            // in the ratchet follow-up.
            "security/detect-object-injection": "warn",
            "security/detect-non-literal-regexp": "warn",
        },
    },
    {
        // Tests + setup may use console + dev-only patterns more freely.
        files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
        rules: {
            "no-console": "off",
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
);
