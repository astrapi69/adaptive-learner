/**
 * Tests for ShareResultButton (#1073): renders a tier-appropriate label and
 * hands the PII-free result text + URL to the native share sheet.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import ShareResultButton from "./ShareResultButton";
import type {LessonShareResult} from "../../lib/share/lesson-share";

const greatResult: LessonShareResult = {
    lessonTitle: "Ansible basics",
    correct: 9,
    total: 10,
    scorePct: 90,
    stars: 3,
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ShareResultButton", () => {
    it("shows the great-score CTA label", () => {
        render(<ShareResultButton result={greatResult} />);
        expect(
            screen.getByTestId("share-result-button"),
        ).toHaveTextContent("Share your great result!");
    });

    it("shares the PII-free result text + URL via the native sheet", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", {
            share,
            canShare: () => false,
        } as unknown as Navigator);

        render(<ShareResultButton result={greatResult} />);
        fireEvent.click(screen.getByTestId("share-result-button"));

        await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
        const arg = share.mock.calls[0][0];
        expect(arg.text).toContain("90%");
        expect(arg.text).toContain("Ansible basics");
        expect(arg.url).toBe("https://astrapi69.github.io/adaptive-learner/");
        // No image attached when canShare denies files (or none generated).
        expect(arg.files).toBeUndefined();
    });

    it("renders an icon-only button with the label as accessible name", () => {
        render(<ShareResultButton result={greatResult} iconOnly />);
        const btn = screen.getByTestId("share-result-button");
        expect(btn).toHaveAttribute("aria-label", "Share your great result!");
        expect(btn).not.toHaveTextContent("Share your great result!");
    });
});
