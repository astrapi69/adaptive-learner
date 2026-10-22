/**
 * useLessonAutoRead: the voice the lesson read-aloud paths speak with (#3805).
 *
 * The "R" shortcut, "Read all" and auto-read speak through the real
 * useReadAloud engine here; only the browser's speech API is mocked. The voice
 * list holds Chrome's network voice "Google Deutsch" (the privacy audit of
 * 2026-10-20 measured it on Linux) and a local espeak-ng voice that the
 * browser lists later, after the lesson has already loaded its list.
 * Auto-read speaks the step on display at once, before the engine has loaded
 * any list of its own. A network voice sends the text read aloud to its
 * provider, so a local voice must win whenever the browser offers one.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_VOICE_WAIT_MS } from "../../../lib/voice/speech-synthesis";
import type { ContentLesson } from "../../../storage/types";
import { useLessonAutoRead } from "./useLessonAutoRead";

interface RecordedUtterance {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
}

let spoken: RecordedUtterance[];
let offered: SpeechSynthesisVoice[];
let voicesChangedListeners: Array<() => void>;

function voice(name: string, lang: string, localService: boolean): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

const googleDeutsch = voice("Google Deutsch", "de-DE", false);
const espeakGerman = voice("German espeak-ng", "de", true);

/** Mock synth: like a real browser, ``getVoices()`` returns a fresh copy of
 *  whatever ``offered`` holds when it is called. */
function mountSynth(initial: SpeechSynthesisVoice[]): void {
  spoken = [];
  offered = [...initial];
  voicesChangedListeners = [];
  (window as unknown as { speechSynthesis: SpeechSynthesis }).speechSynthesis = {
    getVoices: () => [...offered],
    speak: (u: RecordedUtterance) => spoken.push(u),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    speaking: false,
    pending: false,
    addEventListener: (event: string, listener: () => void) => {
      if (event === "voiceschanged") voicesChangedListeners.push(listener);
    },
    removeEventListener: (event: string, listener: () => void) => {
      voicesChangedListeners = voicesChangedListeners.filter((l) => l !== listener);
    },
  } as unknown as SpeechSynthesis;
  class FakeUtterance {
    text: string;
    lang = "";
    rate = 1;
    pitch = 1;
    voice: SpeechSynthesisVoice | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    FakeUtterance;
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    FakeUtterance;
}

const LESSON = {
  id: "voice-probe",
  title: "Vorlese-Probe",
  target_language: "de",
  cards: [],
  steps: [
    { id: "t1", type: "theory", body: "Erster Absatz." },
    { id: "t2", type: "theory", body: "Zweiter Absatz." },
  ],
} as unknown as ContentLesson;

/** Render the lesson read-aloud on the first step of {@link LESSON}. */
function renderLesson() {
  return renderHook(() =>
    useLessonAutoRead({
      lesson: LESSON,
      currentStepIndex: 0,
      showResumePrompt: false,
      goToStep: vi.fn(),
    }),
  );
}

/** Let the engine's mount-time ``loadVoices()`` settle. */
async function flushVoiceLoading(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Render the lesson read-aloud with the network voice loaded at mount, then
 *  let the local voice arrive. */
async function renderWithLateLocalVoice() {
  mountSynth([googleDeutsch]);
  const hook = renderLesson();
  await flushVoiceLoading();
  offered.push(espeakGerman);
  return hook;
}

beforeEach(() => {
  localStorage.clear();
});

describe("lesson read-aloud voice (#3805)", () => {
  it("the R shortcut reads with the local voice the browser offers by then", async () => {
    await renderWithLateLocalVoice();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    });
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toContain("Erster Absatz");
    expect(spoken[0].voice).toBe(espeakGerman);
  });

  it('"Read all" reads with the local voice the browser offers by then', async () => {
    const { result } = await renderWithLateLocalVoice();
    act(() => result.current.startContinuous());
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toContain("Zweiter Absatz");
    expect(spoken[0].voice).toBe(espeakGerman);
  });

  it("auto-read reads the step on display with the local voice, before the engine has loaded its own list", async () => {
    localStorage.setItem(
      "adaptive-learner.voice.prefs",
      JSON.stringify({ lessonAutoRead: true }),
    );
    mountSynth([googleDeutsch, espeakGerman]);
    renderLesson();
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toContain("Erster Absatz");
    expect(spoken[0].voice).toBe(espeakGerman);
    await flushVoiceLoading();
  });

  it("the R shortcut keeps the learner's explicit choice of a network voice", async () => {
    localStorage.setItem(
      "adaptive-learner.voice.prefs",
      JSON.stringify({ ttsVoiceName: "Google Deutsch" }),
    );
    await renderWithLateLocalVoice();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    });
    expect(spoken[0].voice).toBe(googleDeutsch);
  });
});

/** Add ``voice`` to the browser's list and fire ``voiceschanged``, the way
 *  a browser announces voices it lists late. */
function deliver(voice: SpeechSynthesisVoice): void {
  offered.push(voice);
  voicesChangedListeners.forEach((listener) => listener());
}

/** Turn auto-read on (plus any other saved voice preference). */
function enableAutoRead(prefs: Record<string, unknown> = {}): void {
  localStorage.setItem(
    "adaptive-learner.voice.prefs",
    JSON.stringify({ lessonAutoRead: true, ...prefs }),
  );
}

// On a cold start the browser may list the device's voices only after the
// step mounted; read at once, the step would go to "Google Deutsch". Auto-read
// is the one path no tap starts, so it can wait for them; a tap must speak in
// its own handler.
describe("auto-read on a cold start (#3805)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    return () => vi.useRealTimers();
  });

  it("waits for the local voice that arrives after the network voices", () => {
    enableAutoRead();
    mountSynth([googleDeutsch]);
    renderLesson();
    expect(spoken).toHaveLength(0);
    act(() => deliver(espeakGerman));
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toContain("Erster Absatz");
    expect(spoken[0].voice).toBe(espeakGerman);
  });

  it("reads with the network voice when no local voice has come by the end of the wait", () => {
    enableAutoRead();
    mountSynth([googleDeutsch]);
    renderLesson();
    act(() => vi.advanceTimersByTime(DEVICE_VOICE_WAIT_MS - 1));
    expect(spoken).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1));
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice).toBe(googleDeutsch);
  });

  it("reads at once with the network voice the learner chose", () => {
    enableAutoRead({ ttsVoiceName: "Google Deutsch" });
    mountSynth([googleDeutsch]);
    renderLesson();
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice).toBe(googleDeutsch);
  });

  it("reads nothing when auto-read is switched off during the wait", () => {
    enableAutoRead();
    mountSynth([googleDeutsch]);
    const { result } = renderLesson();
    act(() => result.current.toggleAutoRead());
    act(() => deliver(espeakGerman));
    act(() => vi.advanceTimersByTime(DEVICE_VOICE_WAIT_MS));
    expect(spoken).toHaveLength(0);
  });
});
