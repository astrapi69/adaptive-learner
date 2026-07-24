/**
 * Tests for AskAiPanel (#1321, #1443). The AI call is mocked (no real provider
 * hit). Pins:
 *  - No key → the "Ask AI" button is STILL shown, greyed-out via
 *    ``aria-disabled`` (NOT the ``disabled`` attribute, which would swallow
 *    touch events), wired to a hint popover with a settings link; clicking it
 *    fires NO AI call and does not open the ask panel; the old standalone
 *    fliesstext hint is gone.
 *  - With key → the block context + question reach aiComplete and the answer
 *    renders; provider-resolution and API errors are handled without crashing.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keyStatus = vi.fn();
vi.mock("../../../hooks/settings/useApiKeyStatus", () => ({
  useApiKeyStatus: () => keyStatus(),
}));
vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k, lang: "en" }),
}));
vi.mock("../../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "user-1" }),
}));
const resolveProvider = vi.fn();
vi.mock("../../../lib/ai/providers/resolve-provider", () => ({
  resolveActiveAiProvider: (...a: unknown[]) => resolveProvider(...a),
}));
const aiComplete = vi.fn();
vi.mock("../../../storage/ai/ai-providers", () => ({
  aiComplete: (...a: unknown[]) => aiComplete(...a),
}));

import AskAiPanel from "./AskAiPanel";

const context = {
  kind: "theory" as const,
  blockText: "The passé composé uses avoir or être.",
  targetLanguage: "fr",
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <AskAiPanel context={context} />
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

describe("AskAiPanel", () => {
  it("renders nothing until the key status is ready", () => {
    keyStatus.mockReturnValue({ ready: false, hasKey: false });
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  describe("without an AI key", () => {
    beforeEach(() => keyStatus.mockReturnValue({ ready: true, hasKey: false }));

    it("still shows the Ask AI button, greyed via aria-disabled (not the disabled attribute)", () => {
      renderPanel();
      const button = screen.getByTestId("ask-ai-disabled");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-disabled", "true");
      // A real `disabled` button swallows touch events -> dead tap-target.
      expect(button).not.toBeDisabled();
      expect(button.tagName).toBe("BUTTON");
    });

    it("wires the button to the hint popover via aria-describedby and hosts the settings link", () => {
      renderPanel();
      const button = screen.getByTestId("ask-ai-disabled");
      const hint = screen.getByTestId("ask-ai-no-key");
      expect(button.getAttribute("aria-describedby")).toBe(hint.getAttribute("id"));
      expect(hint).toBeInTheDocument();
      expect(screen.getByTestId("ask-ai-settings-link")).toHaveAttribute(
        "href",
        "/settings?tab=ai",
      );
    });

    it("keeps the popover hidden until the trigger is engaged, then reveals it", async () => {
      renderPanel();
      const hint = screen.getByTestId("ask-ai-no-key");
      expect(hint).not.toBeVisible();
      fireEvent.focus(screen.getByTestId("ask-ai-disabled"));
      await waitFor(() => expect(hint).toBeVisible());
    });

    it("no longer renders the old standalone paragraph hint", () => {
      renderPanel();
      // The hint now lives inside the button's popover, not as a loose <p>.
      const hint = screen.getByTestId("ask-ai-no-key");
      expect(hint.tagName).not.toBe("P");
    });

    it("does not fire an AI call or open the ask panel when the greyed button is clicked", () => {
      renderPanel();
      fireEvent.click(screen.getByTestId("ask-ai-disabled"));
      expect(aiComplete).not.toHaveBeenCalled();
      expect(screen.queryByTestId("ask-ai-panel")).toBeNull();
      expect(screen.queryByTestId("ask-ai-input")).toBeNull();
    });
  });

  it("passes the block context + question to aiComplete and renders the answer", async () => {
    keyStatus.mockReturnValue({ ready: true, hasKey: true });
    aiComplete.mockResolvedValue("Sure, for example: J'ai mangé.");
    renderPanel();

    fireEvent.click(screen.getByTestId("ask-ai-open"));
    fireEvent.change(screen.getByTestId("ask-ai-panel").querySelector("textarea")!, {
      target: { value: "Give an example" },
    });
    fireEvent.click(screen.getByTestId("ask-ai-submit"));

    await waitFor(() => expect(aiComplete).toHaveBeenCalledTimes(1));
    const arg = aiComplete.mock.calls[0][0];
    expect(arg.provider).toBe("anthropic");
    const system = arg.messages[0].content as string;
    expect(system).toContain("passé composé uses avoir");
    const user = arg.messages[arg.messages.length - 1];
    expect(user).toEqual({ role: "user", content: "Give an example" });
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-answer")).toHaveTextContent(
        "J'ai mangé",
      ),
    );
  });

  it("shows a clear error and does not crash when the AI call fails", async () => {
    keyStatus.mockReturnValue({ ready: true, hasKey: true });
    aiComplete.mockRejectedValue(new Error("HTTP 401: invalid key"));
    renderPanel();
    fireEvent.click(screen.getByTestId("ask-ai-open"));
    fireEvent.change(screen.getByTestId("ask-ai-panel").querySelector("textarea")!, {
      target: { value: "Explain" },
    });
    fireEvent.click(screen.getByTestId("ask-ai-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-error")).toHaveTextContent(
        "HTTP 401: invalid key",
      ),
    );
  });

  it("handles a missing resolved provider gracefully (no crash, no call)", async () => {
    keyStatus.mockReturnValue({ ready: true, hasKey: true });
    resolveProvider.mockResolvedValue(null);
    renderPanel();
    fireEvent.click(screen.getByTestId("ask-ai-open"));
    fireEvent.change(screen.getByTestId("ask-ai-panel").querySelector("textarea")!, {
      target: { value: "Explain" },
    });
    fireEvent.click(screen.getByTestId("ask-ai-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-error")).toBeInTheDocument(),
    );
    expect(aiComplete).not.toHaveBeenCalled();
  });
});
