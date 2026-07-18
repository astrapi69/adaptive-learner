/**
 * Regression pins for #1810 - the i18n catalog fetch must retry.
 *
 * One transient failure of ``GET /api/i18n/{lang}`` (backend restarting,
 * network blip) left the WHOLE session on the inline fallback strings:
 * a mixed-locale UI ('Fortschritt'/'Einstellungen' German from
 * ``i18n/fallbacks.ts``, everything else English code-defaults). The
 * catalog-fetch effect had one attempt and a silent ``catch``.
 *
 * Each test re-imports the module (``vi.resetModules``) so the
 * module-level catalog cache (``cachedLang`` / ``cachedStrings``)
 * starts empty.
 */

import {createElement, type ReactNode} from "react";
import {act, cleanup, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const i18nGet = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        settings: {getApp: vi.fn().mockResolvedValue({})},
        i18n: {get: (lang: string) => i18nGet(lang)},
    }),
}));

type I18nModule = typeof import("./useI18n");

const CATALOG = {nav: {progress: "Fortschritt"}};

async function freshModule(): Promise<I18nModule> {
    vi.resetModules();
    return import("./useI18n");
}

function renderProbe(mod: I18nModule): void {
    function Probe() {
        const {t} = mod.useI18n();
        return createElement(
            "span",
            {"data-testid": "probe"},
            t("nav.progress", "fallback-label"),
        );
    }
    render(
        createElement(
            mod.I18nProvider,
            null,
            createElement(Probe) as ReactNode,
        ),
    );
}

async function flushMicrotasks(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("i18n catalog fetch retries after a transient failure (#1810)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.setItem("adaptive-learner.language", "de");
        i18nGet.mockReset();
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("recovers when the first fetch fails and the retry succeeds", async () => {
        i18nGet
            .mockRejectedValueOnce(new Error("backend restarting"))
            .mockResolvedValue(CATALOG);
        const mod = await freshModule();
        renderProbe(mod);
        await flushMicrotasks();
        expect(screen.getByTestId("probe").textContent).toBe("Fortschritt");
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        await flushMicrotasks();
        expect(i18nGet.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(screen.getByTestId("probe").textContent).toBe("Fortschritt");
    });

    it("does not schedule retries when the first fetch succeeds", async () => {
        i18nGet.mockResolvedValue(CATALOG);
        const mod = await freshModule();
        renderProbe(mod);
        await flushMicrotasks();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(i18nGet).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("probe").textContent).toBe("Fortschritt");
    });

    it("gives up after the capped retry budget and warns instead of retrying forever", async () => {
        i18nGet.mockRejectedValue(new Error("catalog endpoint down"));
        const mod = await freshModule();
        renderProbe(mod);
        await flushMicrotasks();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(120_000);
        });
        await flushMicrotasks();
        const attempts = i18nGet.mock.calls.length;
        expect(attempts).toBeGreaterThanOrEqual(2);
        expect(attempts).toBeLessThanOrEqual(8);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(120_000);
        });
        expect(i18nGet.mock.calls.length).toBe(attempts);
        expect(console.warn).toHaveBeenCalled();
        // After giving up, the bundled DE fallback still serves the shell key
        // (nav.progress lives in i18n/fallbacks.ts) - never a raw key.
        expect(screen.getByTestId("probe").textContent).toBe("Fortschritt");
    });

    it("stops retrying on unmount (no timer leak)", async () => {
        i18nGet.mockRejectedValue(new Error("still down"));
        const mod = await freshModule();
        renderProbe(mod);
        await flushMicrotasks();
        const attemptsBeforeUnmount = i18nGet.mock.calls.length;
        cleanup();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(120_000);
        });
        expect(i18nGet.mock.calls.length).toBe(attemptsBeforeUnmount);
    });
});
