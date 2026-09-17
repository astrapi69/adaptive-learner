/**
 * #3072 - the token-role field enforces the two schema constraints in the
 * UI, not merely in prose.
 *
 * 1. ``token`` is a VERBATIM slice of the card's front. A token the
 *    generator cannot find at read time must not be storable, otherwise
 *    the annotation is inert and nothing says so.
 * 2. ``role`` is a CLOSED enum of seven values, so the control offers
 *    exactly those and no free text.
 *
 * The suggestion path is a proposal: it fills the list, the author still
 * confirms by saving the card. It never writes on its own.
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import TokenRoleField from "./TokenRoleField";
import type {ContentLessonCardTokenRole} from "../../../storage/types";

vi.mock("../../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
    }),
}));

function setup(
    overrides: Partial<{
        front: string;
        lang: string;
        value: ContentLessonCardTokenRole[];
    }> = {},
) {
    const onChange = vi.fn();
    render(
        <TokenRoleField
            front={overrides.front ?? "Der Hund in dem Garten"}
            lang={overrides.lang ?? "de"}
            value={overrides.value ?? []}
            onChange={onChange}
            idPrefix="card-1"
        />,
    );
    return {onChange};
}

const token = () => screen.getByTestId("card-1-token-role-token");
const addButton = () => screen.getByTestId("card-1-token-role-add");
const select = () => screen.getByTestId("card-1-token-role-select");

describe("TokenRoleField: the verbatim-slice constraint", () => {
    it("refuses a token that is not a literal slice of the front", () => {
        setup();
        fireEvent.change(token(), {target: {value: "Katze"}});
        expect(addButton()).toBeDisabled();
        expect(screen.getByTestId("card-1-token-role-error")).toHaveTextContent(
            /does not appear in the front/i,
        );
    });

    it("refuses a token that differs only in casing", () => {
        setup();
        fireEvent.change(token(), {target: {value: "der"}});
        expect(addButton()).toBeDisabled();
    });

    it("accepts the exact slice and hands it up unchanged", () => {
        const {onChange} = setup();
        fireEvent.change(token(), {target: {value: "Der"}});
        expect(addButton()).toBeEnabled();
        fireEvent.click(addButton());
        expect(onChange).toHaveBeenCalledWith([{token: "Der", role: "article"}]);
    });
});

describe("TokenRoleField: the closed enum", () => {
    it("offers exactly the seven schema roles and no free text", () => {
        setup();
        const options = Array.from(
            (select() as HTMLSelectElement).querySelectorAll("option"),
        ).map((o) => o.getAttribute("value"));
        expect(options).toEqual([
            "article",
            "noun",
            "verb",
            "adjective",
            "preposition",
            "gender_marker",
            "tense_marker",
        ]);
        expect(select().tagName).toBe("SELECT");
    });

    it("stores the role the author picked", () => {
        const {onChange} = setup();
        fireEvent.change(select(), {target: {value: "noun"}});
        fireEvent.change(token(), {target: {value: "Hund"}});
        fireEvent.click(addButton());
        expect(onChange).toHaveBeenCalledWith([{token: "Hund", role: "noun"}]);
    });
});

describe("TokenRoleField: duplicates and the cap", () => {
    it("refuses a token that is already annotated", () => {
        setup({value: [{token: "Der", role: "article"}]});
        fireEvent.change(token(), {target: {value: "Der"}});
        expect(addButton()).toBeDisabled();
        expect(screen.getByTestId("card-1-token-role-error")).toHaveTextContent(
            /already annotated/i,
        );
    });

    it("blocks adding past the schema's ten-role cap", () => {
        const full = Array.from({length: 10}, (_, i) => ({
            token: `t${i}`,
            role: "noun" as const,
        }));
        setup({value: full, front: "t0 t1 t2 t3 t4 t5 t6 t7 t8 t9 extra"});
        expect(token()).toBeDisabled();
        expect(addButton()).toBeDisabled();
        expect(screen.getByTestId("card-1-token-role-error")).toHaveTextContent(
            /more than 10 roles/i,
        );
    });
});

describe("TokenRoleField: removing", () => {
    it("drops the row the author removed and keeps the rest", () => {
        const {onChange} = setup({
            value: [
                {token: "Der", role: "article"},
                {token: "in", role: "preposition"},
            ],
        });
        fireEvent.click(screen.getAllByTestId("card-1-token-role-remove")[0]);
        expect(onChange).toHaveBeenCalledWith([{token: "in", role: "preposition"}]);
    });
});

describe("TokenRoleField: the suggestion is a proposal", () => {
    beforeEach(() => vi.clearAllMocks());

    it("fills the list with the closed-class matches of the front", () => {
        const {onChange} = setup();
        fireEvent.click(screen.getByTestId("card-1-token-roles-suggest"));
        expect(onChange).toHaveBeenCalledWith([
            {token: "Der", role: "article"},
            {token: "in", role: "preposition"},
            {token: "dem", role: "article"},
        ]);
    });

    it("says so instead of writing when nothing is recognised", () => {
        const {onChange} = setup({front: "Hund läuft", lang: "de"});
        fireEvent.click(screen.getByTestId("card-1-token-roles-suggest"));
        expect(onChange).not.toHaveBeenCalled();
        expect(
            screen.getByTestId("card-1-token-role-suggest-none"),
        ).toBeInTheDocument();
    });

    it("does not re-propose a token the author already has", () => {
        const {onChange} = setup({value: [{token: "Der", role: "noun"}]});
        fireEvent.click(screen.getByTestId("card-1-token-roles-suggest"));
        expect(onChange).toHaveBeenCalledWith([
            {token: "Der", role: "noun"},
            {token: "in", role: "preposition"},
            {token: "dem", role: "article"},
        ]);
    });

    it("is unavailable while the front is empty", () => {
        setup({front: "   "});
        expect(screen.getByTestId("card-1-token-roles-suggest")).toBeDisabled();
    });

    it("warns that suggestions are guesses once rows exist", () => {
        setup({value: [{token: "Der", role: "article"}]});
        expect(screen.getByText(/Suggestions are guesses/i)).toBeInTheDocument();
    });
});

// #3087 - at 375px the three intrinsic-width children of the add-row left
// the input a sliver and pushed the button out of the card; below the
// mobile breakpoint the row stacks (the CardEditor button-row pattern),
// above it the input is the child that shrinks and grows.
describe("TokenRoleField: the add-row on a phone (#3087)", () => {
    it("stacks the row below the mobile breakpoint", () => {
        setup();
        const row = token().parentElement as HTMLElement;
        expect(row.className).toContain("max-[769px]:flex-col");
        expect(row.className).toContain("max-[769px]:items-stretch");
    });

    it.each([
        ["the input shrinks and fills the row", () => token(), ["min-w-0", "flex-1"]],
        ["the select spans the width when stacked", () => select(), ["max-[769px]:w-full"]],
        ["the add button keeps its width", () => addButton(), ["shrink-0"]],
    ] as const)("%s", (_name, element, classes) => {
        setup();
        for (const cls of classes) expect(element().className).toContain(cls);
    });
});
