import {afterEach, beforeEach, describe, it, expect, vi} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import SetRow from "./SetRow";
import {setDevModeEnabled} from "../../hooks/settings/useDevMode";
import {getBuildInfo} from "../../lib/provenance/build-info";
import type {
    PersonalPathLesson,
    PersonalPathSet,
} from "../../lib/learning-path/personal-path";

vi.mock("../../lib/provenance/build-info", () => ({
    getBuildInfo: vi.fn(() => ({strang: "unknown"})),
}));

const mockedGetBuildInfo = vi.mocked(getBuildInfo);

function setStrang(strang: "latest" | "haupt" | "unknown") {
    mockedGetBuildInfo.mockReturnValue({strang} as ReturnType<
        typeof getBuildInfo
    >);
}

function lesson(
    n: number,
    overrides: Partial<PersonalPathLesson> = {},
): PersonalPathLesson {
    return {
        source: "src",
        setId: "psych",
        filename: `0${n}.json`,
        number: n,
        title: `Lesson ${n}`,
        stars: 3,
        status: "completed",
        dot: "done",
        receptive: "na",
        productive: "na",
        lastActivity: "2026-06-01T10:00:00Z",
        isCurrent: false,
        ...overrides,
    };
}

function setFixture(overrides: Partial<PersonalPathSet> = {}): PersonalPathSet {
    return {
        source: "src",
        setId: "psych",
        title: "Psychologie",
        titleNative: null,
        domain: "psychology",
        sourceLanguage: "de",
        targetLanguage: "de",
        level: "a1",
        lessons: [
            lesson(1, {dot: "done"}),
            lesson(2, {dot: "in_progress", status: "in_progress"}),
            lesson(3, {dot: "not_started", status: "not_started"}),
        ],
        completedCount: 1,
        totalCount: 3,
        percentComplete: 33,
        lastActivity: "2026-06-01T10:00:00Z",
        downloadedAt: null,
        currentLesson: lesson(2, {
            dot: "in_progress",
            status: "in_progress",
            isCurrent: true,
        }),
        mode: "resume",
        errorCount: 0,
        nextLevel: null,
        ...overrides,
    };
}

function renderRow(set: PersonalPathSet, isExpanded = false, onToggle = vi.fn()) {
    return render(
        <MemoryRouter>
            <SetRow set={set} isExpanded={isExpanded} onToggle={onToggle}>
                <div data-testid="detail">expanded detail</div>
            </SetRow>
        </MemoryRouter>,
    );
}

describe("SetRow", () => {
    beforeEach(() => {
        setStrang("unknown");
    });

    it("renders the percentage and one dot per lesson", () => {
        renderRow(setFixture());
        expect(screen.getByTestId("set-percent-psych")).toHaveTextContent(
            "33%",
        );
        const dots = screen
            .getByTestId("set-track-psych")
            .querySelectorAll("[data-dot]");
        expect(dots).toHaveLength(3);
        expect(dots[0].getAttribute("data-dot")).toBe("done");
        expect(dots[1].getAttribute("data-dot")).toBe("in_progress");
        expect(dots[2].getAttribute("data-dot")).toBe("not_started");
    });

    it("renders a resume action linking to the current lesson", () => {
        renderRow(setFixture());
        const action = screen.getByTestId("set-action-psych");
        expect(action.getAttribute("data-mode")).toBe("resume");
        expect(action).toHaveAttribute("href", "/lesson/src/psych/02.json");
    });

    it("marks the bg-accent action link with data-slot=button (#779)", () => {
        // The action is a router <a> styled bg-accent/text-accent-fg. Without
        // data-slot="button" the global ``a:not([data-slot=button])`` rule
        // forces color:var(--accent) over text-accent-fg -> accent-on-accent
        // (invisible label) in every theme. Pin the carve-out.
        renderRow(setFixture());
        expect(screen.getByTestId("set-action-psych")).toHaveAttribute(
            "data-slot",
            "button",
        );
    });

    it("marks the next-level action link with data-slot=button (#779)", () => {
        renderRow(
            setFixture({
                mode: "set_complete",
                percentComplete: 100,
                currentLesson: null,
                nextLevel: {
                    source: "src",
                    setId: "psych-a2",
                    title: "Psychologie A2",
                    level: "a2",
                    downloaded: true,
                },
            }),
        );
        const action = screen.getByTestId("set-action-psych");
        expect(action.getAttribute("data-mode")).toBe("next_level");
        expect(action).toHaveAttribute("data-slot", "button");
    });

    it("renders a start action for an untouched set", () => {
        renderRow(
            setFixture({
                mode: "start",
                percentComplete: 0,
                currentLesson: lesson(1, {status: "not_started", isCurrent: true}),
                lessons: [lesson(1, {dot: "not_started", status: "not_started"})],
                completedCount: 0,
                lastActivity: null,
            }),
        );
        expect(screen.getByTestId("set-action-psych").getAttribute("data-mode")).toBe(
            "start",
        );
    });

    it("shows a completed state with no next level", () => {
        renderRow(
            setFixture({
                mode: "set_complete",
                percentComplete: 100,
                currentLesson: null,
                nextLevel: null,
            }),
        );
        const action = screen.getByTestId("set-action-psych");
        expect(action.getAttribute("data-mode")).toBe("completed");
    });

    it("offers the next level when one exists", () => {
        renderRow(
            setFixture({
                mode: "set_complete",
                percentComplete: 100,
                currentLesson: null,
                nextLevel: {
                    source: "src",
                    setId: "psych-a2",
                    title: "Psychologie A2",
                    level: "a2",
                    downloaded: false,
                },
            }),
        );
        const action = screen.getByTestId("set-action-psych");
        expect(action.getAttribute("data-mode")).toBe("next_level");
        expect(action).toHaveAttribute("href", "/content");
    });

    // ZUSATZ (#1211 follow-up) — Dev-Mode-only download-date readout, a
    // built-in on-device check that ``downloaded_at`` actually reaches the
    // Persönlich list. Must never leak to normal users.
    describe("Dev-Mode download-date readout", () => {
        afterEach(() => setDevModeEnabled(false));

        it("shows downloaded_at when Dev Mode is ON", () => {
            setDevModeEnabled(true);
            renderRow(
                setFixture({downloadedAt: "2026-06-20T00:00:00.000Z"}),
            );
            const el = screen.getByTestId("set-downloaded-at-psych");
            expect(el).toHaveTextContent("downloaded_at: 2026-06-20T00:00:00.000Z");
        });

        it("renders 'null' when downloaded_at is missing (the diagnostic signal)", () => {
            setDevModeEnabled(true);
            renderRow(setFixture({downloadedAt: null}));
            expect(
                screen.getByTestId("set-downloaded-at-psych"),
            ).toHaveTextContent("downloaded_at: null");
        });

        it("does NOT show downloaded_at when Dev Mode is OFF (no leak)", () => {
            setDevModeEnabled(false);
            renderRow(
                setFixture({downloadedAt: "2026-06-20T00:00:00.000Z"}),
            );
            expect(
                screen.queryByTestId("set-downloaded-at-psych"),
            ).toBeNull();
        });

        // #1271 — the readout follows the environment default when the user
        // made no explicit choice: visible per default in Staging (Latest),
        // hidden per default in Production (Haupt).
        it("shows downloaded_at per default in the Latest strand (no explicit choice)", () => {
            localStorage.clear();
            setStrang("latest");
            renderRow(
                setFixture({downloadedAt: "2026-06-20T00:00:00.000Z"}),
            );
            expect(
                screen.getByTestId("set-downloaded-at-psych"),
            ).toHaveTextContent("downloaded_at: 2026-06-20T00:00:00.000Z");
        });

        it("hides downloaded_at per default in the Haupt strand (no explicit choice)", () => {
            localStorage.clear();
            setStrang("haupt");
            renderRow(
                setFixture({downloadedAt: "2026-06-20T00:00:00.000Z"}),
            );
            expect(
                screen.queryByTestId("set-downloaded-at-psych"),
            ).toBeNull();
        });
    });

    it("toggles on row click and reveals children when expanded", () => {
        const onToggle = vi.fn();
        const {rerender} = renderRow(setFixture(), false, onToggle);
        fireEvent.click(screen.getByTestId("set-toggle-psych"));
        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("detail")).toBeNull();
        rerender(
            <MemoryRouter>
                <SetRow set={setFixture()} isExpanded onToggle={onToggle}>
                    <div data-testid="detail">expanded detail</div>
                </SetRow>
            </MemoryRouter>,
        );
        expect(screen.getByTestId("detail")).toBeInTheDocument();
        expect(screen.getByTestId("set-toggle-psych")).toHaveAttribute(
            "aria-expanded",
            "true",
        );
    });
});
