/**
 * Tests for ErrorReportDialog (Phase 37).
 *
 * Covers: rendering with error message, checkbox toggles, preview
 * toggle, issue body construction, URL truncation, submit opens
 * window, copy preview to clipboard, close button calls onClose, and
 * the opt-in defaults: environment and action history reach the
 * GitHub URL and the JSON download only once ticked (#3804).
 *
 * The Radix Dialog portal is exercised end-to-end (rendered into a
 * happy-dom-supplied body). Toggle interactions use real
 * fireEvent.click so the Radix state machine + our React state
 * stay in sync.
 */

import {describe, it, expect, vi, beforeEach} from "vitest";
import {render, screen, fireEvent, cleanup} from "@testing-library/react";

import {ApiError} from "../../api/client";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
        setLang: vi.fn(),
    }),
}));

vi.mock("../../utils/eventRecorder", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../../utils/eventRecorder")>();
    return {
        ...actual,
        eventRecorder: {
            getAll: () => [
                {
                    type: "click" as const,
                    timestamp: 1000,
                    text: "Open something",
                },
                {
                    type: "api_call" as const,
                    timestamp: 1500,
                    method: "POST",
                    endpoint: "/api/projects",
                    status: 500,
                    durationMs: 12,
                },
            ],
        },
        formatEventLog: () =>
            "00:00:01  Click: \"Open something\"\n00:00:01  API: POST /api/projects -> 500 (12ms)",
    };
});

const {downloadBlobMock} = vi.hoisted(() => ({downloadBlobMock: vi.fn()}));

vi.mock("../../lib/lesson/export/result-download", () => ({
    downloadBlob: downloadBlobMock,
}));

import ErrorReportDialog from "./ErrorReportDialog";

beforeEach(() => {
    cleanup();
    // Re-stub window.open per test so call history doesn't bleed
    // across the "submit" tests + the URL-trim test.
    vi.restoreAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
});

function renderDialog(
    overrides: Partial<{
        open: boolean;
        errorMessage: string;
        apiError: ApiError;
        onClose: () => void;
        proactive: boolean;
    }> = {},
) {
    const onClose = overrides.onClose ?? vi.fn();
    render(
        <ErrorReportDialog
            open={overrides.open ?? true}
            onClose={onClose}
            errorMessage={
                overrides.errorMessage ?? "Session failed: 500 from /api/foo"
            }
            apiError={overrides.apiError}
            proactive={overrides.proactive}
        />,
    );
    return {onClose};
}

describe("ErrorReportDialog rendering", () => {
    it("renders the dialog title and intro", () => {
        renderDialog();
        expect(screen.getByText("Report an issue")).toBeInTheDocument();
        expect(
            screen.getByText(/Adaptive Learner caught an error/i),
        ).toBeInTheDocument();
    });

    it("does not render when open=false", () => {
        renderDialog({open: false});
        expect(
            screen.queryByTestId("error-report-dialog"),
        ).not.toBeInTheDocument();
    });

    it("shows three checkboxes (error always-on + env + history)", () => {
        renderDialog();
        const checkboxes = screen.getAllByRole("checkbox");
        expect(checkboxes).toHaveLength(3);
        // Error+stacktrace is always on and disabled.
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[0]).toBeDisabled();
        // Env + history are opt-in: unticked until the learner ticks them (#3804).
        expect(checkboxes[1]).not.toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
    });

    it("env checkbox toggles on and off", () => {
        renderDialog();
        const env = screen.getByTestId(
            "error-report-include-env",
        ) as HTMLInputElement;
        fireEvent.click(env);
        expect(env.checked).toBe(true);
        fireEvent.click(env);
        expect(env.checked).toBe(false);
    });

    it("history checkbox toggles on and off", () => {
        renderDialog();
        const history = screen.getByTestId(
            "error-report-include-history",
        ) as HTMLInputElement;
        fireEvent.click(history);
        expect(history.checked).toBe(true);
        fireEvent.click(history);
        expect(history.checked).toBe(false);
    });

    // #1490 — the description textarea must carry token-backed
    // background + text colors. Without them the UA default leaks
    // through once the field loses focus: a light (near-white) well
    // inside a dark dialog on all 6 dark themes (same family as the
    // #185/#271 button-background lessons, preflight off).
    it("description textarea uses token-backed background + text color (#1490)", () => {
        renderDialog();
        const textarea = screen.getByTestId(
            "error-report-description",
        ) as HTMLTextAreaElement;
        expect(textarea.style.background).toBe("var(--bg-primary)");
        expect(textarea.style.color).toBe("var(--fg-primary)");
    });

    it("privacy note is always visible", () => {
        renderDialog();
        expect(
            screen.getByText(/no passwords, no API keys/i),
        ).toBeInTheDocument();
    });
});

describe("ErrorReportDialog preview + actions", () => {
    it("preview toggle shows the issue body with the error message", () => {
        renderDialog({errorMessage: "Boom - divine combustion"});
        fireEvent.click(screen.getByTestId("error-report-toggle-preview"));
        const preview = screen.getByTestId("error-report-full-preview");
        expect(preview.textContent).toContain("Boom - divine combustion");
        // The button label flips.
        expect(
            screen.getByTestId("error-report-toggle-preview").textContent,
        ).toContain("Hide preview");
    });

    it("submit button opens a GitHub issues URL with the right repo + labels", () => {
        renderDialog();
        fireEvent.click(screen.getByTestId("error-report-submit"));
        expect(window.open).toHaveBeenCalledOnce();
        const [url, target] = vi.mocked(window.open).mock.calls[0];
        expect(target).toBe("_blank");
        expect(String(url)).toContain(
            "github.com/astrapi69/adaptive-learner/issues/new",
        );
        expect(String(url)).toContain("labels=bug");
        expect(String(url)).toContain("title=");
        expect(String(url)).toContain("body=");
    });

    it("submit calls onClose", () => {
        const {onClose} = renderDialog();
        fireEvent.click(screen.getByTestId("error-report-submit"));
        expect(onClose).toHaveBeenCalled();
    });

    it("close button calls onClose", () => {
        const {onClose} = renderDialog();
        fireEvent.click(screen.getByTestId("error-report-close"));
        expect(onClose).toHaveBeenCalled();
    });

    it("includes API error details in the issue body when provided", () => {
        const apiError = new ApiError(
            500,
            "Internal Server Error",
            "/api/projects",
            "POST",
            "stack trace here",
        );
        renderDialog({apiError});
        fireEvent.click(screen.getByTestId("error-report-toggle-preview"));
        const preview = screen.getByTestId(
            "error-report-full-preview",
        );
        expect(preview.textContent).toContain("HTTP Status: 500");
        expect(preview.textContent).toContain("/api/projects");
        expect(preview.textContent).toContain("stack trace here");
    });

    it("includes the action-history block in the preview when checked", () => {
        renderDialog();
        fireEvent.click(
            screen.getByTestId("error-report-include-history"),
        );
        fireEvent.click(screen.getByTestId("error-report-toggle-preview"));
        const preview = screen.getByTestId("error-report-full-preview");
        expect(preview.textContent).toContain("Action history");
        expect(preview.textContent).toContain("Open something");
    });

    it("omits the action-history block when the history checkbox is unticked again", () => {
        renderDialog();
        const history = screen.getByTestId("error-report-include-history");
        fireEvent.click(history);
        fireEvent.click(history);
        fireEvent.click(screen.getByTestId("error-report-toggle-preview"));
        const preview = screen.getByTestId("error-report-full-preview");
        expect(preview.textContent).not.toContain("Action history");
    });
});

/** The issue body the submit button hands to GitHub, decoded from the URL. */
function submittedIssueBody(): string {
    fireEvent.click(screen.getByTestId("error-report-submit"));
    expect(window.open).toHaveBeenCalledOnce();
    const url = String(vi.mocked(window.open).mock.calls[0][0]);
    return new URL(url).searchParams.get("body") ?? "";
}

// #3804: GitHub receives the prefilled URL as soon as the tab opens, before
// the learner submits anything, and a submitted issue is public. Only what
// the learner ticks may travel in it.
describe("ErrorReportDialog opt-in sections in the GitHub URL (#3804)", () => {
    it.each([
        {entry: "an error toast", proactive: false},
        {entry: "Settings > Diagnostics & Support", proactive: true},
    ])(
        "a report opened from $entry without touching any toggle carries neither the environment nor the action history",
        ({proactive}) => {
            renderDialog({errorMessage: "Boom", proactive});
            expect(
                screen.queryByTestId("error-report-full-preview"),
            ).not.toBeInTheDocument();
            const body = submittedIssueBody();
            expect(body).toContain("## Error description");
            expect(body).toContain("Boom");
            expect(body).not.toContain("## Environment");
            expect(body).not.toContain("## Action history");
            expect(body).not.toContain("Open something");
        },
    );

    it("ticking the action history puts it into the GitHub URL", () => {
        renderDialog();
        fireEvent.click(
            screen.getByTestId("error-report-include-history"),
        );
        const body = submittedIssueBody();
        expect(body).toContain("## Action history");
        expect(body).toContain("Open something");
        expect(body).not.toContain("## Environment");
    });

    it("ticking the environment info puts it into the GitHub URL", () => {
        renderDialog();
        fireEvent.click(screen.getByTestId("error-report-include-env"));
        const body = submittedIssueBody();
        expect(body).toContain("## Environment");
        expect(body).toContain("Adaptive Learner version:");
        expect(body).not.toContain("## Action history");
    });

    it("viewing the recorded history does not include it in the report", () => {
        renderDialog();
        fireEvent.click(screen.getByTestId("error-report-history-view"));
        expect(
            screen.getByTestId("error-report-history-preview").textContent,
        ).toContain("Open something");
        expect(
            screen.getByTestId("error-report-include-history"),
        ).not.toBeChecked();
        const body = submittedIssueBody();
        expect(body).not.toContain("## Action history");
    });

    it("the JSON download carries the action history only once it is ticked", () => {
        downloadBlobMock.mockClear();
        renderDialog();
        const downloadedEventCount = () => {
            fireEvent.click(screen.getByTestId("error-report-download-json"));
            const json = String(downloadBlobMock.mock.lastCall?.[0]);
            return (JSON.parse(json) as {events: unknown[]}).events.length;
        };
        expect(downloadedEventCount()).toBe(0);
        fireEvent.click(
            screen.getByTestId("error-report-include-history"),
        );
        expect(downloadedEventCount()).toBe(2);
    });
});

describe("ErrorReportDialog clipboard", () => {
    it("copy preview button writes the issue body to the clipboard", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: {writeText},
            configurable: true,
        });
        renderDialog({errorMessage: "Boom"});
        fireEvent.click(
            screen.getByTestId("error-report-copy-preview"),
        );
        await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
        const arg = writeText.mock.calls[0][0] as string;
        expect(arg).toContain("Boom");
        expect(arg).toContain("Error description");
    });

    it("copy preview button surfaces the success state", async () => {
        Object.defineProperty(navigator, "clipboard", {
            value: {writeText: vi.fn().mockResolvedValue(undefined)},
            configurable: true,
        });
        renderDialog();
        fireEvent.click(
            screen.getByTestId("error-report-copy-preview"),
        );
        await vi.waitFor(() =>
            expect(
                screen.getByTestId("error-report-copy-preview").textContent,
            ).toContain("Copied!"),
        );
    });

    it("copy preview button surfaces failure when the clipboard rejects", async () => {
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: vi.fn().mockRejectedValue(new Error("denied")),
            },
            configurable: true,
        });
        renderDialog();
        fireEvent.click(
            screen.getByTestId("error-report-copy-preview"),
        );
        await vi.waitFor(() =>
            expect(
                screen.getByTestId("error-report-copy-preview").textContent,
            ).toContain("failed"),
        );
    });
});

describe("ErrorReportDialog URL-length trim", () => {
    it("trims the body when a long error pushes the encoded URL past GitHub's ~8192 ceiling", () => {
        // A 10000-char message + a chunky history would otherwise
        // produce an encoded URL > 8000 chars. The trim loop drops
        // 20% at a time + appends a truncation note until it
        // fits.
        const huge = "X".repeat(10000);
        renderDialog({errorMessage: huge});
        fireEvent.click(screen.getByTestId("error-report-submit"));
        expect(window.open).toHaveBeenCalledOnce();
        const url = String(vi.mocked(window.open).mock.calls[0][0]);
        // The opened URL itself must be below the GitHub
        // ceiling we picked (7800 raw + small overhead).
        expect(url.length).toBeLessThan(8000);
        // The body must be decodable (no double-encoding bugs)
        // and must contain a truncation marker.
        const bodyParam = new URL(url).searchParams.get("body") ?? "";
        expect(bodyParam.length).toBeGreaterThan(0);
        expect(bodyParam.toLowerCase()).toContain("truncated");
    });
});
