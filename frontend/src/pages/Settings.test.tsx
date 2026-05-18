import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Settings from "./Settings";
import type {UserSettings} from "../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

const apiGet = vi.fn();
const apiUpdate = vi.fn();
const apiSetKey = vi.fn();
const apiDeleteKey = vi.fn();
vi.mock("../api/client", async () => {
    const actual = await vi.importActual<typeof import("../api/client")>(
        "../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            settings: {
                ...actual.api.settings,
                get: (...args: unknown[]) => apiGet(...args),
                update: (...args: unknown[]) => apiUpdate(...args),
                setApiKey: (...args: unknown[]) => apiSetKey(...args),
                deleteApiKey: (...args: unknown[]) => apiDeleteKey(...args),
            },
        },
    };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../utils/notify", () => ({
    notify: {
        success: (m: string) => toastSuccess(m),
        error: (m: string) => toastError(m),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

const BASE: UserSettings = {
    id: "us-1",
    user_id: "u-1",
    language: "de",
    active_provider: "anthropic",
    has_anthropic_key: false,
    has_openai_key: false,
    has_gemini_key: false,
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
};

function renderSettings() {
    return render(
        <MemoryRouter>
            <Settings />
        </MemoryRouter>,
    );
}

describe("Settings page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiGet.mockReset();
        apiUpdate.mockReset();
        apiSetKey.mockReset();
        apiDeleteKey.mockReset();
        toastSuccess.mockReset();
        toastError.mockReset();
        localStorage.clear();
        localStorage.setItem("adaptive-learner.user_id", "u-1");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("redirects to /onboarding when user_id is missing", async () => {
        localStorage.removeItem("adaptive-learner.user_id");
        renderSettings();
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {replace: true});
        });
    });

    it("renders the three sections after loading", async () => {
        apiGet.mockResolvedValue(BASE);
        renderSettings();
        await screen.findByTestId("settings");
        expect(screen.getByTestId("settings-language")).toBeInTheDocument();
        expect(screen.getByTestId("settings-provider")).toBeInTheDocument();
        expect(screen.getByTestId("api-key-row-anthropic")).toBeInTheDocument();
        expect(screen.getByTestId("api-key-row-openai")).toBeInTheDocument();
        expect(screen.getByTestId("api-key-row-gemini")).toBeInTheDocument();
    });

    it("changing the language calls update + flips i18n provider", async () => {
        apiGet.mockResolvedValue(BASE);
        apiUpdate.mockResolvedValue({...BASE, language: "en"});
        renderSettings();
        await screen.findByTestId("settings");
        await act(async () => {
            fireEvent.change(screen.getByTestId("settings-language"), {
                target: {value: "en"},
            });
        });
        await waitFor(() => {
            expect(apiUpdate).toHaveBeenCalledWith("u-1", {language: "en"});
        });
        expect(localStorage.getItem("adaptive-learner.language")).toBe("en");
    });

    it("changing the provider calls update", async () => {
        apiGet.mockResolvedValue(BASE);
        apiUpdate.mockResolvedValue({...BASE, active_provider: "openai"});
        renderSettings();
        await screen.findByTestId("settings");
        await act(async () => {
            fireEvent.change(screen.getByTestId("settings-provider"), {
                target: {value: "openai"},
            });
        });
        await waitFor(() => {
            expect(apiUpdate).toHaveBeenCalledWith("u-1", {active_provider: "openai"});
        });
    });

    it("Save key is disabled until the draft is non-empty", async () => {
        apiGet.mockResolvedValue(BASE);
        renderSettings();
        await screen.findByTestId("settings");
        const save = screen.getByTestId(
            "api-key-save-anthropic",
        ) as HTMLButtonElement;
        expect(save.disabled).toBe(true);
        fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
            target: {value: "sk-xxx"},
        });
        expect(save.disabled).toBe(false);
    });

    it("Save key posts the encrypted-write body and clears the draft", async () => {
        apiGet.mockResolvedValue(BASE);
        apiSetKey.mockResolvedValue({...BASE, has_anthropic_key: true});
        renderSettings();
        await screen.findByTestId("settings");
        fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
            target: {value: "sk-xxx"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("api-key-save-anthropic"));
        });
        await waitFor(() => {
            expect(apiSetKey).toHaveBeenCalledWith("u-1", {
                provider: "anthropic",
                key: "sk-xxx",
            });
        });
        // After success the status flips to "set" and a Delete
        // button is rendered.
        await screen.findByTestId("api-key-delete-anthropic");
        expect(
            (screen.getByTestId("api-key-input-anthropic") as HTMLInputElement).value,
        ).toBe("");
        expect(toastSuccess).toHaveBeenCalled();
    });

    it("Delete key fires only after window.confirm", async () => {
        apiGet.mockResolvedValue({...BASE, has_anthropic_key: true});
        apiDeleteKey.mockResolvedValue(BASE);
        // happy-dom doesn't ship window.confirm; install a stub
        // before vi.spyOn would otherwise reject for "function
        // undefined".
        const confirmStub = vi.fn().mockReturnValue(true);
        (window as unknown as {confirm: typeof confirmStub}).confirm =
            confirmStub;
        renderSettings();
        await screen.findByTestId("settings");
        await act(async () => {
            fireEvent.click(screen.getByTestId("api-key-delete-anthropic"));
        });
        expect(confirmStub).toHaveBeenCalled();
        await waitFor(() => {
            expect(apiDeleteKey).toHaveBeenCalledWith("u-1", "anthropic");
        });
    });

    it("Delete key cancellation does NOT call the API", async () => {
        apiGet.mockResolvedValue({...BASE, has_anthropic_key: true});
        const confirmStub = vi.fn().mockReturnValue(false);
        (window as unknown as {confirm: typeof confirmStub}).confirm =
            confirmStub;
        renderSettings();
        await screen.findByTestId("settings");
        fireEvent.click(screen.getByTestId("api-key-delete-anthropic"));
        expect(confirmStub).toHaveBeenCalled();
        expect(apiDeleteKey).not.toHaveBeenCalled();
    });

    it("renders an error state when /settings GET fails", async () => {
        const {ApiError} = await import("../api/client");
        apiGet.mockRejectedValue(new ApiError(500, "DB down"));
        renderSettings();
        await screen.findByTestId("settings-error");
        expect(screen.getByTestId("settings-error").textContent).toContain("DB down");
    });

    // --- v0.2.0: Active-provider visual feedback ---------------------

    it("renders the Active badge next to the active provider's API-key row", async () => {
        apiGet.mockResolvedValue({...BASE, active_provider: "openai"});
        renderSettings();
        await screen.findByTestId("settings");
        // Active badge appears on the openai row.
        expect(screen.getByTestId("api-key-active-openai")).toBeInTheDocument();
        // NOT on the anthropic / gemini rows.
        expect(screen.queryByTestId("api-key-active-anthropic")).not.toBeInTheDocument();
        expect(screen.queryByTestId("api-key-active-gemini")).not.toBeInTheDocument();
    });

    it("renders the missing-key warning when the active provider has no key", async () => {
        apiGet.mockResolvedValue({
            ...BASE,
            active_provider: "openai",
            has_openai_key: false,
        });
        renderSettings();
        await screen.findByTestId("settings");
        expect(
            screen.getByTestId("api-key-warning-openai"),
        ).toBeInTheDocument();
    });

    it("hides the missing-key warning when the active provider has a key", async () => {
        apiGet.mockResolvedValue({
            ...BASE,
            active_provider: "openai",
            has_openai_key: true,
        });
        renderSettings();
        await screen.findByTestId("settings");
        expect(
            screen.queryByTestId("api-key-warning-openai"),
        ).not.toBeInTheDocument();
    });

    it("non-active providers without keys do NOT get the warning", async () => {
        apiGet.mockResolvedValue({
            ...BASE,
            active_provider: "anthropic",
            has_anthropic_key: true,
            has_openai_key: false, // no key, but openai is not active
        });
        renderSettings();
        await screen.findByTestId("settings");
        expect(
            screen.queryByTestId("api-key-warning-openai"),
        ).not.toBeInTheDocument();
        // The Active badge is on anthropic, not openai.
        expect(screen.getByTestId("api-key-active-anthropic")).toBeInTheDocument();
    });
});
