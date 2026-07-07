/**
 * AiInviteCard unit tests (#1417).
 *
 * The card replaces the pre-#1417 Dashboard pair of API-key
 * messages (blue skip banner + yellow ApiKeyRequiredNotice)
 * with ONE inviting, dismissible, info-styled card. These
 * tests pin:
 *
 *   - render gates (no key -> card; key / not-ready -> nothing)
 *   - persistent dismiss ("Later"), incl. the legacy pre-#1417
 *     dismissal key being honoured
 *   - the inviting wording never mentions "API key" in any
 *     rendered branch
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import AiInviteCard from "./AiInviteCard";

const mockStatus = {
    ready: true,
    hasKey: false,
    activeProvider: null,
    refresh: vi.fn(),
};
vi.mock("../../hooks/settings/useApiKeyStatus", () => ({
    useApiKeyStatus: () => ({...mockStatus}),
}));

function renderCard() {
    return render(
        <MemoryRouter>
            <AiInviteCard />
        </MemoryRouter>,
    );
}

describe("AiInviteCard", () => {
    beforeEach(() => {
        localStorage.clear();
        mockStatus.ready = true;
        mockStatus.hasKey = false;
    });

    it("renders exactly one inviting card with both actions when no key is configured", () => {
        renderCard();
        expect(screen.getAllByTestId("ai-invite-card")).toHaveLength(1);
        // A11y: labelled region, not an alert/warning.
        const card = screen.getByTestId("ai-invite-card");
        expect(card.getAttribute("role")).toBe("region");
        expect(card.getAttribute("aria-label")).toBeTruthy();
        // Primary action deep-links to the Settings AI tab.
        const connect = screen.getByTestId("ai-invite-connect");
        expect(connect.getAttribute("href")).toContain("/settings?tab=ai");
        expect(screen.getByTestId("ai-invite-later")).toBeInTheDocument();
    });

    it("never mentions an API key or 'required' wording", () => {
        renderCard();
        const text = screen.getByTestId("ai-invite-card").textContent ?? "";
        expect(text).not.toMatch(/api[- ]?(key|schl)/i);
        expect(text).not.toMatch(/erforderlich|required/i);
    });

    it("renders nothing when a key is configured", () => {
        mockStatus.hasKey = true;
        renderCard();
        expect(screen.queryByTestId("ai-invite-card")).not.toBeInTheDocument();
    });

    it("renders nothing before the key status is known (no false invite flash)", () => {
        mockStatus.ready = false;
        renderCard();
        expect(screen.queryByTestId("ai-invite-card")).not.toBeInTheDocument();
    });

    it("'Later' dismisses persistently across a remount (reload)", () => {
        const first = renderCard();
        fireEvent.click(first.getByTestId("ai-invite-later"));
        expect(first.queryByTestId("ai-invite-card")).not.toBeInTheDocument();
        expect(
            localStorage.getItem("adaptive-learner.ai_invite_dismissed"),
        ).toBe("true");
        first.unmount();
        const second = renderCard();
        expect(second.queryByTestId("ai-invite-card")).not.toBeInTheDocument();
    });

    it("honours the legacy pre-#1417 banner dismissal so old users are not re-invited", () => {
        localStorage.setItem(
            "adaptive-learner.api_key_banner_dismissed",
            "true",
        );
        renderCard();
        expect(screen.queryByTestId("ai-invite-card")).not.toBeInTheDocument();
    });
});
