/**
 * ContentPageHeader (#1793).
 *
 * Pins the extracted header panel: refresh action + disabled state,
 * and the #1272 on-demand info/sources panel (collapsed by default,
 * sources line only when sources exist).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ContentPageHeader from "./ContentPageHeader";
import type {useInfoHint} from "../../../shared/feedback/useInfoHint";
import type {ContentSetSource} from "../../../storage/types";

vi.mock("../../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback: string) => fallback,
        lang: "en",
    }),
}));

function infoHint(expanded: boolean): ReturnType<typeof useInfoHint> {
    return {
        expanded,
        blink: false,
        toggle: vi.fn(),
    } as unknown as ReturnType<typeof useInfoHint>;
}

const SOURCES: ContentSetSource[] = [
    {source: "bundled:adaptive-learner-content", branch: ""},
    {source: "astrapi69/adaptive-learner-content", branch: "main"},
];

describe("ContentPageHeader", () => {
    it("renders the title and fires onRefresh", () => {
        const onRefresh = vi.fn();
        render(
            <ContentPageHeader
                headerInfo={infoHint(false)}
                sources={SOURCES}
                refreshing={false}
                onRefresh={onRefresh}
            />,
        );
        expect(screen.getByTestId("content-header")).toHaveTextContent(
            "Meine Inhalte",
        );
        fireEvent.click(screen.getByTestId("content-refresh"));
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("disables the refresh button while refreshing", () => {
        render(
            <ContentPageHeader
                headerInfo={infoHint(false)}
                sources={SOURCES}
                refreshing
                onRefresh={vi.fn()}
            />,
        );
        const button = screen.getByTestId("content-refresh");
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent("Refreshing…");
    });

    it("hides the info panel until expanded, then shows intro + sources", () => {
        const {rerender} = render(
            <ContentPageHeader
                headerInfo={infoHint(false)}
                sources={SOURCES}
                refreshing={false}
                onRefresh={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("content-info-text")).toBeNull();

        rerender(
            <ContentPageHeader
                headerInfo={infoHint(true)}
                sources={SOURCES}
                refreshing={false}
                onRefresh={vi.fn()}
            />,
        );
        expect(screen.getByTestId("content-info-text")).toBeInTheDocument();
        expect(screen.getByTestId("content-sources")).toHaveTextContent(
            "astrapi69/adaptive-learner-content @ main",
        );
    });

    it("omits the sources line when no sources are configured", () => {
        render(
            <ContentPageHeader
                headerInfo={infoHint(true)}
                sources={[]}
                refreshing={false}
                onRefresh={vi.fn()}
            />,
        );
        expect(screen.getByTestId("content-info-text")).toBeInTheDocument();
        expect(screen.queryByTestId("content-sources")).toBeNull();
    });
});
