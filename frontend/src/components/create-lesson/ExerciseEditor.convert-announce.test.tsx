/**
 * Announcement gate for a key-MOVING conversion (EXP-050 Stage 2, #2511).
 *
 * A conversion that strands review history (a multi-blank cloze folding to one
 * free-text answer) must ask before applying; a key-preserving one applies
 * silently. ``useConfirm`` is mocked here so the promise resolution is
 * controllable and assertable — the pure key check lives in
 * ``exercise-convert.test.ts``.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const {confirmMock} = vi.hoisted(() => ({confirmMock: vi.fn()}));
vi.mock("../../contexts/ConfirmContext", () => ({
    useConfirm: () => confirmMock,
}));

import ExerciseEditor from "./ExerciseEditor";
import type {ContentLessonExercise} from "../../storage/types";

function Harness({exercise}: {exercise: ContentLessonExercise}) {
    const [ex, setEx] = useState(exercise);
    const [saved, setSaved] = useState<ContentLessonExercise | null>(null);
    if (saved) return <div data-testid="saved-json">{JSON.stringify(saved)}</div>;
    return (
        <ExerciseEditor
            exercise={ex}
            onSave={(u) => {
                setEx(u);
                setSaved(u);
            }}
            onCancel={vi.fn()}
        />
    );
}

const clozeSingle = (): ContentLessonExercise =>
    ({
        id: "cz1",
        type: "cloze",
        prompt: "Fill the blank",
        card_ids: [],
        distractors: [],
        sentence: "Je ___ ici",
        cloze_mode: "select",
        blanks: [{accept: ["suis"]}],
    }) as ContentLessonExercise;

const clozeMulti = (): ContentLessonExercise =>
    ({
        id: "cz2",
        type: "cloze",
        prompt: "Fill the blanks",
        card_ids: [],
        distractors: [],
        sentence: "Je ___ ___ ici",
        cloze_mode: "type",
        blanks: [{accept: ["suis"]}, {accept: ["vraiment"]}],
    }) as ContentLessonExercise;

beforeEach(() => confirmMock.mockReset());

describe("ExerciseEditor — key-moving conversion announcement", () => {
    it("converts a single-blank cloze silently (key preserved, no confirm)", async () => {
        confirmMock.mockResolvedValue(true);
        render(<Harness exercise={clozeSingle()} />);
        fireEvent.change(screen.getByTestId("exercise-edit-type-select-cz1"), {
            target: {value: "free_text"},
        });
        expect(
            await screen.findByTestId("exercise-edit-accept-cz1-item-0"),
        ).toHaveTextContent("suis");
        expect(confirmMock).not.toHaveBeenCalled();
    });

    it("announces before a multi-blank cloze conversion and proceeds on confirm", async () => {
        confirmMock.mockResolvedValue(true);
        render(<Harness exercise={clozeMulti()} />);
        fireEvent.change(screen.getByTestId("exercise-edit-type-select-cz2"), {
            target: {value: "free_text"},
        });
        expect(
            await screen.findByTestId("exercise-edit-accept-cz2-item-0"),
        ).toHaveTextContent("suis");
        expect(confirmMock).toHaveBeenCalledTimes(1);
    });

    it("keeps the cloze unchanged when the announcement is declined", async () => {
        confirmMock.mockResolvedValue(false);
        render(<Harness exercise={clozeMulti()} />);
        fireEvent.change(screen.getByTestId("exercise-edit-type-select-cz2"), {
            target: {value: "free_text"},
        });
        await vi.waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
        expect(
            screen.getByTestId("exercise-edit-type-select-cz2"),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("exercise-edit-accept-cz2-item-0")).toBeNull();
    });
});
