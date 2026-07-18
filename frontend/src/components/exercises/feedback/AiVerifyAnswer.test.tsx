/**
 * Tests for AiVerifyAnswer (#1798) — the "have the AI re-check my wrong
 * free-text answer" button. The AI call is mocked (no real provider hit).
 *
 * Pins:
 *  - No key → the button is STILL shown, greyed via ``aria-disabled`` (not
 *    the ``disabled`` attribute), with a BYOK hint + settings link; clicking
 *    it fires NO AI call.
 *  - With key → the question + learner answer + accepted answers reach
 *    aiComplete and the parsed verdict + reason render; the disclaimer that
 *    the score is unchanged is shown.
 *  - Provider-resolution failure and API errors are handled without crashing.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const keyStatus = vi.fn();
vi.mock("../../../hooks/settings/useApiKeyStatus", () => ({
    useApiKeyStatus: () => keyStatus(),
}));
vi.mock("../../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k, lang: "en"}),
}));
vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));
const resolveProvider = vi.fn();
vi.mock("../../../lib/ai/providers/resolve-provider", () => ({
    resolveActiveAiProvider: (...a: unknown[]) => resolveProvider(...a),
}));
const aiComplete = vi.fn();
vi.mock("../../../storage/ai/ai-providers", () => ({
    aiComplete: (...a: unknown[]) => aiComplete(...a),
}));

import AiVerifyAnswer from "./AiVerifyAnswer";

function renderVerify() {
    return render(
        <MemoryRouter>
            <AiVerifyAnswer
                prompt="Translate: single"
                userAnswer="noch Single"
                accept={["Single"]}
                targetLanguage="en"
            />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    keyStatus.mockReset();
    resolveProvider.mockReset();
    aiComplete.mockReset();
    resolveProvider.mockResolvedValue({
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        apiKey: "sk-x",
    });
});

afterEach(() => vi.restoreAllMocks());

describe("AiVerifyAnswer (#1798)", () => {
    it("renders nothing until the key status is ready", () => {
        keyStatus.mockReturnValue({ready: false, hasKey: false});
        const {container} = renderVerify();
        expect(container).toBeEmptyDOMElement();
    });

    describe("without an AI key", () => {
        beforeEach(() => keyStatus.mockReturnValue({ready: true, hasKey: false}));

        it("still shows the button, greyed via aria-disabled, and fires no AI call", () => {
            renderVerify();
            const button = screen.getByTestId("ai-verify-disabled");
            expect(button).toHaveAttribute("aria-disabled", "true");
            expect(button).not.toBeDisabled();
            fireEvent.click(button);
            expect(aiComplete).not.toHaveBeenCalled();
        });

        it("offers a BYOK hint with a link to the AI settings", () => {
            renderVerify();
            expect(screen.getByTestId("ai-verify-no-key")).toBeInTheDocument();
            expect(screen.getByTestId("ai-verify-settings-link")).toHaveAttribute(
                "href",
                "/settings?tab=ai",
            );
        });
    });

    it("sends the question, answer and accepted answers and renders the verdict", async () => {
        keyStatus.mockReturnValue({ready: true, hasKey: true});
        aiComplete.mockResolvedValue(
            '{"verdict":"yes","reason":"Same meaning as Single."}',
        );
        renderVerify();

        fireEvent.click(screen.getByTestId("ai-verify-button"));

        await waitFor(() => expect(aiComplete).toHaveBeenCalledTimes(1));
        const arg = aiComplete.mock.calls[0][0];
        const joined = arg.messages.map((m: {content: string}) => m.content).join("\n");
        expect(joined).toContain("Translate: single");
        expect(joined).toContain("noch Single");
        expect(joined).toContain("Single");

        await waitFor(() =>
            expect(screen.getByTestId("ai-verify-result")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("ai-verify-result")).toHaveAttribute(
            "data-verdict",
            "yes",
        );
        expect(screen.getByTestId("ai-verify-reason")).toHaveTextContent(
            "Same meaning as Single.",
        );
        // The informational disclaimer that the score is unchanged.
        expect(screen.getByTestId("ai-verify-disclaimer")).toBeInTheDocument();
    });

    it("shows the verdict even when the reply is not clean JSON", async () => {
        keyStatus.mockReturnValue({ready: true, hasKey: true});
        aiComplete.mockResolvedValue("It's basically right, same meaning.");
        renderVerify();
        fireEvent.click(screen.getByTestId("ai-verify-button"));
        await waitFor(() =>
            expect(screen.getByTestId("ai-verify-result")).toHaveAttribute(
                "data-verdict",
                "unknown",
            ),
        );
        expect(screen.getByTestId("ai-verify-reason")).toHaveTextContent(
            "basically right",
        );
    });

    it("shows a clear error and does not crash when the AI call fails", async () => {
        keyStatus.mockReturnValue({ready: true, hasKey: true});
        aiComplete.mockRejectedValue(new Error("HTTP 401: invalid key"));
        renderVerify();
        fireEvent.click(screen.getByTestId("ai-verify-button"));
        await waitFor(() =>
            expect(screen.getByTestId("ai-verify-error")).toHaveTextContent(
                "HTTP 401: invalid key",
            ),
        );
    });

    it("handles a missing resolved provider gracefully (no crash, no call)", async () => {
        keyStatus.mockReturnValue({ready: true, hasKey: true});
        resolveProvider.mockResolvedValue(null);
        renderVerify();
        fireEvent.click(screen.getByTestId("ai-verify-button"));
        await waitFor(() =>
            expect(screen.getByTestId("ai-verify-error")).toBeInTheDocument(),
        );
        expect(aiComplete).not.toHaveBeenCalled();
    });
});
