/**
 * IdentitySection tests (Phase 41D).
 *
 * Mocks ``api.identity.status`` to drive each render state:
 * Active, Not found, and the error path. The component is
 * pure-display (no actions, no localStorage writes) so the
 * test surface is intentionally narrow.
 */

import {render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import IdentitySection from "./IdentitySection";

const apiIdentityStatus = vi.fn();
vi.mock("../../api/client", async () => {
    const actual = await vi.importActual<typeof import("../../api/client")>(
        "../../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            identity: {
                ...actual.api.identity,
                status: () => apiIdentityStatus(),
            },
        },
    };
});

function tFn(_key: string, fallback?: string): string {
    return fallback ?? _key;
}

beforeEach(() => {
    apiIdentityStatus.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("IdentitySection", () => {
    it("renders the Active badge + path + last-updated when the file exists", async () => {
        apiIdentityStatus.mockResolvedValue({
            exists: true,
            path: "/home/u/.config/adaptive_learner/identity.yaml",
            last_seen: "2026-05-23T14:30:00+00:00",
        });
        render(<IdentitySection t={tFn} />);
        await waitFor(() => {
            expect(
                screen.getByTestId("about-identity-status-active"),
            ).toBeInTheDocument();
        });
        expect(screen.getByTestId("about-identity-path").textContent).toContain(
            "identity.yaml",
        );
        // last_seen rendered as locale string (browser-dependent),
        // just confirm the field appears.
        expect(
            screen.getByTestId("about-identity-last-seen"),
        ).toBeInTheDocument();
    });

    it("renders 'Not found' badge + path + no last-updated when file missing", async () => {
        apiIdentityStatus.mockResolvedValue({
            exists: false,
            path: "/home/u/.config/adaptive_learner/identity.yaml",
            last_seen: null,
        });
        render(<IdentitySection t={tFn} />);
        await waitFor(() => {
            expect(
                screen.getByTestId("about-identity-status-missing"),
            ).toBeInTheDocument();
        });
        // Path always rendered, even when file does not exist yet -
        // that's the "you'll find it here once you onboard" affordance.
        expect(screen.getByTestId("about-identity-path").textContent).toContain(
            "identity.yaml",
        );
        // No last-updated row when file is absent.
        expect(
            screen.queryByTestId("about-identity-last-seen"),
        ).toBeNull();
    });

    it("renders nothing when the status endpoint fails (#914 — no raw HTTP error)", async () => {
        const {ApiError} = await import("../../api/client");
        apiIdentityStatus.mockRejectedValue(new ApiError(404, "Not Found"));
        const {container} = render(<IdentitySection t={tFn} />);
        // The section disappears entirely on a load failure instead of showing
        // a "Could not load identity status: HTTP 404" banner.
        await waitFor(() => {
            expect(screen.queryByTestId("about-identity-loading")).toBeNull();
        });
        expect(screen.queryByTestId("about-identity-section")).toBeNull();
        expect(screen.queryByTestId("about-identity-error")).toBeNull();
        expect(container.firstChild).toBeNull();
    });
});
