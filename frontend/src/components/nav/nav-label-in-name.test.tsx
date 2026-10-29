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
 *
 * axe 4.14 (#3865) also checks the WHOLE visible text, the way its
 * label-content-name-mismatch rule reads it: every text node on screen,
 * joined without a separator (spans are phrasing content), so two spans
 * "Stufe 4" / "680 XP" read as "Stufe 4680 XP". aria-hidden does not take
 * text off the screen: the profile link's initials are visible text too.
 * The second describe block pins that reading.
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
const usersGetMock = vi.fn();
const settingsGetMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        users: {get: usersGetMock},
        settings: {get: settingsGetMock},
        elementErrors: {reviewQueue: reviewQueueMock},
        contentLoader: {listSets: listSetsMock},
        gamification: {
            getState: getXpStateMock,
            getStreakHeatmap: getStreakHeatmapMock,
        },
    }),
}));

import NavAvatar from "./NavAvatar";
import {NavModeBadge} from "./NavIndicators";
import NavReviewsBadge from "./NavReviewsBadge";
import NavXpBadge from "./NavXpBadge";

/** Collapse the whitespace runs an accessible-name computation folds. */
function normalize(text: string | null | undefined): string {
    return (text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * The visible text of a control as axe's label-content-name-mismatch reads
 * it: the text nodes on screen joined without a separator, which is what
 * ``textContent`` returns for phrasing content.
 */
function visibleTextAsAxeReads(element: HTMLElement): string {
    return element.textContent ?? "";
}

/** axe compares lowercased, without punctuation, whitespace collapsed. */
function curate(text: string): string {
    return text.toLowerCase().replace(/\p{P}/gu, "").replace(/\s+/g, " ").trim();
}

/** The accessible name contains the whole visible text, as axe compares them. */
function expectNameContainsVisibleText(element: HTMLElement): void {
    const visible = curate(visibleTextAsAxeReads(element));
    expect(curate(element.getAttribute("aria-label") ?? "")).toContain(visible);
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
    usersGetMock.mockResolvedValue({id: "user-1", name: "Ada Lovelace", language: "de"});
    settingsGetMock.mockResolvedValue({avatar: null});
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

describe("label-content-name-mismatch: the whole visible text (#3865)", () => {
    it("XP badge: the name contains the level and the total as axe reads them", async () => {
        render(
            <MemoryRouter>
                <NavXpBadge />
            </MemoryRouter>,
        );
        const badge = await screen.findByTestId("nav-xp-badge");
        expect(curate(visibleTextAsAxeReads(badge))).toBe("stufe 4 680 xp");
        expectNameContainsVisibleText(badge);
    });

    it("profile link: the name leads with the initials the link shows", async () => {
        render(
            <MemoryRouter>
                <NavAvatar />
            </MemoryRouter>,
        );
        const link = await screen.findByTestId("nav-avatar");
        await screen.findByTestId("nav-avatar-initials");
        expect(curate(visibleTextAsAxeReads(link))).toBe("al");
        expectNameContainsVisibleText(link);
        expectNameLeadsWithVisibleText(link, visibleTextAsAxeReads(link));
    });

    it("profile link with a picture: no visible text, the name is the link's own", async () => {
        settingsGetMock.mockResolvedValue({avatar: "data:image/png;base64,AAAA"});
        render(
            <MemoryRouter>
                <NavAvatar />
            </MemoryRouter>,
        );
        const link = await screen.findByTestId("nav-avatar");
        await screen.findByTestId("nav-avatar-image");
        expect(curate(visibleTextAsAxeReads(link))).toBe("");
        expect(link).toHaveAttribute("aria-label", translate("nav.profile"));
    });
});
