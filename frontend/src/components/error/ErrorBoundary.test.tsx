import {render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import ErrorBoundary from "./ErrorBoundary";
import {eventRecorder} from "../../utils/eventRecorder";

const {devMode} = vi.hoisted(() => ({devMode: {on: false}}));
vi.mock("../../hooks/settings/useDevMode", () => ({isDevMode: () => devMode.on}));

function Boom(): never {
    throw new Error("boom in render");
}

describe("ErrorBoundary", () => {
    beforeEach(() => {
        // The boundary logs via console.error in componentDidCatch.
        // Silence it for test output cleanliness; production
        // behaviour is unchanged.
        vi.spyOn(console, "error").mockImplementation(() => {});
        devMode.on = false;
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders children when nothing throws", () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">ok</div>
            </ErrorBoundary>,
        );
        expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("renders the default fallback when a child throws", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );
        const fallback = screen.getByTestId("error-boundary");
        expect(fallback).toBeInTheDocument();
        // #3390 - localized text; the raw message only in developer mode.
        expect(fallback.textContent).toContain("Something went wrong.");
        expect(fallback.textContent).not.toContain("boom in render");
    });

    it("shows the raw message in developer mode (#3390)", () => {
        devMode.on = true;
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );
        expect(screen.getByTestId("error-boundary").textContent).toContain("boom in render");
    });

    it("records the crash for the Report Issue history (#3390)", () => {
        const add = vi.spyOn(eventRecorder, "add");
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );
        expect(add).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "uncaught_error",
                message: "Error: boom in render",
                source: "ErrorBoundary",
            }),
        );
    });

    it("recovers when the reset key changes, as on navigation (#3390)", () => {
        let shouldThrow = true;
        function MaybeBoom() {
            if (shouldThrow) throw new Error("boom");
            return <div data-testid="child">ok</div>;
        }
        const {rerender} = render(
            <ErrorBoundary resetKey="/a" fallback={() => <div data-testid="fb" />}>
                <MaybeBoom />
            </ErrorBoundary>,
        );
        expect(screen.getByTestId("fb")).toBeInTheDocument();
        shouldThrow = false;
        rerender(
            <ErrorBoundary resetKey="/a" fallback={() => <div data-testid="fb" />}>
                <MaybeBoom />
            </ErrorBoundary>,
        );
        expect(screen.getByTestId("fb")).toBeInTheDocument();
        rerender(
            <ErrorBoundary resetKey="/b" fallback={() => <div data-testid="fb" />}>
                <MaybeBoom />
            </ErrorBoundary>,
        );
        expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("invokes the custom fallback when provided", () => {
        render(
            <ErrorBoundary fallback={(error) => <div data-testid="custom">{error.message}</div>}>
                <Boom />
            </ErrorBoundary>,
        );
        const custom = screen.getByTestId("custom");
        expect(custom.textContent).toBe("boom in render");
    });
});
