import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it} from "vitest";

import Navigation from "./Navigation";

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Navigation />
        </MemoryRouter>,
    );
}

describe("Navigation", () => {
    it("hides itself on the pre-onboarding funnel routes", () => {
        for (const path of ["/", "/onboarding", "/assessment"]) {
            const {unmount} = renderAt(path);
            expect(screen.queryByTestId("app-nav")).not.toBeInTheDocument();
            unmount();
        }
    });

    it("renders on /dashboard with the four canonical links", () => {
        renderAt("/dashboard");
        expect(screen.getByTestId("app-nav")).toBeInTheDocument();
        expect(screen.getByTestId("nav-dashboard")).toBeInTheDocument();
        expect(screen.getByTestId("nav-session")).toBeInTheDocument();
        expect(screen.getByTestId("nav-progress")).toBeInTheDocument();
        expect(screen.getByTestId("nav-settings")).toBeInTheDocument();
    });

    it("highlights the active route via NavLink isActive", () => {
        renderAt("/settings");
        const active = screen.getByTestId("nav-settings");
        const other = screen.getByTestId("nav-dashboard");
        expect(active.className).toContain("is-active");
        expect(other.className).not.toContain("is-active");
    });

    it("exposes a theme toggle button", () => {
        renderAt("/dashboard");
        expect(screen.getByTestId("nav-theme-toggle")).toBeInTheDocument();
    });
});
