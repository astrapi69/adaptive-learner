/**
 * Tests for MilestoneHost (EXP-008 / Phase 55D).
 *
 * Pins:
 *  - a queued milestone appears after the inter-item gap and
 *    auto-dismisses after the display window,
 *  - multiple milestones show sequentially (one at a time),
 *  - "subtle" intensity suppresses overlays entirely.
 */

import "@testing-library/jest-dom/vitest";
import {act, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import MilestoneHost from "./MilestoneHost";
import {
    clearMilestoneQueue,
    enqueueMilestone,
} from "../../lib/feedback/celebrationQueue";
import {setFeedbackIntensity} from "../../lib/feedback/feedbackPref";
import type {Milestone} from "../../lib/feedback/milestones";

const GAP = 500;
const DISMISS = 3000;

function streak(value: number): Milestone {
    return {id: `streak-${value}`, type: "streak", value};
}

function renderHost() {
    return render(
        <MemoryRouter>
            <MilestoneHost />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    clearMilestoneQueue();
});

afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
});

describe("MilestoneHost", () => {
    it("shows a queued milestone after the gap, then auto-dismisses", () => {
        setFeedbackIntensity("normal");
        renderHost();
        act(() => {
            enqueueMilestone(streak(7));
        });
        // Not shown until the gap elapses.
        expect(
            screen.queryByTestId("milestone-overlay"),
        ).not.toBeInTheDocument();
        act(() => {
            vi.advanceTimersByTime(GAP);
        });
        expect(screen.getByTestId("milestone-overlay")).toBeInTheDocument();
        expect(
            screen.getByTestId("milestone-overlay-title"),
        ).toHaveTextContent("7");
        // Auto-dismiss after the display window.
        act(() => {
            vi.advanceTimersByTime(DISMISS);
        });
        expect(
            screen.queryByTestId("milestone-overlay"),
        ).not.toBeInTheDocument();
    });

    it("shows multiple milestones sequentially", () => {
        setFeedbackIntensity("normal");
        renderHost();
        act(() => {
            enqueueMilestone(streak(7));
            enqueueMilestone(streak(30));
        });
        act(() => {
            vi.advanceTimersByTime(GAP);
        });
        expect(
            screen.getByTestId("milestone-overlay-title"),
        ).toHaveTextContent("7");
        // Dismiss the first, then the gap before the second.
        act(() => {
            vi.advanceTimersByTime(DISMISS);
        });
        act(() => {
            vi.advanceTimersByTime(GAP);
        });
        expect(
            screen.getByTestId("milestone-overlay-title"),
        ).toHaveTextContent("30");
    });

    it("suppresses overlays under subtle intensity", () => {
        setFeedbackIntensity("subtle");
        renderHost();
        act(() => {
            enqueueMilestone(streak(7));
        });
        act(() => {
            vi.advanceTimersByTime(GAP + DISMISS);
        });
        expect(
            screen.queryByTestId("milestone-overlay"),
        ).not.toBeInTheDocument();
    });
});
