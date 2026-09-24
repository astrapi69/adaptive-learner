import {describe, expect, it} from "vitest";

import {formatDuration, hitRatePercent} from "./endless-format";

describe("formatDuration", () => {
    it.each([
        ["zero", 0, "0:00"],
        ["single-digit seconds are padded", 5, "0:05"],
        ["one minute exactly", 60, "1:00"],
        ["the stat-line example", 754, "12:34"],
        ["minutes are not capped at an hour", 3725, "62:05"],
    ])("%s", (_name, seconds, expected) => {
        expect(formatDuration(seconds)).toBe(expected);
    });
});

describe("hitRatePercent", () => {
    it.each([
        ["no card answered yet", {cards: 0, correct: 0}, 0],
        ["all correct", {cards: 4, correct: 4}, 100],
        ["rounds to the nearest percent", {cards: 45, correct: 38}, 84],
        ["none correct", {cards: 3, correct: 0}, 0],
    ])("%s", (_name, stats, expected) => {
        expect(hitRatePercent(stats)).toBe(expected);
    });
});
