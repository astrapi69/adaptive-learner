/**
 * useLessonAutoRead: ending read-aloud from the mini player (#3760).
 *
 * The player's X ends read-aloud for the CURRENT LESSON: it stops the
 * stream and keeps auto-read quiet for the rest of this lesson. The
 * persisted preference is not touched (owner review: an X means "end
 * this", not "switch the feature off"), so the next lesson reads again.
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

import type { ContentLesson } from "../../../storage/types";
import { useLessonAutoRead } from "./useLessonAutoRead";

const LESSON_A = { id: "a", steps: [] } as unknown as ContentLesson;
const LESSON_B = { id: "b", steps: [] } as unknown as ContentLesson;

function renderAutoRead(lesson: ContentLesson | null = LESSON_A) {
  return renderHook(
    ({ current }: { current: ContentLesson | null }) =>
      useLessonAutoRead({
        lesson: current,
        currentStepIndex: 0,
        showResumePrompt: false,
        goToStep: vi.fn(),
      }),
    { initialProps: { current: lesson } },
  );
}

beforeEach(() => {
  engine.stop.mockClear();
  engine.speak.mockClear();
  engine.writeLessonAutoRead.mockClear();
  engine.autoReadStored = true;
});

describe("useLessonAutoRead endReadAloud (#3760)", () => {
  it("stops the stream and keeps this lesson quiet without touching the setting", () => {
    const { result } = renderAutoRead();
    expect(result.current.autoRead).toBe(true);

    act(() => result.current.endReadAloud());

    expect(engine.stop).toHaveBeenCalledTimes(1);
    expect(result.current.autoRead).toBe(false);
    expect(engine.writeLessonAutoRead).not.toHaveBeenCalled();
  });

  it("reads aloud again in the next lesson", () => {
    const { result, rerender } = renderAutoRead();
    act(() => result.current.endReadAloud());
    expect(result.current.autoRead).toBe(false);

    rerender({ current: LESSON_B });

    expect(result.current.autoRead).toBe(true);
  });

  it("with auto-read off, only stops the stream", () => {
    engine.autoReadStored = false;
    const { result } = renderAutoRead();

    act(() => result.current.endReadAloud());

    expect(engine.stop).toHaveBeenCalledTimes(1);
    expect(result.current.autoRead).toBe(false);
    expect(engine.writeLessonAutoRead).not.toHaveBeenCalled();
  });

  it("the options toggle turns it back on in the same lesson", () => {
    const { result } = renderAutoRead();
    act(() => result.current.endReadAloud());
    act(() => result.current.toggleAutoRead());

    expect(result.current.autoRead).toBe(true);
    expect(engine.writeLessonAutoRead).toHaveBeenLastCalledWith(true);
  });

  it("the options toggle still switches auto-read off for good", () => {
    const { result } = renderAutoRead();
    act(() => result.current.toggleAutoRead());

    expect(result.current.autoRead).toBe(false);
    expect(engine.writeLessonAutoRead).toHaveBeenLastCalledWith(false);
  });
});
