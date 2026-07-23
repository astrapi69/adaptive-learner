/**
 * #1855 wiring pin — the Create-Lesson wizard must pass LOCALIZED
 * templates into ``generateExercises``. Pre-fix, the call site omitted
 * ``opts.prompts``, so the English ``DEFAULT_EXERCISE_PROMPTS`` burned
 * into every generated lesson regardless of the UI language.
 *
 * ``useI18n`` is mocked with a ``t`` backed by the REAL bundled de
 * catalog, then the wizard is walked to step 3 and the generated
 * exercise list is asserted to carry the German instructions (with the
 * untranslated foreign-language card front in the placeholder).
 */

import "@testing-library/jest-dom/vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";

import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
    ...(await orig<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            saveUserSet: vi.fn(),
            listLessons: vi.fn(),
            getLesson: vi.fn(),
            listSets: vi.fn(async () => ({sets: []})),
        },
    }),
}));
vi.mock("../../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

const deCatalog = JSON.parse(
    readFileSync(join(__dirname, "../../data/i18n/de.json"), "utf-8"),
) as Record<string, unknown>;

/** Dotted-path resolver mirroring the production ``t`` walk. */
function tDe(key: string, fallback?: string): string {
    let cursor: unknown = deCatalog;
    for (const part of key.split(".")) {
        if (
            cursor &&
            typeof cursor === "object" &&
            part in (cursor as Record<string, unknown>)
        ) {
            cursor = (cursor as Record<string, unknown>)[part];
        } else {
            return fallback ?? key;
        }
    }
    return typeof cursor === "string" ? cursor : (fallback ?? key);
}

vi.mock("../../hooks/ui/useI18n", async (orig) => ({
    ...(await orig<typeof import("../../hooks/ui/useI18n")>()),
    useI18n: () => ({t: tDe, lang: "de", setLang: () => {}}),
}));

import CreateLesson from "./CreateLesson";

function addCard(front: string, back: string) {
    fireEvent.change(screen.getByTestId("card-front-input"), {
        target: {value: front},
    });
    fireEvent.change(screen.getByTestId("card-back-input"), {
        target: {value: back},
    });
    fireEvent.click(screen.getByTestId("card-add-button"));
}

beforeEach(() => {
    navigateMock.mockReset();
    localStorage.clear();
});

describe("CreateLesson — generated instructions localize to the UI language (#1855)", () => {
    it("generates German matching / free-text instructions for a de-locale user", () => {
        render(
            <MemoryRouter initialEntries={["/create-lesson"]}>
                <CreateLesson />
            </MemoryRouter>,
        );
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Französisch Basics"},
        });
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 2
        addCard("Bonjour", "Hallo");
        addCard("Salut", "Hi");
        addCard("Bonsoir", "Guten Abend");
        addCard("Merci", "Danke");
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 3
        fireEvent.click(screen.getByTestId("exercise-generate"));

        const step3 = screen.getByTestId("create-lesson-step-3");
        // German instruction template, foreign-language card front intact.
        // (The matching row renders a pair count instead of its prompt, so
        // the free-text rows are the visible template surface here; the
        // matching template is pinned in exercise-prompts.test.ts.)
        expect(step3.textContent).toContain("Übersetze: Bonjour");
        expect(step3.textContent).toContain("Übersetze: Salut");
        // The pre-fix English defaults must be gone.
        expect(step3.textContent).not.toContain("Translate: Bonjour");
    });
});
