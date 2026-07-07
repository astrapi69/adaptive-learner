/**
 * DashboardOverviewTab structure tests (#1417).
 *
 * Pins the architect's placement decision: the AI invitation card
 * renders BELOW the "Weitermachen" (Continue Learning) section —
 * for a fresh learner "start your first lesson" is the primary
 * message, the AI invite is secondary. Also pins that no
 * warning-styled API-key notice renders anywhere on the tab.
 */

import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import DashboardOverviewTab from "./DashboardOverviewTab";

// Sibling cards stub out their storage reads — this test is about the
// tab's ordering, each card has its own dedicated tests.
vi.mock("../../components/dashboard/ContinueLearning", () => ({
    default: () => <div data-testid="continue-learning" />,
}));
vi.mock("../../components/dashboard/ReviewQueueCard", () => ({
    default: () => <div data-testid="review-queue-card" />,
}));
vi.mock("../../components/dashboard/PausedLessonsCard", () => ({
    default: () => <div data-testid="paused-lessons-card" />,
}));
vi.mock("../../components/dashboard/FocusAreasCard", () => ({
    default: () => <div data-testid="focus-areas-card" />,
}));
vi.mock("../../components/dashboard/FavoritesCard", () => ({
    default: () => <div data-testid="favorites-card" />,
}));
vi.mock("../../components/gamification/XPWidget", () => ({
    default: () => <div data-testid="xp-widget" />,
}));
vi.mock("../../components/gamification/StreakWidget", () => ({
    default: () => <div data-testid="streak-widget" />,
}));

const mockStatus = {
    ready: true,
    hasKey: false,
    activeProvider: null,
    refresh: vi.fn(),
};
vi.mock("../../hooks/settings/useApiKeyStatus", () => ({
    useApiKeyStatus: () => ({...mockStatus}),
}));

function renderTab() {
    return render(
        <MemoryRouter>
            <DashboardOverviewTab userId="u-1" xpState={null} streakState={null} />
        </MemoryRouter>,
    );
}

describe("DashboardOverviewTab", () => {
    beforeEach(() => {
        localStorage.clear();
        mockStatus.ready = true;
        mockStatus.hasKey = false;
    });

    it("renders the AI invite card BELOW the Weitermachen section", () => {
        renderTab();
        const continueLearning = screen.getByTestId("continue-learning");
        const invite = screen.getByTestId("ai-invite-card");
        const followsWeitermachen = !!(
            continueLearning.compareDocumentPosition(invite) &
            Node.DOCUMENT_POSITION_FOLLOWING
        );
        expect(followsWeitermachen).toBe(true);
    });

    it("renders no warning-styled API-key notice anywhere on the tab", () => {
        const {container} = renderTab();
        expect(screen.queryByTestId("api-key-required-notice")).not.toBeInTheDocument();
        expect(screen.queryByTestId("api-key-skip-banner")).not.toBeInTheDocument();
        expect(
            container.querySelector(
                ".api-key-required-notice, .api-key-required-compact, .api-key-skip-banner",
            ),
        ).toBeNull();
    });
});
