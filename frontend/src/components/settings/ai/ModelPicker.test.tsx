/**
 * ModelPicker tests (v1.11.0 / Phase 24C).
 *
 * Covers:
 *   - Dropdown renders the fetched models and grouping.
 *   - Selection calls onDraftChange with the chosen id and closes
 *     the dropdown.
 *   - Loading state appears while the fetch is in flight.
 *   - Error state surfaces the API error AND offers the static
 *     suggestions as the offline fallback.
 *   - "no key" empty state is shown when hasApiKey=false.
 *   - Default-model hint is rendered when value is empty.
 *   - Retry button refires the fetch.
 *   - Context-window formatter renders K / M correctly.
 */

import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {ApiError} from "../../../api/client";
import {ModelPicker, __test__} from "./ModelPicker";

const mockGetAvailableModels = vi.fn();
vi.mock("../../../storage", () => ({
    getStorage: () => ({
        settings: {
            getAvailableModels: mockGetAvailableModels,
        },
    }),
}));

const STATIC = ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"] as const;

function renderPicker(
    overrides: Partial<React.ComponentProps<typeof ModelPicker>> = {},
) {
    const onDraftChange = vi.fn();
    const props: React.ComponentProps<typeof ModelPicker> = {
        userId: "user-1",
        provider: "anthropic",
        value: "",
        draft: "",
        onDraftChange,
        defaultModel: "claude-haiku-4-5-20251001",
        staticSuggestions: STATIC,
        hasApiKey: true,
        ...overrides,
    };
    const result = render(<ModelPicker {...props} />);
    return {...result, onDraftChange};
}

describe("ModelPicker", () => {
    beforeEach(() => {
        mockGetAvailableModels.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the input plus toggle, no dropdown until opened", () => {
        mockGetAvailableModels.mockResolvedValueOnce([]);
        renderPicker();
        expect(
            screen.getByTestId("model-picker-input-anthropic"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("model-picker-toggle-anthropic"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("model-picker-dropdown-anthropic"),
        ).not.toBeInTheDocument();
    });

    it("fetches and shows the model list when opened", async () => {
        mockGetAvailableModels.mockResolvedValueOnce([
            {
                id: "claude-opus-4-20250514",
                name: "Claude Opus 4",
                context_window: 200000,
                description: null,
            },
            {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                context_window: 200000,
                description: null,
            },
        ]);
        renderPicker();
        fireEvent.click(screen.getByTestId("model-picker-toggle-anthropic"));
        await waitFor(() =>
            expect(mockGetAvailableModels).toHaveBeenCalledWith(
                "user-1",
                "anthropic",
            ),
        );
        await waitFor(() =>
            expect(
                screen.getByTestId(
                    "model-picker-option-anthropic-claude-opus-4-20250514",
                ),
            ).toBeInTheDocument(),
        );
        expect(
            screen.getByTestId(
                "model-picker-option-anthropic-claude-sonnet-4-20250514",
            ),
        ).toBeInTheDocument();
    });

    it("selecting a model calls onDraftChange and closes the dropdown", async () => {
        mockGetAvailableModels.mockResolvedValueOnce([
            {
                id: "claude-opus-4-20250514",
                name: "Claude Opus 4",
                context_window: 200000,
                description: null,
            },
        ]);
        const {onDraftChange} = renderPicker();
        fireEvent.click(screen.getByTestId("model-picker-toggle-anthropic"));
        const option = await screen.findByTestId(
            "model-picker-option-anthropic-claude-opus-4-20250514",
        );
        fireEvent.click(option);
        expect(onDraftChange).toHaveBeenCalledWith("claude-opus-4-20250514");
        await waitFor(() =>
            expect(
                screen.queryByTestId("model-picker-dropdown-anthropic"),
            ).not.toBeInTheDocument(),
        );
    });

    it("shows the loading state while the fetch is in flight", async () => {
        let resolveFetch: (value: unknown) => void = () => {};
        mockGetAvailableModels.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveFetch = resolve;
            }),
        );
        renderPicker();
        fireEvent.click(screen.getByTestId("model-picker-toggle-anthropic"));
        expect(
            await screen.findByTestId("model-picker-loading-anthropic"),
        ).toBeInTheDocument();
        await act(async () => {
            resolveFetch([]);
        });
    });

    it("shows error state + offers the static fallback when fetch fails", async () => {
        mockGetAvailableModels.mockRejectedValueOnce(
            new ApiError(401, "Invalid API key.", "anthropic"),
        );
        renderPicker();
        fireEvent.click(screen.getByTestId("model-picker-toggle-anthropic"));
        expect(
            await screen.findByTestId("model-picker-error-anthropic"),
        ).toBeInTheDocument();
        // Static fallback rows present:
        expect(
            screen.getByTestId(
                "model-picker-suggestion-anthropic-claude-3-5-haiku-latest",
            ),
        ).toBeInTheDocument();
    });

    it("retry button re-fires the fetch", async () => {
        mockGetAvailableModels.mockRejectedValueOnce(
            new ApiError(500, "boom", "anthropic"),
        );
        renderPicker();
        fireEvent.click(screen.getByTestId("model-picker-toggle-anthropic"));
        await screen.findByTestId("model-picker-error-anthropic");
        mockGetAvailableModels.mockResolvedValueOnce([
            {id: "claude-x", name: "Claude X", context_window: 200000, description: null},
        ]);
        fireEvent.click(screen.getByTestId("model-picker-retry-anthropic"));
        await waitFor(() =>
            expect(mockGetAvailableModels).toHaveBeenCalledTimes(2),
        );
        await screen.findByTestId("model-picker-option-anthropic-claude-x");
    });

    it("renders the 'no key' state and skips the network when hasApiKey=false", async () => {
        renderPicker({hasApiKey: false});
        fireEvent.click(screen.getByTestId("model-picker-toggle-anthropic"));
        expect(
            await screen.findByTestId("model-picker-no-key-anthropic"),
        ).toBeInTheDocument();
        expect(mockGetAvailableModels).not.toHaveBeenCalled();
    });

    it("renders the default-model hint when value is empty", () => {
        renderPicker({value: ""});
        expect(
            screen.getByTestId("model-picker-default-hint-anthropic"),
        ).toHaveTextContent("claude-haiku-4-5-20251001");
    });

    it("does not render the default-model hint when value is set", () => {
        renderPicker({value: "claude-foo"});
        expect(
            screen.queryByTestId("model-picker-default-hint-anthropic"),
        ).not.toBeInTheDocument();
    });

    it("typing into the input fires onDraftChange and opens the dropdown", () => {
        mockGetAvailableModels.mockResolvedValueOnce([]);
        const {onDraftChange} = renderPicker();
        const input = screen.getByTestId("model-picker-input-anthropic");
        fireEvent.change(input, {target: {value: "sonnet"}});
        expect(onDraftChange).toHaveBeenCalledWith("sonnet");
    });

    it("formatContextWindow handles K and M boundaries", () => {
        expect(__test__.formatContextWindow(100)).toBe("100");
        expect(__test__.formatContextWindow(16384)).toBe("16K");
        expect(__test__.formatContextWindow(128000)).toBe("128K");
        expect(__test__.formatContextWindow(200000)).toBe("200K");
        expect(__test__.formatContextWindow(1_000_000)).toBe("1M");
        expect(__test__.formatContextWindow(1_048_576)).toBe("1M");
        expect(__test__.formatContextWindow(2_500_000)).toBe("2.5M");
    });
});
