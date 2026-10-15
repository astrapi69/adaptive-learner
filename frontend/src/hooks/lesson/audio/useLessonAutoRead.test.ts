/**
 * useLessonAutoRead: ending read-aloud from the mini player (#3760).
 *
 * The player's stop used to end the current utterance only; with auto-read
 * on, the next step was read again and the player came straight back.
 * ``endReadAloud`` stops the stream AND turns auto-read off, persisted like
 * the options toggle.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  stop: vi.fn(),
  speak: vi.fn(),
  autoReadStored: true,
  writeLessonAutoRead: vi.fn(),
}));

vi.mock("./useReadAloud", () => ({
  useReadAloud: () => ({
    supported: true,
    enabled: true,
    voiceAvailable: true,
    speaking: true,
    paused: false,
    activeId: null,
    boundaryIndex: -1,
    speak: engine.speak,
    stop: engine.stop,
    pause: vi.fn(),
    resume: vi.fn(),
  }),
  readLessonAutoRead: () => engine.autoReadStored,
  writeLessonAutoRead: engine.writeLessonAutoRead,
}));

import { useLessonAutoRead } from "./useLessonAutoRead";

function renderAutoRead() {
  return renderHook(() =>
    useLessonAutoRead({
      lesson: null,
      currentStepIndex: 0,
      showResumePrompt: false,
      goToStep: vi.fn(),
    }),
  );
}

beforeEach(() => {
  engine.stop.mockClear();
  engine.speak.mockClear();
  engine.writeLessonAutoRead.mockClear();
  engine.autoReadStored = true;
});

describe("useLessonAutoRead endReadAloud (#3760)", () => {
  it("stops the stream and turns auto-read off, persisted", () => {
    const { result } = renderAutoRead();
    expect(result.current.autoRead).toBe(true);

    act(() => result.current.endReadAloud());

    expect(engine.stop).toHaveBeenCalledTimes(1);
    expect(result.current.autoRead).toBe(false);
    expect(engine.writeLessonAutoRead).toHaveBeenCalledWith(false);
  });

  it("with auto-read already off, still stops the stream and keeps it off", () => {
    engine.autoReadStored = false;
    const { result } = renderAutoRead();

    act(() => result.current.endReadAloud());

    expect(engine.stop).toHaveBeenCalledTimes(1);
    expect(result.current.autoRead).toBe(false);
    expect(engine.writeLessonAutoRead).toHaveBeenCalledWith(false);
  });

  it("can be turned on again with the options toggle afterwards", () => {
    const { result } = renderAutoRead();
    act(() => result.current.endReadAloud());
    act(() => result.current.toggleAutoRead());

    expect(result.current.autoRead).toBe(true);
    expect(engine.writeLessonAutoRead).toHaveBeenLastCalledWith(true);
  });
});
