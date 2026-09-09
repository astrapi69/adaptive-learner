/** Tests for the AIV-07 undo snapshot store (#3060). */

import {beforeEach, describe, expect, it} from "vitest";

import type {FixSnapshot} from "./ai-fix";
import {clearFixSnapshot, readFixSnapshot, writeFixSnapshot} from "./ai-fix-undo-store";

const SNAPSHOT: FixSnapshot = {
    source: "user-generated",
    setId: "my-set",
    appliedAt: "2026-09-09T12:00:00Z",
    changes: [{lessonId: "01", cardId: "c2", field: "front", before: "casa", after: "la casa"}],
};

describe("ai-fix-undo-store (#3060)", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("round-trips a snapshot per set and keeps other sets apart", () => {
        writeFixSnapshot(SNAPSHOT, localStorage, false);
        writeFixSnapshot({...SNAPSHOT, setId: "other"}, localStorage, false);
        expect(readFixSnapshot("user-generated", "my-set", localStorage)).toEqual(SNAPSHOT);
        expect(readFixSnapshot("user-generated", "other", localStorage)?.setId).toBe("other");
        expect(readFixSnapshot("user-generated", "none", localStorage)).toBeNull();
    });

    it("clear removes only the named set's snapshot", () => {
        writeFixSnapshot(SNAPSHOT, localStorage, false);
        writeFixSnapshot({...SNAPSHOT, setId: "other"}, localStorage, false);
        clearFixSnapshot("user-generated", "my-set", localStorage, false);
        expect(readFixSnapshot("user-generated", "my-set", localStorage)).toBeNull();
        expect(readFixSnapshot("user-generated", "other", localStorage)).not.toBeNull();
    });

    it("drops a corrupt entry instead of the whole map", () => {
        localStorage.setItem(
            "adaptive-learner.ai-fix-undo",
            JSON.stringify({"user-generated::my-set": SNAPSHOT, "user-generated::bad": {nope: 1}}),
        );
        expect(readFixSnapshot("user-generated", "my-set", localStorage)).toEqual(SNAPSHOT);
        expect(readFixSnapshot("user-generated", "bad", localStorage)).toBeNull();
        localStorage.setItem("adaptive-learner.ai-fix-undo", "{not json");
        expect(readFixSnapshot("user-generated", "my-set", localStorage)).toBeNull();
    });
});
