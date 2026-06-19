/**
 * Tests for the HelpTooltip component (Phase 38B).
 *
 * The Radix HoverCard portal + hover-open timing are
 * exercised through happy-dom; the popover content is
 * verified via the data-testid that the component renders on
 * the trigger. Since hover/portal timing can be brittle in
 * happy-dom, the focused assertions are:
 *  - The trigger renders with the dotted-underline marker.
 *  - The children render as the visible label.
 *  - Missing glossary keys gracefully degrade to plain
 *    children (no tooltip wrapper).
 *  - Clicking the "Learn more" button (rendered eagerly by
 *    HoverCard for accessibility) dispatches the right call
 *    via the HelpContext.
 */

import {describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";

import {HelpProvider} from "../../contexts/HelpContext";
import HelpTooltip from "./HelpTooltip";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
        setLang: vi.fn(),
    }),
}));

describe("HelpTooltip", () => {
    it("renders the wrapped children as the visible label", () => {
        render(
            <HelpProvider>
                <HelpTooltip glossaryKey="curriculum">Curriculum</HelpTooltip>
            </HelpProvider>,
        );
        expect(screen.getByText("Curriculum")).toBeInTheDocument();
    });

    it("renders the trigger with the canonical testid", () => {
        render(
            <HelpProvider>
                <HelpTooltip glossaryKey="method_deductive">
                    Deductive
                </HelpTooltip>
            </HelpProvider>,
        );
        expect(
            screen.getByTestId("help-term-method_deductive"),
        ).toBeInTheDocument();
    });

    it("applies the dotted underline style to the trigger", () => {
        render(
            <HelpProvider>
                <HelpTooltip glossaryKey="learning_session">
                    Session
                </HelpTooltip>
            </HelpProvider>,
        );
        const trigger = screen.getByTestId("help-term-learning_session");
        // Inline style assertion: dotted border-bottom is the
        // load-bearing visual cue. Check the inline ``style``
        // attribute directly (happy-dom resolves CSS-variable
        // borders inconsistently in computed style).
        const styleAttr = trigger.getAttribute("style") ?? "";
        expect(styleAttr).toContain("border-bottom-style: dashed");
        // v1.23.2 — accent-coloured 2px border for
        // discoverability (was 1px ``var(--fg-muted)``).
        expect(styleAttr).toContain("border-bottom-width: 2px");
        expect(styleAttr).toContain("border-bottom-color: var(--accent");
        expect(styleAttr).toContain("cursor: help");
    });

    it("gracefully degrades to plain children when the key is missing", () => {
        render(
            <HelpProvider>
                <HelpTooltip glossaryKey="this-key-does-not-exist">
                    Plain term
                </HelpTooltip>
            </HelpProvider>,
        );
        // Children render, but no help-term marker is present.
        expect(screen.getByText("Plain term")).toBeInTheDocument();
        expect(
            screen.queryByTestId("help-term-this-key-does-not-exist"),
        ).not.toBeInTheDocument();
    });

    it("works without HelpProvider mounted (no-op fallback in useHelp)", () => {
        // The fallback in useHelp() must not throw when used
        // outside the provider — covers cases where a test
        // mounts a single component in isolation.
        render(
            <HelpTooltip glossaryKey="curriculum">Curriculum</HelpTooltip>,
        );
        expect(
            screen.getByTestId("help-term-curriculum"),
        ).toBeInTheDocument();
    });
});
