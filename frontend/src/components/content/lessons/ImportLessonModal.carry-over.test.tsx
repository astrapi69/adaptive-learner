/**
 * #2592 — the import-OVERWRITE path must not orphan SRS/error rows silently.
 *
 * Drives the real collision dialog (parse a file whose set id already exists,
 * click "Overwrite") so the wiring is observed end to end: the saved version is
 * peeked BEFORE ``saveUserSet`` replaces it, and the carry-over is applied
 * AFTER. Both halves of that ordering are load-bearing, so both are asserted
 * against the real call sequence rather than each call in isolation.
 *
 * The "Import as copy" branch is asserted to do NONE of this: a copy gets a
 * fresh set id and has no prior progress to carry.
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ImportLessonModal from "./ImportLessonModal";
import { generateLessonFromAnalysis } from "../../../lib/content/analysis/analysis-to-lesson";
import { lessonJson } from "../../../lib/content/lesson/lesson-export";
import { setUserId } from "../../../lib/learning/learnerState";
import { elementIdentityKeysOf } from "../../../lib/srs/element-identity";
import type { ConversationAnalysisResult } from "../../../types/domain";
import type { ContentLesson } from "../../../storage/types";

/** Every storage call the overwrite path makes, in the order it made them -
 *  the peek-before-save ordering is the assertion, not an implementation
 *  detail. */
const calls: string[] = [];

const saveUserSet = vi.fn(async () => {
  calls.push("saveUserSet");
  return {};
});
const listSets = vi.fn();
const listLessons = vi.fn(async () => {
  calls.push("listLessons");
  return { lessons: [SAVED_FILE] };
});
const getLesson = vi.fn(async () => {
  calls.push("getLesson");
  return savedLesson;
});
const listElementErrors = vi.fn(async () => {
  calls.push("elementErrors.list");
  return rows;
});
const remapKeys = vi.fn(async () => {
  calls.push("remapKeys");
  return { applied: 1, skipped: 0 };
});
const remapExerciseIds = vi.fn(async () => {
  calls.push("remapExerciseIds");
  return { applied: 0, skipped: 0 };
});

vi.mock("../../../storage", async (orig) => ({
  ...(await orig<typeof import("../../../storage")>()),
  getStorage: () => ({
    contentLoader: {
      saveUserSet: (...a: unknown[]) => saveUserSet(...(a as [])),
      listSets: (...a: unknown[]) => listSets(...(a as [])),
      listLessons: (...a: unknown[]) => listLessons(...(a as [])),
      getLesson: (...a: unknown[]) => getLesson(...(a as [])),
    },
    elementErrors: {
      list: (...a: unknown[]) => listElementErrors(...(a as [])),
      remapKeys: (...a: unknown[]) => remapKeys(...(a as [])),
      remapExerciseIds: (...a: unknown[]) => remapExerciseIds(...(a as [])),
    },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();
vi.mock("../../../utils/notify", () => ({
  notify: {
    success: (m: string) => toastSuccess(m),
    error: (m: unknown) => toastError(m),
    info: (m: string) => toastInfo(m),
    warning: vi.fn(),
  },
}));

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

const USER_ID = "u1";
const SET_ID = "imported-spanish-travel";

function analysisWith(waterTranslation: string): ConversationAnalysisResult {
  return {
    topic: "Spanish travel",
    summary: "Ordering food.",
    vocabulary: [
      { word: "la cuenta", translation: "the bill", example: "La cuenta, por favor." },
      { word: "el agua", translation: waterTranslation, example: "Quiero el agua." },
      { word: "la calle", translation: "the street", example: "La calle esta cerca." },
      { word: "izquierda", translation: "left", example: "Gira a la izquierda." },
    ],
  };
}

/** The reported scenario: the STORED version carries a typo the re-imported
 *  file has corrected. Same generator, same vocabulary count, so every
 *  exercise keeps its position and only the affected answer text moves - which
 *  is precisely the shape the remap plan classifies as certain. */
const STORED_TYPO = "the watter";
const CORRECTED = "the water";

function storedLesson(): ContentLesson {
  return generateLessonFromAnalysis(analysisWith(STORED_TYPO), {
    id: "analysis-conv-1",
  });
}

function importedLesson(): ContentLesson {
  return generateLessonFromAnalysis(analysisWith(CORRECTED), {
    id: "analysis-conv-1",
  });
}

let savedLesson: ContentLesson;
let rows: Record<string, unknown>[] = [];
const SAVED_FILE = "analysis-conv-1.json";

function importedFile() {
  return new File([lessonJson(importedLesson())], "spanish.json", {
    type: "application/json",
  });
}

function exercisesOf(lesson: ContentLesson) {
  return (lesson.steps ?? [])
    .map((step) => step.exercise)
    .filter((ex): ex is NonNullable<typeof ex> => !!ex?.id);
}

/** The first exercise of the STORED lesson whose identity keys actually
 *  changed between the two versions, together with the key the learner's row
 *  would hold. Derived by the SAME rule the attempt recorder applies
 *  (``elementIdentityKeysOf``) rather than hand-typed, so the fixture cannot
 *  drift away from what the runtime really stores - the trap that left #2657
 *  green and inert. */
function changedIdentity(): { exerciseId: string; oldKey: string; newKey: string } {
  const before = exercisesOf(savedLesson);
  const after = exercisesOf(importedLesson());
  for (const [index, exercise] of before.entries()) {
    const oldKeys = elementIdentityKeysOf(exercise as never) ?? [];
    const newKeys = elementIdentityKeysOf(after[index] as never) ?? [];
    const position = oldKeys.findIndex((key, i) => key !== newKeys[i]);
    if (position >= 0) {
      return {
        exerciseId: exercise.id as string,
        oldKey: oldKeys[position],
        newKey: newKeys[position],
      };
    }
  }
  throw new Error("fixture: the two versions carry identical identity keys");
}

/** A learner row on the stored version, in the REAL ElementError shape: the
 *  BARE lesson filename listLessons() returns (see #2657). */
function row(exerciseId: string, elementKey: string) {
  return {
    id: `${USER_ID}#${SET_ID}#${SAVED_FILE}#${exerciseId}#${elementKey}`,
    user_id: USER_ID,
    set_id: SET_ID,
    lesson_id: SAVED_FILE,
    exercise_id: exerciseId,
    element_key: elementKey,
    element_type: "vocabulary",
    user_answer: "",
    correct_answer: elementKey,
    error_count: 2,
    correct_streak: 0,
    last_error_at: "2026-08-13T00:00:00.000Z",
    last_attempt_at: "2026-08-13T00:00:00.000Z",
    mastered: false,
    mastered_at: null,
    created_at: "2026-08-13T00:00:00.000Z",
    updated_at: "2026-08-13T00:00:00.000Z",
  };
}

async function openCollisionDialog() {
  render(<ImportLessonModal open onCancel={() => {}} onImported={() => {}} />);
  await act(async () => {
    fireEvent.change(screen.getByTestId("import-lesson-file"), {
      target: { files: [importedFile()] },
    });
  });
  await waitFor(() =>
    expect(screen.getByTestId("import-lesson-preview")).toBeInTheDocument(),
  );
  await act(async () => {
    fireEvent.click(screen.getByTestId("import-lesson-confirm"));
  });
  await waitFor(() =>
    expect(screen.getByTestId("import-lesson-collision")).toBeInTheDocument(),
  );
}

beforeEach(() => {
  calls.length = 0;
  saveUserSet.mockClear();
  listSets.mockReset();
  listLessons.mockClear();
  getLesson.mockClear();
  listElementErrors.mockClear();
  remapKeys.mockClear();
  remapExerciseIds.mockClear();
  toastSuccess.mockReset();
  toastError.mockReset();
  toastInfo.mockReset();
  setUserId(USER_ID);
  savedLesson = storedLesson();
  rows = [];
  listSets.mockResolvedValue({
    sets: [{ source: "user-generated", id: SET_ID, title: "x" }],
    sources: [],
  });
});

describe("ImportLessonModal overwrite carries review progress (#2592)", () => {
  it("carries the row onto the corrected answer text, peeking BEFORE the save and remapping AFTER it", async () => {
    const { exerciseId, oldKey, newKey } = changedIdentity();
    rows = [row(exerciseId, oldKey)];

    await openCollisionDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("import-lesson-overwrite"));
    });
    await waitFor(() => expect(remapKeys).toHaveBeenCalled());

    // The row moves to the identity the imported file actually carries.
    expect(remapKeys).toHaveBeenCalledWith(USER_ID, [
      {
        set_id: SET_ID,
        lesson_id: SAVED_FILE,
        exercise_id: exerciseId,
        old: oldKey,
        new: newKey,
      },
    ]);
    // Ordering is load-bearing in BOTH directions: the peek must precede the
    // destructive save (afterwards the version the rows were recorded against
    // is gone), and the re-key must follow it (a failed save must leave the
    // old identities untouched rather than point rows at a version nothing
    // stores).
    const saveIndex = calls.indexOf("saveUserSet");
    expect(calls.indexOf("elementErrors.list")).toBeLessThan(saveIndex);
    expect(calls.indexOf("getLesson")).toBeLessThan(saveIndex);
    expect(calls.indexOf("remapKeys")).toBeGreaterThan(saveIndex);
    // The learner is told, with the count - the silence is the bug.
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("1"));
  });

  it("reads the stored set under the user-generated source, by the bare filename", async () => {
    const { exerciseId, oldKey } = changedIdentity();
    rows = [row(exerciseId, oldKey)];

    await openCollisionDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("import-lesson-overwrite"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());

    // A "lessons/"-prefixed filename would match nothing here (#2657).
    expect(getLesson).toHaveBeenCalledWith("user-generated", SET_ID, SAVED_FILE);
  });

  it("reports an unresolvable row instead of dropping it in silence", async () => {
    // A row whose element_key exists in NEITHER version: the plan has no
    // position to read, so it refuses - and must say so.
    const { exerciseId } = changedIdentity();
    rows = [row(exerciseId, "a key no version carries")];

    await openCollisionDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("import-lesson-overwrite"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());

    expect(remapKeys).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toastInfo).toHaveBeenCalledWith(
        expect.stringContaining("could not be confidently matched"),
      ),
    );
  });

  it("does nothing extra when the learner holds no rows in the set", async () => {
    rows = [];

    await openCollisionDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("import-lesson-overwrite"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());

    expect(getLesson).not.toHaveBeenCalled();
    expect(remapKeys).not.toHaveBeenCalled();
    expect(remapExerciseIds).not.toHaveBeenCalled();
  });

  it("still completes the import when the carry-over itself fails", async () => {
    const { exerciseId, oldKey } = changedIdentity();
    rows = [row(exerciseId, oldKey)];
    listElementErrors.mockRejectedValueOnce(new Error("storage down"));

    await openCollisionDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("import-lesson-overwrite"));
    });

    // The content still landed, and the failure is REPORTED rather than
    // swallowed or mistaken for a failed import.
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining("could not be carried over"),
    );
  });

  it("does not touch the SRS at all on the 'import as copy' branch", async () => {
    const { exerciseId, oldKey } = changedIdentity();
    rows = [row(exerciseId, oldKey)];

    await openCollisionDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("import-lesson-copy"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());

    expect(listElementErrors).not.toHaveBeenCalled();
    expect(getLesson).not.toHaveBeenCalled();
    expect(remapKeys).not.toHaveBeenCalled();
  });
});
