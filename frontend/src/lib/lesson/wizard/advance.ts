/**
 * lesson/wizard/advance — the Create-Lesson "Next" decision as one pure
 * rule (#2773).
 *
 * ``CreateLesson``'s ``handleNext`` carried a four-flow guard cascade
 * (book / extension / cardless-edit / standard) at cc 20 — one eslint
 * oracle drift away from the gate. The decision is pure state-in,
 * verdict-out and lives here as a value table the page maps onto its
 * setters; the flows are pinned by tests instead of by reading the
 * component. The exercise predicates are INJECTED because their homes
 * (``components/create-lesson/ExerciseGenerator``, ``lib/exercises``)
 * must not be imported from ``lib/lesson`` — the page composes them.
 *
 * @example
 * ```ts
 * decideNextStep({step: 1, flow: "standard", metaValid: false, ...}, deps);
 * // -> {kind: "flag-title"}
 * ```
 */

/** Which authoring flow the wizard is in. */
export type WizardFlow = "book" | "extension" | "cardless-edit" | "standard";

/** Derive the active flow from the three mode flags. */
export function wizardFlowOf(
    bookMode: boolean,
    extMode: boolean,
    cardlessEdit: boolean,
): WizardFlow {
    if (bookMode) return "book";
    if (extMode) return "extension";
    if (cardlessEdit) return "cardless-edit";
    return "standard";
}

/** Everything the Next decision reads from wizard state. */
export interface AdvanceInput {
    step: number;
    flow: WizardFlow;
    /** Step-1 gate: the required title is present. */
    metaValid: boolean;
    /** Create-vs-edit: create-time minimums do not re-apply on edit. */
    editMode: boolean;
    /** Book flow: generated lessons present? */
    bookLessonCount: number;
    cardCount: number;
    /** Create-time card minimum (CardEditor's MIN_CARDS). */
    minCards: number;
    exerciseCount: number;
    /** Step cap of the active flow (3 for the compact flows, 4 standard). */
    totalSteps: number;
}

/** The exercise predicates, injected by the page (layering: their homes
 *  live above ``lib/lesson``). */
export interface AdvanceDeps {
    /** Minimum exercises to advance for the given edit-mode. */
    minExercisesToAdvance: (editMode: boolean) => number;
    /** Any exercise still half-filled? */
    hasIncompleteExercise: () => boolean;
    /** Extension flow: any ext exercise failing its payload validator? */
    hasInvalidExtensionExercise: () => boolean;
}

/** The verdict ``CreateLesson`` maps onto its state setters. */
export type AdvanceDecision =
    | {kind: "flag-title"}
    | {kind: "card-error"}
    | {kind: "exercise-error"}
    | {kind: "advance"; nextStep: number};

function bookGate(input: AdvanceInput): AdvanceDecision | null {
    if (input.step === 2 && input.bookLessonCount === 0) {
        return {kind: "exercise-error"};
    }
    return null;
}

function extensionGate(
    input: AdvanceInput,
    deps: AdvanceDeps,
): AdvanceDecision | null {
    if (input.step !== 2) return null;
    const invalid =
        input.exerciseCount === 0 || deps.hasInvalidExtensionExercise();
    return invalid ? {kind: "exercise-error"} : null;
}

function cardlessEditGate(
    input: AdvanceInput,
    deps: AdvanceDeps,
): AdvanceDecision | null {
    if (input.step !== 2) return null;
    const invalid =
        input.exerciseCount < deps.minExercisesToAdvance(true) ||
        deps.hasIncompleteExercise();
    return invalid ? {kind: "exercise-error"} : null;
}

function standardGate(
    input: AdvanceInput,
    deps: AdvanceDeps,
): AdvanceDecision | null {
    if (input.step === 2 && !input.editMode && input.cardCount < input.minCards) {
        return {kind: "card-error"};
    }
    if (
        input.step === 3 &&
        (input.exerciseCount < deps.minExercisesToAdvance(input.editMode) ||
            deps.hasIncompleteExercise())
    ) {
        return {kind: "exercise-error"};
    }
    return null;
}

const FLOW_GATES: Record<
    WizardFlow,
    (input: AdvanceInput, deps: AdvanceDeps) => AdvanceDecision | null
> = {
    book: bookGate,
    extension: extensionGate,
    "cardless-edit": cardlessEditGate,
    standard: standardGate,
};

/**
 * Decide what pressing "Next" does: flag the missing title (step 1),
 * surface the active flow's step gate, or advance capped at the flow's
 * step count.
 */
export function decideNextStep(
    input: AdvanceInput,
    deps: AdvanceDeps,
): AdvanceDecision {
    if (input.step === 1 && !input.metaValid) return {kind: "flag-title"};
    const gate = FLOW_GATES[input.flow](input, deps);
    if (gate) return gate;
    return {kind: "advance", nextStep: Math.min(input.totalSteps, input.step + 1)};
}
