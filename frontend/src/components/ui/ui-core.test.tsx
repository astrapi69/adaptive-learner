/**
 * Smoke tests for the hand-authored shadcn/ui core primitives
 * (Phase B / B1): Button, Card, Badge. happy-dom can't verify colour,
 * so these pin that the components render + emit the expected
 * variant/semantic utility classes (which the bridge resolves).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import {Button} from "./button";
import {Card, CardContent, CardHeader, CardTitle} from "./card";
import {Badge} from "./badge";

describe("Button", () => {
    it("renders the default (brand primary) variant", () => {
        render(<Button>Go</Button>);
        const btn = screen.getByRole("button", {name: "Go"});
        expect(btn.className).toContain("bg-primary");
        expect(btn.className).toContain("text-primary-foreground");
    });

    it("renders the destructive + outline + ghost variants", () => {
        render(
            <>
                <Button variant="destructive">Del</Button>
                <Button variant="outline">Cancel</Button>
                <Button variant="ghost">Subtle</Button>
            </>,
        );
        expect(
            screen.getByRole("button", {name: "Del"}).className,
        ).toContain("bg-destructive");
        expect(
            screen.getByRole("button", {name: "Cancel"}).className,
        ).toContain("border-input");
        expect(
            screen.getByRole("button", {name: "Subtle"}).className,
        ).toContain("hover:bg-accent");
    });

    it("honours disabled", () => {
        render(<Button disabled>Nope</Button>);
        expect(screen.getByRole("button", {name: "Nope"})).toBeDisabled();
    });

    it("asChild renders the child element (Slot)", () => {
        render(
            <Button asChild>
                <a href="/x">Link</a>
            </Button>,
        );
        const link = screen.getByRole("link", {name: "Link"});
        expect(link.tagName).toBe("A");
        expect(link.className).toContain("bg-primary");
    });

    it("marks the anchor with data-slot=button so global a-color skips it (#146)", () => {
        // The global ``a { color: var(--accent) }`` rule is unlayered
        // and would otherwise override the variant's layered text
        // color, putting accent text on an accent background
        // (invisible in dark mode). The marker lets the CSS exclude
        // button-styled anchors.
        render(
            <Button asChild>
                <a href="/x">Link</a>
            </Button>,
        );
        expect(
            screen.getByRole("link", {name: "Link"}),
        ).toHaveAttribute("data-slot", "button");
    });
});

describe("Card", () => {
    it("renders the surface card with header/title/content", () => {
        render(
            <Card data-testid="c">
                <CardHeader>
                    <CardTitle>Title</CardTitle>
                </CardHeader>
                <CardContent>Body</CardContent>
            </Card>,
        );
        const card = screen.getByTestId("c");
        expect(card.className).toContain("bg-card");
        expect(card.className).toContain("rounded-app");
        expect(card.className).toContain("border-border");
        expect(screen.getByText("Title")).toBeInTheDocument();
        expect(screen.getByText("Body")).toBeInTheDocument();
    });
});

describe("Badge", () => {
    it("renders default + secondary variants", () => {
        render(
            <>
                <Badge>New</Badge>
                <Badge variant="secondary">Beta</Badge>
            </>,
        );
        expect(screen.getByText("New").className).toContain("bg-primary");
        expect(screen.getByText("Beta").className).toContain("bg-secondary");
    });
});
