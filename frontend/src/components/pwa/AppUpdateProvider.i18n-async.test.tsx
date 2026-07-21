/**
 * AppUpdateProvider — the messages object must follow the ASYNC catalog load,
 * not freeze on the first-paint English fallbacks (#1894).
 *
 * The i18n catalogs load as lazy per-language chunks
 * (``useI18n`` -> ``getStorage().i18n.get(lang)``), so on the very first render
 * ``t()`` returns the English caller-fallbacks. When the German catalog then
 * resolves, ``t`` changes identity but ``lang`` does NOT. A provider that
 * memoises ``buildMessages(t)`` on ``[lang]`` would keep the stale English
 * object for the whole session — the exact bug that left ``UpdateCheckControl``
 * English under a German locale while its ``locale``-formatted timestamp
 * ("jetzt") was correctly localised.
 *
 * This pins that the update surface reaches the German strings once the
 * catalog has loaded. It is deliberately in its OWN file so the module-level
 * ``useI18n`` catalog cache starts empty (Vitest isolates per file), which is
 * what reproduces the first-paint-then-async-load sequence.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UpdateCheckControl } from "@astrapi69/pwa-update-react";

import AppUpdateProvider from "./AppUpdateProvider";
import { I18nProvider, _resetI18nCacheForTests } from "../../hooks/ui/useI18n";
import { _resetStorageCacheForTests } from "../../storage";

beforeEach(() => {
    localStorage.clear();
    _resetI18nCacheForTests();
    _resetStorageCacheForTests();
    // Force Dexie mode — the GH-Pages deployment shape the bug was reported on
    // — so ``getStorage().i18n.get(lang)`` resolves the BUNDLED JSON catalog
    // (via glob) instead of a backend fetch that has no server in the test env.
    localStorage.setItem("adaptive-learner.storage_mode", "dexie");
    _resetStorageCacheForTests();
    // Persist a German choice so the init resolver skips the browser-locale
    // derivation (happy-dom's navigator.language is en) and the German catalog
    // is the one that loads. The persisted choice always wins (#1333).
    localStorage.setItem("adaptive-learner.language", "de");
});

afterEach(() => {
    localStorage.clear();
});

describe("AppUpdateProvider — async catalog", () => {
    it("shows the German update-control strings after the catalog loads", async () => {
        render(
            <I18nProvider>
                <AppUpdateProvider>
                    <UpdateCheckControl />
                </AppUpdateProvider>
            </I18nProvider>,
        );

        // The idle check button: German ``about.check_update`` is
        // "Auf Updates prüfen"; the kit's English default is
        // "Check for updates". The freeze bug keeps the English default even
        // after the German catalog has resolved.
        await waitFor(() => {
            expect(screen.getByTestId("update-check-button").textContent).toContain(
                "Auf Updates prüfen",
            );
        });

        // The footer line: German ``about.never_checked`` is "Noch nie geprüft"
        // (kit default: "Never checked").
        expect(screen.getByTestId("update-check-last").textContent).toContain(
            "Noch nie geprüft",
        );
    });

    it("keeps the English strings under the en locale (no regression)", async () => {
        localStorage.setItem("adaptive-learner.language", "en");
        render(
            <I18nProvider>
                <AppUpdateProvider>
                    <UpdateCheckControl />
                </AppUpdateProvider>
            </I18nProvider>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("update-check-button").textContent).toContain(
                "Check for updates",
            );
        });
        expect(screen.getByTestId("update-check-last").textContent).toContain(
            "Never checked",
        );
    });
});
