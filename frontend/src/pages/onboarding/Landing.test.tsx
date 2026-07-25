import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, afterEach, describe, expect, it, vi} from "vitest";

import Landing from "./Landing";

// Mock useNavigate so we can assert on routing without
// running a real history stack.
const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
    const actual = await vi.importActual<typeof import("react-router")>(
        "react-router",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

// Mock the api surface used by ApiStorage. We override:
// - ``api.users.get``: the returning-user detector + the
//   verification step that runs AFTER findMostRecent yields a hint.
// - ``api.identity.get``: the Phase 41B recovery channel. Returns
//   null by default (no identity.yaml on disk), so the "first-time
//   visitor" path is the default test posture.
const apiUsersGet = vi.fn();
const apiIdentityGet = vi.fn();
vi.mock("../../api/client", async () => {
    const actual = await vi.importActual<typeof import("../../api/client")>(
        "../../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            users: {
                ...actual.api.users,
                get: (...args: unknown[]) => apiUsersGet(...args),
            },
            identity: {
                ...actual.api.identity,
                get: () => apiIdentityGet(),
            },
        },
    };
});

// Mock react-toastify so the Dexie-recovery toast can be asserted
// without rendering the real ToastContainer (the App-level mount).
const toastSuccess = vi.fn();
vi.mock("react-toastify", async () => {
    const actual = await vi.importActual<typeof import("react-toastify")>(
        "react-toastify",
    );
    return {
        ...actual,
        toast: {
            ...actual.toast,
            success: (...args: unknown[]) => toastSuccess(...args),
        },
    };
});

describe("Landing page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiUsersGet.mockReset();
        apiIdentityGet.mockReset();
        apiIdentityGet.mockResolvedValue(null); // default: no identity.yaml
        toastSuccess.mockClear();
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function renderLanding() {
        return render(
            <MemoryRouter>
                <Landing />
            </MemoryRouter>,
        );
    }

    it("renders the title, subtitle, language picker, and CTA", async () => {
        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing")).toBeInTheDocument();
        });
        expect(
            screen.getByRole("heading", {name: /Adaptive Learner/}),
        ).toBeInTheDocument();
        expect(screen.getByTestId("landing-lang-de")).toBeInTheDocument();
        expect(screen.getByTestId("landing-lang-en")).toBeInTheDocument();
        expect(screen.getByTestId("landing-start")).toBeInTheDocument();
    });

    it("never renders a raw i18n key for the intro (#1902)", async () => {
        // Rendered outside I18nProvider, so useI18n() returns the no-provider
        // stub t(key, fallback) => fallback ?? key — the same shape as the
        // first-paint window before the async catalog resolves. A t() call
        // without a caller fallback would leak the raw dot-notation key here,
        // exactly as reported on the deployment.
        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing")).toBeInTheDocument();
        });
        expect(screen.queryByText("landing.intro")).not.toBeInTheDocument();
        expect(document.body.textContent).not.toContain("landing.intro");
    });

    it("opens the documentation link in a new tab without losing context (#173)", async () => {
        renderLanding();
        const docsLink = (await screen.findByTestId(
            "landing-docs-link",
        )) as HTMLAnchorElement;
        expect(docsLink.target).toBe("_blank");
        expect(docsLink.rel).toContain("noopener");
        // Language-aware docs link (#866): default (de) -> docs root.
        expect(docsLink.getAttribute("href")).toBe(
            "https://astrapi69.github.io/adaptive-learner/docs/",
        );
    });

    it("clicking the start button routes to /onboarding", async () => {
        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing-start")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByTestId("landing-start"));
        expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
    });

    it("clicking a language button persists the language to localStorage", async () => {
        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing-lang-en")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByTestId("landing-lang-en"));
        expect(localStorage.getItem("adaptive-learner.language")).toBe("en");
    });

    it("the active language is announced via aria-checked", async () => {
        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing-lang-de")).toBeInTheDocument();
        });
        const de = screen.getByTestId("landing-lang-de");
        const en = screen.getByTestId("landing-lang-en");
        expect(de.getAttribute("aria-checked")).toBe("true");
        expect(en.getAttribute("aria-checked")).toBe("false");
    });

    // --- v0.4.0: returning-user detection (localStorage hit) ------------

    it("verifies the stored user_id and redirects to /dashboard on success", async () => {
        localStorage.setItem("adaptive-learner.user_id", "u-back");
        apiUsersGet.mockResolvedValue({
            id: "u-back",
            name: "Returning Learner",
            email: null,
            language: "de",
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });
        renderLanding();
        expect(screen.getByTestId("landing-checking")).toBeInTheDocument();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
                replace: true,
            });
        });
        expect(apiUsersGet).toHaveBeenCalledWith("u-back");
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-back");
        // localStorage hit path does not consult identity.yaml.
        expect(apiIdentityGet).not.toHaveBeenCalled();
    });

    it("keeps localStorage on 5xx + shows Landing so the user can retry", async () => {
        localStorage.setItem("adaptive-learner.user_id", "u-1");
        const {ApiError} = await import("../../api/client");
        apiUsersGet.mockRejectedValue(new ApiError(500, "DB down"));

        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing")).toBeInTheDocument();
        });
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-1");
        expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard", {
            replace: true,
        });
        // 5xx leaves localStorage alone and does NOT try recovery.
        expect(apiIdentityGet).not.toHaveBeenCalled();
    });

    // --- Phase 41B: identity.yaml recovery -----------------------------

    it("recovers from identity.yaml when localStorage is empty (silent in API mode)", async () => {
        // No localStorage, but identity.yaml carries a valid user.
        apiIdentityGet.mockResolvedValue({
            user_id: "u-recovered",
            active_project_id: "p-recovered",
            language: "en",
            last_seen: "2026-05-23T10:00:00Z",
        });
        apiUsersGet.mockResolvedValue({
            id: "u-recovered",
            name: "Recovered",
            email: null,
            language: "en",
            created_at: "2026-05-20T00:00:00Z",
            updated_at: "2026-05-23T10:00:00Z",
        });
        renderLanding();
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
                replace: true,
            });
        });
        // localStorage re-seeded from identity.yaml.
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-recovered");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe("p-recovered");
        expect(localStorage.getItem("adaptive-learner.language")).toBe("en");
        // Verification call landed.
        expect(apiUsersGet).toHaveBeenCalledWith("u-recovered");
        // API-mode recovery is invisible per the rule "Recovery is
        // invisible to the user" - no toast.
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("re-tries recovery when localStorage userId 404s + identity.yaml has fresh data", async () => {
        // Stale localStorage userId; identity.yaml has a different,
        // still-valid one (e.g. after the stale user was deleted
        // out from under us but identity.yaml was rewritten on a
        // newer user).
        localStorage.setItem("adaptive-learner.user_id", "u-stale");
        const {ApiError} = await import("../../api/client");
        apiUsersGet
            .mockImplementationOnce(() => Promise.reject(new ApiError(404, "User not found.")))
            .mockResolvedValueOnce({
                id: "u-fresh",
                name: "Fresh",
                email: null,
                language: "de",
                created_at: "2026-05-23T11:00:00Z",
                updated_at: "2026-05-23T11:00:00Z",
            });
        apiIdentityGet.mockResolvedValue({
            user_id: "u-fresh",
            active_project_id: "p-fresh",
            language: "de",
            last_seen: "2026-05-23T11:00:00Z",
        });
        renderLanding();
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
                replace: true,
            });
        });
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-fresh");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe("p-fresh");
    });

    it("shows Landing when localStorage is empty AND identity.yaml is missing", async () => {
        // apiIdentityGet defaults to null (mockResolvedValue(null)).
        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing")).toBeInTheDocument();
        });
        // No dashboard redirect.
        expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard", {
            replace: true,
        });
        // No localStorage writes - genuine first visit.
        expect(localStorage.getItem("adaptive-learner.user_id")).toBeNull();
    });

    it("shows Landing when identity.yaml points to a non-existent user", async () => {
        // identity.yaml is stale: the user_id it names does not
        // resolve in the backend (e.g. DB was reset).
        apiIdentityGet.mockResolvedValue({
            user_id: "u-stale",
            active_project_id: "p-stale",
            language: "en",
            last_seen: "2026-05-23T10:00:00Z",
        });
        const {ApiError} = await import("../../api/client");
        apiUsersGet.mockRejectedValue(new ApiError(404, "User not found."));

        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing")).toBeInTheDocument();
        });
        // localStorage stays empty - the hint was stale.
        expect(localStorage.getItem("adaptive-learner.user_id")).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard", {
            replace: true,
        });
    });
});
