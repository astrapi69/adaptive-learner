/**
 * Onboarding taxonomy-integration tests (Phase 22F).
 *
 * Exercises Onboarding's Subject suggestion + Tag input flow
 * end-to-end against the dexie storage backing (fake-indexeddb),
 * so the real
 * ``getStorage().subjects.list()`` + ``projectTaxonomy.assign*``
 * code path is covered.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import Onboarding from "./Onboarding";
import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests} from "../storage/db";
import {_resetStorageCacheForTests, getStorage} from "../storage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

beforeEach(async () => {
    localStorage.setItem("adaptive-learner.storage_mode", "dexie");
    _resetStorageCacheForTests();
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
    mockNavigate.mockClear();
});

afterEach(async () => {
    await _resetDbForTests();
    localStorage.clear();
});

function renderOnboarding() {
    return render(
        <I18nProvider>
            <MemoryRouter>
                <Onboarding />
            </MemoryRouter>
        </I18nProvider>,
    );
}

function fillFormFields(topic: string) {
    // Quick-start only takes name + topic (#92); the rest is the
    // optional post-creation wizard.
    fireEvent.change(screen.getByTestId("onboarding-name"), {
        target: {value: "Aster"},
    });
    fireEvent.change(screen.getByTestId("onboarding-topic"), {
        target: {value: topic},
    });
}

async function seedSubjectTree() {
    const storage = getStorage();
    const lang = await storage.subjects.create({name: "Languages"});
    const spanish = await storage.subjects.create({
        name: "Spanish",
        parent_id: lang.id,
    });
    const grammar = await storage.subjects.create({
        name: "Grammar",
        parent_id: spanish.id,
    });
    return {lang, spanish, grammar};
}

describe("Onboarding taxonomy integration", () => {
    it("renders no suggestion chips when topic is empty", async () => {
        await seedSubjectTree();
        renderOnboarding();
        // Wait for the form to mount + the subjects.list() effect.
        await screen.findByTestId("onboarding-topic");
        expect(
            screen.queryByTestId("onboarding-subject-suggestions"),
        ).toBeNull();
    });

    it("suggests matching subjects when topic typed", async () => {
        const {grammar} = await seedSubjectTree();
        renderOnboarding();
        await screen.findByTestId("onboarding-topic");
        fireEvent.change(screen.getByTestId("onboarding-topic"), {
            target: {value: "Spanish Grammar"},
        });
        const chip = await screen.findByTestId(
            `onboarding-subject-suggestion-${grammar.id}`,
        );
        expect(chip).toBeInTheDocument();
    });

    it("submitting assigns the picked subject and lands on the invite screen", async () => {
        const {grammar} = await seedSubjectTree();
        renderOnboarding();
        await screen.findByTestId("onboarding-topic");
        fillFormFields("Spanish Grammar");

        // Pick the suggested subject.
        const chip = await screen.findByTestId(
            `onboarding-subject-suggestion-${grammar.id}`,
        );
        fireEvent.click(chip);

        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-submit"));
        });

        // Quick-start lands on the optional-profile invitation (#94),
        // not straight on /assessment.
        await screen.findByTestId("onboarding-invite");
        expect(mockNavigate).not.toHaveBeenCalled();

        const projectId = localStorage.getItem("adaptive-learner.project_id");
        const userId = localStorage.getItem("adaptive-learner.user_id");
        expect(projectId).toBeTruthy();
        expect(userId).toBeTruthy();

        const assignedSubjects = await getStorage().projectTaxonomy.listSubjects(
            projectId!,
        );
        expect(assignedSubjects.map((s) => s.id)).toEqual([grammar.id]);
    });

    it("submission still works when no subject is picked", async () => {
        await seedSubjectTree();
        renderOnboarding();
        await screen.findByTestId("onboarding-topic");
        fillFormFields("Underwater Basket Weaving");

        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-submit"));
        });

        await screen.findByTestId("onboarding-invite");

        const projectId = localStorage.getItem("adaptive-learner.project_id");
        const assignedSubjects = await getStorage().projectTaxonomy.listSubjects(
            projectId!,
        );
        expect(assignedSubjects).toEqual([]);
    });
});
