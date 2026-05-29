/**
 * Tests for the synthesized sound effects (EXP-008 / Phase 55F).
 *
 * Pins:
 *  - renderSamples yields a non-trivial, clamped mono buffer for
 *    every effect (the "produces a valid AudioBuffer" contract),
 *  - playSound is a no-op when sounds are disabled (mute),
 *  - master volume scales the GainNode,
 *  - playback is a no-op when Web Audio is unavailable.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
    _resetAudioContextForTests,
    playSound,
    renderSamples,
    type SoundName,
} from "./sound-effects";
import {setSoundEnabled, setSoundVolume} from "../feedback/feedbackPref";

const ALL: SoundName[] = [
    "correct_answer",
    "wrong_answer",
    "star_earned",
    "confetti",
    "badge_earned",
    "level_up",
];

// Minimal Web Audio mock that records the gain applied.
let lastGain = -1;
let startedCount = 0;

class FakeGainNode {
    gain = {value: 0};
    connect = vi.fn();
}
class FakeBufferSource {
    buffer: unknown = null;
    connect = vi.fn();
    start = vi.fn(() => {
        startedCount += 1;
    });
}
class FakeAudioContext {
    sampleRate = 44100;
    state = "running";
    destination = {};
    resume = vi.fn();
    createBuffer(_channels: number, length: number) {
        const data = new Float32Array(length);
        return {getChannelData: () => data};
    }
    createBufferSource() {
        return new FakeBufferSource();
    }
    createGain() {
        const node = new FakeGainNode();
        // Capture the gain value when it is set by playSound.
        Object.defineProperty(node.gain, "value", {
            set(v: number) {
                lastGain = v;
            },
            get() {
                return lastGain;
            },
            configurable: true,
        });
        return node;
    }
}

beforeEach(() => {
    localStorage.clear();
    _resetAudioContextForTests();
    lastGain = -1;
    startedCount = 0;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("renderSamples", () => {
    it("produces a non-empty, clamped mono buffer for every effect", () => {
        for (const name of ALL) {
            const samples = renderSamples(name, 44100);
            expect(samples).toBeInstanceOf(Float32Array);
            expect(samples.length).toBeGreaterThan(100);
            let peak = 0;
            for (const s of samples) {
                expect(s).toBeGreaterThanOrEqual(-1);
                expect(s).toBeLessThanOrEqual(1);
                peak = Math.max(peak, Math.abs(s));
            }
            expect(peak).toBeGreaterThan(0); // not silent
        }
    });

    it("scales length with the sample rate", () => {
        const lo = renderSamples("level_up", 8000);
        const hi = renderSamples("level_up", 48000);
        expect(hi.length).toBeGreaterThan(lo.length);
    });
});

describe("playSound", () => {
    it("is a no-op when sounds are disabled", () => {
        vi.stubGlobal("AudioContext", FakeAudioContext);
        setSoundEnabled(false);
        expect(playSound("star_earned")).toBe(false);
        expect(startedCount).toBe(0);
    });

    it("is a no-op at zero volume even when enabled", () => {
        vi.stubGlobal("AudioContext", FakeAudioContext);
        setSoundEnabled(true);
        setSoundVolume(0);
        expect(playSound("star_earned")).toBe(false);
    });

    it("plays and scales the gain by the master volume", () => {
        vi.stubGlobal("AudioContext", FakeAudioContext);
        setSoundEnabled(true);
        setSoundVolume(40);
        expect(playSound("star_earned")).toBe(true);
        expect(startedCount).toBe(1);
        expect(lastGain).toBeCloseTo(0.4, 5);
    });

    it("is a no-op when Web Audio is unavailable", () => {
        vi.stubGlobal("AudioContext", undefined);
        vi.stubGlobal("webkitAudioContext", undefined);
        setSoundEnabled(true);
        setSoundVolume(50);
        expect(playSound("correct_answer")).toBe(false);
    });
});
