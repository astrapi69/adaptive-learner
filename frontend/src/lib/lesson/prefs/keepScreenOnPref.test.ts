import {afterEach, describe, expect, it} from "vitest";

import {DEFAULT_KEEP_SCREEN_ON, readKeepScreenOn, setKeepScreenOn} from "./keepScreenOnPref";

afterEach(() => localStorage.clear());

describe("keepScreenOnPref (#3358)", () => {
    it("defaults to on", () => {
        expect(DEFAULT_KEEP_SCREEN_ON).toBe(true);
        expect(readKeepScreenOn()).toBe(true);
    });

    it.each([true, false])("round-trips %s", (value) => {
        setKeepScreenOn(value);
        expect(readKeepScreenOn()).toBe(value);
    });
});
