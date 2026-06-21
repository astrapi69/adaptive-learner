/**
 * Unit tests for the lesson splitter's part-title formatting (#512).
 *
 * The cross-language parity goldens (``lesson-splitter.parity.test.ts``)
 * pin the DEFAULT title shape ("{title} — Part N of M"); this file
 * covers the optional ``partTitle`` formatter that the user-facing
 * Save-as-Offline-Lesson flow uses to localize the suffix
 * ("… - Teil {n}"), and asserts the default is unchanged when no
 * formatter is supplied.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import type {ContentLesson} from "../../../storage/types";
import {splitLesson} from "./lesson-splitter";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const INPUT = join(
    REPO_ROOT,
    "tests",
    "fixtures",
    "lesson-splitter-parity",
    "input.json",
);

function loadInput(): ContentLesson {
    return JSON.parse(readFileSync(INPUT, "utf-8")) as ContentLesson;
}

describe("splitLesson part titles", () => {
    it("uses the language-neutral default when no formatter is given", () => {
        const parts = splitLesson(loadInput(), {maxStepsPerPart: 4});
        expect(parts).toHaveLength(2);
        expect(parts[0].title).toBe("Les articles — Part 1 of 2");
        expect(parts[1].title).toBe("Les articles — Part 2 of 2");
    });

    it("applies a localized formatter to every part title", () => {
        const formatPartTitle = ({title, part}: {title: string; part: number}) =>
            `${title} - Teil ${part}`;
        const parts = splitLesson(loadInput(), {
            maxStepsPerPart: 3,
            partTitle: formatPartTitle,
        });
        expect(parts.map((p) => p.title)).toEqual([
            "Les articles - Teil 1",
            "Les articles - Teil 2",
            "Les articles - Teil 3",
        ]);
    });

    it("passes the correct total to the formatter", () => {
        const seen: number[] = [];
        splitLesson(loadInput(), {
            maxStepsPerPart: 3,
            partTitle: ({total, part}) => {
                seen.push(total);
                return `p${part}/${total}`;
            },
        });
        // 8 steps / 3 per part = 3 parts; total is constant across calls.
        expect(seen).toEqual([3, 3, 3]);
    });

    it("does not apply the formatter when no split is needed", () => {
        const lesson = loadInput();
        const formatPartTitle = () => "SHOULD NOT APPEAR";
        const parts = splitLesson(lesson, {
            maxStepsPerPart: 10,
            partTitle: formatPartTitle,
        });
        expect(parts).toHaveLength(1);
        expect(parts[0].title).toBe(lesson.title);
    });
});
