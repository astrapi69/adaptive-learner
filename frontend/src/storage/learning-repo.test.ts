/**
 * Tests for the learningRepo namespace (Phase 49E / v1.32.0
 * / PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Covers:
 *
 * - ApiStorage delegates render + exportZip to
 *   ``api.learningRepo.*`` (fetch-stub, verifies URL +
 *   method + body propagation).
 * - DexieStorage's render hooks up loadDexieContext +
 *   renderRepository into the shape the LearningRepo page
 *   consumes (project_id, language, rendered_at, files).
 * - DexieStorage's exportZip pack-and-returns a Blob whose
 *   contents include the rendered tree (verified by reading
 *   the ZIP back via JSZip).
 * - 404 propagation in both modes (matching the backend
 *   404 semantics).
 *
 * The git-persist endpoint is NOT in the namespace and is
 * intentionally not exercised here.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {ApiError} from "../api/client";

import {apiStorage} from "./api/api-storage";
import {_resetDbForTests, getDb} from "./db/db";
import {dexieStorage} from "./db/dexie-storage";

const PROJECT_ID = "proj-1";
const USER_ID = "user-1";

beforeEach(async () => {
    const db = getDb();
    try {
        await Promise.all([
            db.learningProjects.clear(),
            db.learningSessions.clear(),
            db.sessionRatings.clear(),
            db.stepEvaluations.clear(),
            db.methodSwitches.clear(),
            db.sessionNotes.clear(),
        ]);
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function seedProject() {
    const db = getDb();
    await db.learningProjects.add({
        id: PROJECT_ID,
        user_id: USER_ID,
        topic: "Spanish",
        goal: "Conversational fluency",
        timeframe: "3 months",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        kind: "standard",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    });
}

// --- ApiStorage delegation --------------------------------------------

describe("apiStorage.learningRepo", () => {
    it("render delegates to /api/plugins/learning-repo/render", async () => {
        const mockResponse = {
            project_id: PROJECT_ID,
            language: "en",
            rendered_at: "2026-05-27T12:00:00Z",
            files: {"README.md": "# Spanish\n"},
        };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await apiStorage.learningRepo.render(PROJECT_ID);

        expect(result).toEqual(mockResponse);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url] = fetchMock.mock.calls[0];
        expect(url).toContain(
            `/api/plugins/learning-repo/render/${PROJECT_ID}`,
        );
    });

    it("render forwards the language query param when provided", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                project_id: PROJECT_ID,
                language: "de",
                rendered_at: "2026-05-27T12:00:00Z",
                files: {},
            }),
        });
        vi.stubGlobal("fetch", fetchMock);

        await apiStorage.learningRepo.render(PROJECT_ID, "de");

        const [url] = fetchMock.mock.calls[0];
        expect(url).toContain("language=de");
    });

    it("exportZip delegates with POST + returns a Blob", async () => {
        const expectedBlob = new Blob(["fake zip bytes"], {
            type: "application/zip",
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            blob: async () => expectedBlob,
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await apiStorage.learningRepo.exportZip(PROJECT_ID);

        expect(result).toBe(expectedBlob);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain(
            `/api/plugins/learning-repo/export-zip/${PROJECT_ID}`,
        );
        expect(init.method).toBe("POST");
    });

    it("render propagates 404 as ApiError", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({detail: "Project not found"}),
        });
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            apiStorage.learningRepo.render("nope"),
        ).rejects.toBeInstanceOf(ApiError);
        await expect(
            apiStorage.learningRepo.render("nope"),
        ).rejects.toMatchObject({status: 404});
    });
});

// --- DexieStorage render ----------------------------------------------

describe("dexieStorage.learningRepo.render", () => {
    it("propagates ApiError(404) when the project doesn't exist", async () => {
        await expect(
            dexieStorage.learningRepo.render("no-such-project"),
        ).rejects.toBeInstanceOf(ApiError);
        await expect(
            dexieStorage.learningRepo.render("no-such-project"),
        ).rejects.toMatchObject({status: 404});
    });

    it("returns the {project_id, language, rendered_at, files} shape", async () => {
        await seedProject();
        const result = await dexieStorage.learningRepo.render(
            PROJECT_ID,
            "en",
        );
        expect(result.project_id).toBe(PROJECT_ID);
        expect(result.language).toBe("en");
        expect(typeof result.rendered_at).toBe("string");
        // Must contain the 4 meta-files.
        expect(Object.keys(result.files).sort()).toEqual([
            "CHEATSHEET.md",
            "LEARNING_STATS.md",
            "README.md",
            "ROADMAP.md",
        ]);
    });

    it("renders the project topic into the README title", async () => {
        await seedProject();
        const result = await dexieStorage.learningRepo.render(PROJECT_ID);
        expect(result.files["README.md"]).toContain(
            "# Learning Project: Spanish",
        );
    });

    it("defaults language to 'en' when omitted", async () => {
        await seedProject();
        const result = await dexieStorage.learningRepo.render(PROJECT_ID);
        expect(result.language).toBe("en");
    });

    it("forwards a non-default language to the renderer", async () => {
        await seedProject();
        const result = await dexieStorage.learningRepo.render(
            PROJECT_ID,
            "de",
        );
        expect(result.language).toBe("de");
        // README still mentions the topic regardless of
        // language — the label format is "Lernprojekt:
        // {topic}" or similar in DE.
        expect(result.files["README.md"]).toContain("Spanish");
    });
});

// --- DexieStorage exportZip -------------------------------------------

describe("dexieStorage.learningRepo.exportZip", () => {
    it("returns a Blob with non-zero size", async () => {
        await seedProject();
        const blob = await dexieStorage.learningRepo.exportZip(PROJECT_ID);
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);
    });

    it("ZIP unpacks to the same 4 meta-files render() produces", async () => {
        await seedProject();
        const blob = await dexieStorage.learningRepo.exportZip(PROJECT_ID);
        // Read the Blob back through JSZip to verify the
        // archive contents. The dynamic import is the same
        // module the implementation uses.
        const JSZipMod = (await import("jszip")).default;
        const zip = await JSZipMod.loadAsync(
            await blob.arrayBuffer(),
        );
        const paths = Object.keys(zip.files).sort();
        expect(paths).toEqual([
            "CHEATSHEET.md",
            "LEARNING_STATS.md",
            "README.md",
            "ROADMAP.md",
        ]);
        const readme = await zip.files["README.md"].async("string");
        expect(readme).toContain("# Learning Project: Spanish");
    });

    it("propagates 404 for missing project", async () => {
        await expect(
            dexieStorage.learningRepo.exportZip("no-such-project"),
        ).rejects.toBeInstanceOf(ApiError);
    });
});
