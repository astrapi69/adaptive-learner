/**
 * correctionView — the pure view-decision helper behind CorrectionBlock
 * (#2496; #2570 added the "replay_only" case).
 *
 * Extracted from CorrectionBlock.test.tsx's full-render coverage: these pin
 * the DECISION itself (which of hidden/complete/collapsed/drill/replay_only
 * a given status/flags combination resolves to), so the branch logic is
 * provable without mounting the component.
 */

import {describe, expect, it} from "vitest";
import {correctionView} from "./CorrectionBlock";

const BASE = {
    status: "ready" as const,
    expanded: false,
    clozeCount: 0,
    errorCount: 0,
    hasReplayHref: false,
    allCorrected: false,
};

describe("correctionView", () => {
    it("hides while loading, regardless of the other flags", () => {
        expect(correctionView({...BASE, status: "loading"}).kind).toBe("hidden");
    });

    it("hides when there is nothing actionable (no clozes, no replay)", () => {
        expect(correctionView(BASE).kind).toBe("hidden");
    });

    it("collapsed by default when clozes are ready", () => {
        const view = correctionView({...BASE, clozeCount: 3});
        expect(view.kind).toBe("collapsed");
        expect(view.drillsAvailable).toBe(true);
    });

    it("drill when expanded and clozes are ready", () => {
        expect(correctionView({...BASE, clozeCount: 3, expanded: true}).kind).toBe(
            "drill",
        );
    });

    it("#2570 — replay_only when NO cloze generated but a replay exists, collapsed or expanded alike (no pointless expand step)", () => {
        const collapsed = correctionView({
            ...BASE,
            clozeCount: 0,
            hasReplayHref: true,
            errorCount: 2,
            expanded: false,
        });
        expect(collapsed.kind).toBe("replay_only");
        expect(collapsed.drillsAvailable).toBe(false);
        expect(collapsed.hasReplay).toBe(true);

        const expanded = correctionView({
            ...BASE,
            clozeCount: 0,
            hasReplayHref: true,
            errorCount: 2,
            expanded: true,
        });
        expect(expanded.kind).toBe("replay_only");
    });

    it("drills win over replay_only when both are available - the drill IS the point", () => {
        const view = correctionView({
            ...BASE,
            clozeCount: 2,
            hasReplayHref: true,
            errorCount: 2,
            expanded: true,
        });
        expect(view.kind).toBe("drill");
        expect(view.drillsAvailable).toBe(true);
        expect(view.hasReplay).toBe(true);
    });

    it("complete once the drill round is done", () => {
        expect(correctionView({...BASE, status: "complete"}).kind).toBe("complete");
    });

    it("complete (all-corrected note) when nothing is actionable but everything is already fixed", () => {
        const view = correctionView({...BASE, allCorrected: true});
        expect(view.kind).toBe("complete");
        expect(view.drillsDone).toBe(false);
    });
});
