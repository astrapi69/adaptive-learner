/**
 * Guard: the ``forceRerunTriggers`` entries that close the #1620 class
 * (readFileSync guard tests invisible to ``vitest --changed``'s module
 * graph) must stay in ``vite.config.ts``. Removing one silently reopens
 * the green-PR-red-develop window for that file class (#1614 index.html,
 * #1665 global.css). A text pin is deliberate - importing the config in
 * a test would execute the full Vite plugin stack.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe, expect, it} from "vitest";

const VITE_CONFIG = readFileSync(
    join(process.cwd(), "vite.config.ts"),
    "utf-8",
);

describe("forceRerunTriggers close the #1620 readFileSync-guard class", () => {
    it.each([
        ["**/index.html", "ios-zoom-guard reads index.html (#1614)"],
        ["**/src/styles/**/*.css", "style pins read global.css + styles/legacy (#1665)"],
        ["**/src/data/**/*.json", "i18n/mission-catalog guards read bundled JSON"],
    ])("keeps %s (%s)", (glob) => {
        expect(VITE_CONFIG).toContain(`"${glob}"`);
    });

    it("keeps Vitest's default triggers (an override REPLACES the defaults)", () => {
        expect(VITE_CONFIG).toContain('"**/package.json/**"');
        expect(VITE_CONFIG).toContain('"**/{vitest,vite}.config.*/**"');
    });

    it("keeps the file-form variants (the /**-suffixed defaults never match the files themselves)", () => {
        expect(VITE_CONFIG).toContain('"**/package.json"');
        expect(VITE_CONFIG).toContain('"**/{vitest,vite}.config.*"');
    });
});
