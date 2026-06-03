/**
 * Regression pin for the shadcn/ui semantic-token bridge (Phase B / B1).
 *
 * shadcn components resolve their colours through Tailwind utilities
 * (bg-primary, bg-card, text-muted-foreground, bg-destructive,
 * border-input, ring-ring, ...) which only exist if tailwind.css maps
 * the matching ``--color-*`` tokens onto our themed vars. happy-dom
 * runs no CSS, so we pin the source mapping directly (same approach as
 * reduced-motion.test.ts). If a token is dropped, shadcn components
 * silently lose their colour in every theme — this fails first.
 */

import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {describe, expect, it} from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(HERE, "tailwind.css"), "utf-8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
);

describe("shadcn semantic-token bridge", () => {
    const MAP: Record<string, string> = {
        "--color-primary": "--accent",
        "--color-primary-foreground": "--accent-fg",
        "--color-background": "--bg-primary",
        "--color-foreground": "--fg-primary",
        "--color-card": "--bg-surface",
        "--color-card-foreground": "--fg-primary",
        "--color-popover": "--bg-elevated",
        "--color-secondary": "--bg-secondary",
        "--color-muted": "--bg-secondary",
        "--color-muted-foreground": "--fg-muted",
        "--color-accent-foreground": "--fg-primary",
        "--color-destructive": "--error",
        "--color-destructive-foreground": "--fg-inverse",
        "--color-input": "--border-primary",
        "--color-ring": "--accent",
    };

    for (const [token, themed] of Object.entries(MAP)) {
        it(`maps ${token} → var(${themed})`, () => {
            const re = new RegExp(
                `${token}:\\s*var\\(${themed}\\)`.replace(
                    /[-]/g,
                    "\\$&",
                ),
            );
            expect(CSS).toMatch(re);
        });
    }

    it("leaves brand --color-accent intact (not repurposed)", () => {
        expect(CSS).toMatch(/--color-accent:\s*var\(--accent\)/);
    });

    it("keeps the mapping inside an @theme inline block", () => {
        expect(CSS).toMatch(/@theme\s+inline\s*\{/);
    });
});
