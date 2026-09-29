import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Onboarding from "./Onboarding";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
    const actual = await vi.importActual<typeof import("react-router")>(
        "react-router",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();
vi.mock("../../utils/notify", () => ({
    notify: {
        error: (msg: string) => toastError(msg),
        success: (msg: string) => toastSuccess(msg),
        warning: (msg: string) => toastWarning(msg),
        info: vi.fn(),
    },
}));

// Controllable storage double — the restore flow only touches
// subjects.list (onboarding's existing effect), the empty-install
// probes (users.findMostRecent / users.projects.list /
// lessonProgress.list) and backup.import.
const findMostRecent = vi.fn();
const projectsList = vi.fn();
const lessonProgressList = vi.fn();
const backupImport = vi.fn();
// The #1085 migration welcome is gated on ``getStorage().mode``; hoisted so
// the mock factory (which vitest lifts above the imports) can read it, and
// mutable so one test file covers both worlds (#3226).
const storageState = vi.hoisted(() => ({mode: "dexie" as "api" | "dexie"}));

vi.mock("../../storage", () => ({
    getStorage: () => ({
        mode: storageState.mode,
        subjects: {list: () => Promise.resolve([])},
        users: {
            findMostRecent: () => findMostRecent(),
            projects: {list: (uid: string) => projectsList(uid)},
        },
        lessonProgress: {list: (uid: string) => lessonProgressList(uid)},
        backup: {import: (uid: string, payload: unknown) => backupImport(uid, payload)},
    }),
    resolveStorageMode: () => "dexie",
}));

function validBackup() {
    return {
        format: "adaptive-learner-backup",
        version: "1.3.0",
        created_at: "2026-06-09T00:00:00Z",
        user_id: "user-9",
        storage_mode: "dexie",
        data: {
            users: [{id: "user-9", language: "fr"}],
            learning_projects: [{id: "proj-9", user_id: "user-9", active: true}],
        },
        stats: {total_records: 2, tables: {}},
    };
}

function backupFile(payload: unknown): File {
    return new File([JSON.stringify(payload)], "backup.json", {
        type: "application/json",
    });
}

function renderOnboarding() {
    return render(
        <MemoryRouter>
            <Onboarding />
        </MemoryRouter>,
    );
}

describe("Onboarding — first-run restore (#150)", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        toastError.mockReset();
        toastSuccess.mockReset();
        toastWarning.mockReset();
        findMostRecent.mockReset();
        projectsList.mockReset();
        lessonProgressList.mockReset();
        backupImport.mockReset();
        localStorage.clear();
        storageState.mode = "dexie";
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("shows the restore affordance on an empty install", async () => {
        findMostRecent.mockResolvedValue(null);
        renderOnboarding();
        await screen.findByTestId("onboarding-restore-backup");
    });

    it("hides the restore affordance when the user already has projects", async () => {
        localStorage.setItem("adaptive-learner.user_id", "user-1");
        projectsList.mockResolvedValue([{id: "proj-1"}]);
        lessonProgressList.mockResolvedValue([]);
        renderOnboarding();
        // Let the empty-install probe settle.
        await waitFor(() => expect(projectsList).toHaveBeenCalled());
        expect(screen.queryByTestId("onboarding-restore-backup")).toBeNull();
    });

    it("adopts the backup identity, imports, and routes to the dashboard", async () => {
        findMostRecent.mockResolvedValue(null);
        backupImport.mockResolvedValue({
            inserted: 5,
            updated: 0,
            skipped: 0,
            errors: [],
        });

        renderOnboarding();
        await screen.findByTestId("onboarding-restore-backup");

        const input = screen.getByTestId(
            "onboarding-restore-input",
        ) as HTMLInputElement;
        fireEvent.change(input, {target: {files: [backupFile(validBackup())]}});

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
                replace: true,
            }),
        );
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("user-9");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe("proj-9");
        expect(localStorage.getItem("adaptive-learner.language")).toBe("fr");
        expect(backupImport).toHaveBeenCalledWith(
            "user-9",
            expect.objectContaining({user_id: "user-9"}),
        );
        expect(toastSuccess).toHaveBeenCalled();
    });

    describe("migration welcome verdict on the page root (#3226)", () => {
        it("reports pending until the empty-install probe settled, then none in Dexie mode", async () => {
            let resolveProbe: (value: null) => void = () => {};
            findMostRecent.mockReturnValue(
                new Promise<null>((resolve) => {
                    resolveProbe = resolve;
                }),
            );
            renderOnboarding();
            expect(screen.getByTestId("onboarding")).toHaveAttribute(
                "data-migration-offer",
                "pending",
            );
            resolveProbe(null);
            await waitFor(() =>
                expect(screen.getByTestId("onboarding")).toHaveAttribute(
                    "data-migration-offer",
                    "none",
                ),
            );
            expect(screen.queryByTestId("migration-start-fresh")).toBeNull();
        });

        it("reports shown on a fresh API-mode install, and the dialog is open", async () => {
            storageState.mode = "api";
            findMostRecent.mockResolvedValue(null);
            renderOnboarding();
            await waitFor(() =>
                expect(screen.getByTestId("onboarding")).toHaveAttribute(
                    "data-migration-offer",
                    "shown",
                ),
            );
            expect(screen.getByTestId("migration-start-fresh")).toBeInTheDocument();
        });

        it("reports none on a seeded API-mode install", async () => {
            storageState.mode = "api";
            localStorage.setItem("adaptive-learner.user_id", "user-1");
            projectsList.mockResolvedValue([{id: "proj-1"}]);
            lessonProgressList.mockResolvedValue([]);
            renderOnboarding();
            await waitFor(() =>
                expect(screen.getByTestId("onboarding")).toHaveAttribute(
                    "data-migration-offer",
                    "none",
                ),
            );
            expect(screen.queryByTestId("migration-start-fresh")).toBeNull();
        });

        it("flips from shown to none once the learner starts fresh", async () => {
            storageState.mode = "api";
            findMostRecent.mockResolvedValue(null);
            renderOnboarding();
            const startFresh = await screen.findByTestId("migration-start-fresh");
            fireEvent.click(startFresh);
            await waitFor(() =>
                expect(screen.getByTestId("onboarding")).toHaveAttribute(
                    "data-migration-offer",
                    "none",
                ),
            );
        });

        it("settles instead of staying pending when the probe fails (fails open to shown)", async () => {
            // isEmptyInstall treats a failed probe as an empty install (the
            // restore affordance must not vanish on a storage hiccup), so
            // the verdict is "shown"; what matters here is that it is no
            // longer "pending".
            storageState.mode = "api";
            findMostRecent.mockRejectedValue(new Error("storage not wired"));
            renderOnboarding();
            await waitFor(() =>
                expect(screen.getByTestId("onboarding")).toHaveAttribute(
                    "data-migration-offer",
                    "shown",
                ),
            );
        });
    });

    it("declines a non-Adaptive-Learner file with a gentle warning, not an error (#640)", async () => {
        findMostRecent.mockResolvedValue(null);
        renderOnboarding();
        await screen.findByTestId("onboarding-restore-backup");

        const input = screen.getByTestId(
            "onboarding-restore-input",
        ) as HTMLInputElement;
        // A backup from another app: valid JSON, but the ``format`` marker
        // is not "adaptive-learner-backup".
        fireEvent.change(input, {
            target: {files: [backupFile({format: "something-else"})]},
        });

        // Warning (no "Report Issue"), NOT an error toast.
        await waitFor(() => expect(toastWarning).toHaveBeenCalled());
        expect(toastError).not.toHaveBeenCalled();
        expect(backupImport).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(localStorage.getItem("adaptive-learner.user_id")).toBeNull();
    });

    it("declines a non-JSON file with a gentle warning, not an error (#640)", async () => {
        findMostRecent.mockResolvedValue(null);
        renderOnboarding();
        await screen.findByTestId("onboarding-restore-backup");

        const input = screen.getByTestId(
            "onboarding-restore-input",
        ) as HTMLInputElement;
        const notJson = new File(["this is not json {"], "notes.txt", {
            type: "text/plain",
        });
        fireEvent.change(input, {target: {files: [notJson]}});

        await waitFor(() => expect(toastWarning).toHaveBeenCalled());
        expect(toastError).not.toHaveBeenCalled();
        expect(backupImport).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
