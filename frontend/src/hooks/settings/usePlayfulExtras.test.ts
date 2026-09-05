/**
 * usePlayfulExtras tests (#2959): the pure count of enabled game-mode
 * extras (the seven detail switches) and the hook re-reading live on
 * every detail pref change event.
 */

import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it} from "vitest";

import {countPlayfulExtras, usePlayfulExtras} from "./usePlayfulExtras";
import {setPlayfulArcade} from "../../lib/learning/playful/playfulArcadePref";
import {setPlayfulBonus} from "../../lib/learning/playful/playfulBonusPref";
import {setPlayfulComboXp} from "../../lib/learning/playful/playfulComboXpPref";
import {setPlayfulSpecialRounds} from "../../lib/learning/playful/playfulSpecialRoundsPref";
import {
    setPlayfulCountdown,
    setPlayfulHearts,
} from "../../lib/learning/playful/playfulTensionPref";
import {setPlayfulTickets} from "../../lib/learning/playful/playfulTicketsPref";

beforeEach(() => {
    localStorage.clear();
});

describe("countPlayfulExtras", () => {
    it("counts the five ON defaults out of seven detail switches", () => {
        expect(countPlayfulExtras()).toEqual({on: 5, total: 7});
    });

    it("reaches 7 of 7 with both tension switches on and 0 of 7 with everything off", () => {
        setPlayfulHearts(true);
        setPlayfulCountdown(true);
        expect(countPlayfulExtras()).toEqual({on: 7, total: 7});
        setPlayfulHearts(false);
        setPlayfulCountdown(false);
        setPlayfulComboXp(false);
        setPlayfulArcade(false);
        setPlayfulSpecialRounds(false);
        setPlayfulTickets(false);
        setPlayfulBonus(false);
        expect(countPlayfulExtras()).toEqual({on: 0, total: 7});
    });
});

describe("usePlayfulExtras", () => {
    it("starts from the stored state and re-reads on every detail change event", () => {
        const {result} = renderHook(() => usePlayfulExtras());
        expect(result.current).toEqual({on: 5, total: 7});
        act(() => setPlayfulHearts(true));
        expect(result.current.on).toBe(6);
        act(() => setPlayfulArcade(false));
        expect(result.current.on).toBe(5);
        act(() => setPlayfulBonus(false));
        expect(result.current.on).toBe(4);
    });
});
