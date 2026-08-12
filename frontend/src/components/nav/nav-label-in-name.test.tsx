/**
 * WCAG 2.5.3 "Label in Name" pins for the three header badges (#2539).
 *
 * A control whose accessible name does not CONTAIN its visible label
 * cannot be addressed by speech input ("click 102 fällig"), and the
 * mismatch is invisible in a normal browser. All three badges failed
 * this in a Lighthouse run against the German UI:
 *
 *   - mode badge:    visible "KI+Inhalte"  vs name "Modus: KI + Inhalte"
 *                    (prefix AND spacing - not even a substring)
 *   - reviews badge: visible "102 fällig"  vs name "102 Wiederholungen fällig"
 *   - XP badge:      visible "Stufe 4"     vs name "Level 4, ..."
 *                    (the German aria string was left untranslated)
 *
 * These tests drive the REAL German catalog through the real components,
 * so they reproduce what the audit saw rather than an English stand-in.
 * The rule they enforce: the accessible name LEADS with the visible text,
 * then may add a clarifying action or unit. Stricter than the success
 * criterion (which only demands containment) because speech input matches
 * from the start of the name.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import de from "../../data/i18n/de.json";
import type {XPState} from "../../storage/types";

/** Resolve a dotted key against the real German catalog. */
function translate(key: string, fallback?: string): string {
    let node: unknown = de;
    for (const part of key.split(".")) {
        node = (node as Record<string, unknown> | undefined)?.[part];
    }
    return typeof node === "string" ? node : (fallback ?? key);
}

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (key: string, fallback?: string) => translate(key, fallback),
        lang: "de",
    }),
}));

vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

const reviewQueueMock = vi.fn();
const listSetsMock = vi.fn();
const getXpStateMock = vi.fn();
const getStreakHeatmapMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {reviewQueue: reviewQueueMock},
        contentLoader: {listSets: listSetsMock},
        gamification: {
            getState: getXpStateMock,
            getStreakHeatmap: getStreakHeatmapMock,
        },
    }),
}));

import {NavModeBadge} from "./NavIndicators";
import NavReviewsBadge from "./NavReviewsBadge";
import NavXpBadge from "./NavXpBadge";

/** Collapse the whitespace runs an accessible-name computation folds. */
function normalize(text: string | null | undefined): string {
    return (text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Assert the Label-in-Name contract for one control.
 *
 * @param element - the rendered control.
 * @param visible - the text a sighted user reads on it.
 */
function expectNameLeadsWithVisibleText(element: HTMLElement, visible: string): void {
    const name = normalize(element.getAttribute("aria-label"));
    const label = normalize(visible);
    expect(label.length).toBeGreaterThan(0);
    expect(name).toContain(label);
    expect(name.startsWith(label)).toBe(true);
}

beforeEach(() => {
    vi.clearAllMocks();
    listSetsMock.mockResolvedValue({
        sets: [{source: "owner/repo", id: "es-a1", cached_version: "1"}],
    });
    reviewQueueMock.mockResolvedValue([
        {set_id: "es-a1", element_key: "libro", direction: "target_to_source", overdue: true},
        {set_id: "es-a1", element_key: "casa", direction: "target_to_source", overdue: true},
    ]);
    getStreakHeatmapMock.mockResolvedValue([]);
    getXpStateMock.mockResolvedValue({
        user_id: "user-1",
        total_xp: 680,
        level: 4,
        xp_into_level: 80,
        xp_to_next_level: 320,
        next_level_threshold: 1000,
    } satisfies XPState);
});

describe("WCAG 2.5.3 Label in Name — header badges", () => {
    it("mode badge: the accessible name leads with the visible badge text", async () => {
        render(
            <MemoryRouter>
                <NavModeBadge mode="ai-augmented" />
            </MemoryRouter>,
        );
        const badge = await screen.findByTestId("nav-mode-badge");
        expectNameLeadsWithVisibleText(badge, badge.textContent ?? "");
    });

    it("reviews badge: the accessible name leads with the visible count", async () => {
        render(
            <MemoryRouter>
                <NavReviewsBadge />
            </MemoryRouter>,
        );
        const badge = await screen.findByTestId("nav-reviews-badge");
        await waitFor(() => expect(normalize(badge.textContent)).toContain("2"));
        expectNameLeadsWithVisibleText(badge, badge.textContent ?? "");
    });

    it("XP badge: the accessible name leads with the visible level and carries the XP total", async () => {
        render(
            <MemoryRouter>
                <NavXpBadge />
            </MemoryRouter>,
        );
        const badge = await screen.findByTestId("nav-xp-badge");
        // The badge renders two visible spans ("Stufe 4" / "680 XP"); raw
        // textContent concatenates them without a separator, so assert
        // against the spans the user actually reads.
        const level = normalize(screen.getByTestId("nav-xp-badge-level").textContent);
        const total = normalize(screen.getByTestId("nav-xp-badge-total").textContent);
        expectNameLeadsWithVisibleText(badge, level);
        expect(normalize(badge.getAttribute("aria-label"))).toContain(total);
    });

    it("uses the German words the user sees, not an untranslated stand-in", async () => {
        render(
            <MemoryRouter>
                <NavXpBadge />
            </MemoryRouter>,
        );
        const badge = await screen.findByTestId("nav-xp-badge");
        const name = normalize(badge.getAttribute("aria-label"));
        // "Stufe" is what the badge shows; "Level" was the untranslated leak.
        expect(name).toContain("Stufe");
        expect(name).not.toContain("Level");
    });
});
