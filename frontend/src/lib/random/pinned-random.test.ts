/**
 * The per-consumer random seam (#3214).
 *
 * Without a pin the seam is inert: ``pinnedRandom`` hands the callers
 * ``undefined`` (so their own ``Math.random`` default stays the only
 * production randomness) and ``mountShuffleSeed`` evaluates exactly the
 * pre-#3214 ``Date.now() & 0xffff`` suffix. With a valid pin every stream is
 * a fresh generator that no other draw can advance, and the mount seed stops
 * reading the clock.
 */

import {afterEach, describe, expect, it, vi} from "vitest";

import {
    RANDOM_PIN_GLOBAL,
    isRandomPin,
    mountShuffleSeed,
    pinnedRandom,
    type RandomPin,
} from "./pinned-random";

const PIN: RandomPin = {streamSeed: 0x1567, mountSalt: 13056};

function setPin(value: unknown): void {
    (globalThis as Record<string, unknown>)[RANDOM_PIN_GLOBAL] = value;
}

function draw(next: () => number, count: number): number[] {
    return Array.from({length: count}, () => next());
}

afterEach(() => {
    delete (globalThis as Record<string, unknown>)[RANDOM_PIN_GLOBAL];
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("without a pin (production)", () => {
    it("pinnedRandom returns undefined so the callers keep Math.random", () => {
        expect(pinnedRandom("shuffle-order")).toBeUndefined();
        expect(pinnedRandom("endless-repeat")).toBeUndefined();
    });

    it.each([
        {name: "an ordinary instant", now: 1781100004099},
        {name: "the last value before the 16-bit wrap", now: 0xffff},
        {name: "the first value after the 16-bit wrap", now: 0x10000},
        {name: "the epoch", now: 0},
    ])("mountShuffleSeed keeps the clock suffix at $name", ({now}) => {
        expect(
            now & 0xffff,
            "an instant whose low bits ARE the visual salt cannot tell the clock " +
                "suffix from a leaked pin",
        ).not.toBe(PIN.mountSalt);
        vi.useFakeTimers();
        vi.setSystemTime(now);
        expect(mountShuffleSeed("ex")).toBe(`ex#${now & 0xffff}`);
    });
});

/**
 * Define ``name`` on ``target`` for one test; ``afterEach`` cannot undo a
 * prototype or getter definition, so every caller removes it in ``finally``.
 */
function withProperty(
    target: object,
    descriptor: PropertyDescriptor,
    run: () => void,
): void {
    Object.defineProperty(target, RANDOM_PIN_GLOBAL, {configurable: true, ...descriptor});
    try {
        run();
    } finally {
        delete (target as Record<string, unknown>)[RANDOM_PIN_GLOBAL];
    }
}

describe("only an own, readable global is a pin", () => {
    const NOW = 1781100004099;

    function expectNoPin(): void {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        expect(pinnedRandom("shuffle-order")).toBeUndefined();
        expect(mountShuffleSeed("ex")).toBe(`ex#${NOW & 0xffff}`);
    }

    it("a pin inherited through Object.prototype does not switch it on", () => {
        withProperty(Object.prototype, {value: PIN, writable: true}, () => {
            expect((globalThis as Record<string, unknown>)[RANDOM_PIN_GLOBAL]).toBe(PIN);
            expectNoPin();
        });
    });

    it("a global whose read throws (a cross-origin named frame) yields no pin", () => {
        const blocked = (): never => {
            throw new DOMException("Blocked a frame from accessing", "SecurityError");
        };
        withProperty(globalThis, {get: blocked}, () => {
            expect(() => pinnedRandom("endless-repeat")).not.toThrow();
            expect(() => mountShuffleSeed("ex")).not.toThrow();
            expectNoPin();
        });
    });

    it("a pin read through a getter that returns a valid pin still counts", () => {
        withProperty(globalThis, {get: () => PIN}, () => {
            expect(pinnedRandom("shuffle-order")).toBeDefined();
            expect(mountShuffleSeed("ex")).toBe("ex#13056");
        });
    });
});

describe("a malformed pin counts as absent", () => {
    it.each([
        {name: "a string", value: "13056"},
        {name: "a fractional streamSeed", value: {streamSeed: 1.5, mountSalt: 1}},
        {name: "a negative streamSeed", value: {streamSeed: -1, mountSalt: 1}},
        {name: "a streamSeed above 32 bits", value: {streamSeed: 0x100000000, mountSalt: 1}},
        {name: "a mountSalt above 16 bits", value: {streamSeed: 1, mountSalt: 70000}},
        {name: "a NaN mountSalt", value: {streamSeed: 1, mountSalt: Number.NaN}},
        {name: "null", value: null},
        {name: "an empty object", value: {}},
        {
            name: "fields inherited from a prototype",
            value: Object.create({streamSeed: 1, mountSalt: 1}) as unknown,
        },
        {
            name: "a field whose read throws",
            value: Object.defineProperty({mountSalt: 1}, "streamSeed", {
                enumerable: true,
                get: (): never => {
                    throw new DOMException("Blocked", "SecurityError");
                },
            }) as unknown,
        },
    ])("$name", ({value}) => {
        expect(isRandomPin(value)).toBe(false);
        setPin(value);
        vi.useFakeTimers();
        vi.setSystemTime(1781100004099);
        expect(pinnedRandom("shuffle-order")).toBeUndefined();
        expect(mountShuffleSeed("ex")).toBe(`ex#${1781100004099 & 0xffff}`);
    });

    it.each([
        {name: "the smallest pin", value: {streamSeed: 0, mountSalt: 0}},
        {name: "the largest pin", value: {streamSeed: 0xffffffff, mountSalt: 0xffff}},
        {name: "the visual pin", value: PIN},
    ])("accepts $name", ({value}) => {
        expect(isRandomPin(value)).toBe(true);
    });
});

describe("with a pin (visual runs)", () => {
    it("the same stream name starts from the same point on every call", () => {
        setPin(PIN);
        const first = pinnedRandom("shuffle-order");
        const second = pinnedRandom("shuffle-order");
        expect(first).toBeDefined();
        expect(draw(first!, 8)).toEqual(draw(second!, 8));
    });

    it("different stream names produce different sequences", () => {
        setPin(PIN);
        expect(draw(pinnedRandom("shuffle-order")!, 8)).not.toEqual(
            draw(pinnedRandom("endless-repeat")!, 8),
        );
    });

    it("a stream is untouched by interleaved Math.random draws", () => {
        setPin(PIN);
        const expected = draw(pinnedRandom("endless-repeat")!, 8);
        const stream = pinnedRandom("endless-repeat")!;
        const interleaved: number[] = [];
        for (let i = 0; i < 8; i++) {
            Math.random();
            Math.random();
            interleaved.push(stream());
        }
        expect(interleaved).toEqual(expected);
    });

    it("the mount seed uses the pinned salt and never reads the clock", () => {
        setPin(PIN);
        const nowSpy = vi.spyOn(Date, "now");
        expect(mountShuffleSeed("ex-match")).toBe("ex-match#13056");
        expect(nowSpy).not.toHaveBeenCalled();
    });

    it("the pin is read at call time, not at import", () => {
        expect(pinnedRandom("shuffle-order")).toBeUndefined();
        setPin(PIN);
        expect(pinnedRandom("shuffle-order")).toBeDefined();
    });
});

describe("baseline preservation (#3214)", () => {
    /** The instant every visual run froze ``Date`` at before #3214. Written
     *  as a literal on purpose: the e2e constant may move (#3215), the
     *  preserved suffix must not. */
    const FROZEN_VISUAL_ISO = "2026-06-10T14:00:00Z";

    it("the visual mount salt is the suffix the frozen clock produced", () => {
        expect(Date.parse(FROZEN_VISUAL_ISO) & 0xffff).toBe(PIN.mountSalt);
    });

    it.each([
        {name: "a matching exercise", id: "ex-match-colors"},
        {name: "a word-tiles exercise", id: "ex-tiles-greeting"},
        {name: "a numeric lesson id", id: "01-a-ex3"},
    ])("the pinned mount seed of $name equals its pre-#3214 visual seed", ({id}) => {
        setPin(PIN);
        expect(mountShuffleSeed(id)).toBe(
            `${id}#${Date.parse(FROZEN_VISUAL_ISO) & 0xffff}`,
        );
    });
});

describe("inertness", () => {
    it("writes nothing to localStorage in either mode", () => {
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        const before = localStorage.length;
        pinnedRandom("shuffle-order");
        mountShuffleSeed("ex");
        setPin(PIN);
        pinnedRandom("shuffle-order")!();
        mountShuffleSeed("ex");
        expect(setItem).not.toHaveBeenCalled();
        expect(localStorage.length).toBe(before);
    });

    it("importing the module does not install a pin", async () => {
        vi.resetModules();
        await import("./pinned-random");
        expect(RANDOM_PIN_GLOBAL in globalThis).toBe(false);
    });
});
