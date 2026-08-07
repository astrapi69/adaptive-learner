/**
 * The generated standalone validator must work under NATIVE ESM
 * semantics (#2415).
 *
 * The generator hoists Ajv's inline CJS requires to ESM imports. Vite's
 * dev-server interop resolves a default import of a CJS module to
 * ``exports.default`` (honouring ``__esModule``), so dev looks healthy -
 * but Node ESM and the Rolldown PRODUCTION bundle resolve it to the
 * ``module.exports`` OBJECT. With Ajv 8.20's ucs2length runtime helper
 * that made every draft check in the built app throw
 * ``(0 , T.default) is not a function`` (the lesson editor's author
 * path). These tests load the generated module through a real ``node``
 * subprocess - the exact semantics the bundle runs under - so the
 * interop can never again pass in dev and fail in the artifact
 * (lessons/core.md: test a tool through the interface it actually
 * uses).
 */

import {execFileSync} from "node:child_process";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const standalonePath = join(here, "lesson-schema-validator.standalone.mjs");

function runInNodeEsm(lesson: object): {ok: boolean; errors: number} {
    const script = [
        `import validate from ${JSON.stringify(standalonePath)};`,
        `const ok = validate(${JSON.stringify(lesson)});`,
        `console.log(JSON.stringify({ok, errors: (validate.errors ?? []).length}));`,
    ].join("\n");
    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        encoding: "utf-8",
    });
    return JSON.parse(stdout.trim()) as {ok: boolean; errors: number};
}

const minimalLesson = {
    id: "interop-check",
    title: "Titel",
    cards: [{id: "c1", front: "Bonjour", back: "Hallo"}],
    steps: [{id: "s1", type: "theory", body: "Ein kurzer Theorietext."}],
};

describe("standalone validator under native Node ESM (#2415)", () => {
    it("validates a minimal lesson without throwing", () => {
        const verdict = runInNodeEsm(minimalLesson);
        expect(verdict.ok).toBe(true);
        expect(verdict.errors).toBe(0);
    });

    it("still enforces the unicode length limits (the ucs2length path)", () => {
        const verdict = runInNodeEsm({
            ...minimalLesson,
            title: "T".repeat(500),
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.errors).toBeGreaterThan(0);
    });
});
