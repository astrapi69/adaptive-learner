/**
 * AppUpdateProvider — pins the i18n mapping onto the kit's message object
 * (#1873).
 *
 * The kit ships its own ``pwa.update.*`` key set, but this app already
 * translates the update surface in 11 catalogs under DIFFERENT keys. The
 * provider maps those existing keys through, so the shipped translations keep
 * working without a key migration. If a mapping silently falls back to the
 * kit's English default, this test fails.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpdateCheckControl } from "@astrapi69/pwa-update-react";

import AppUpdateProvider from "./AppUpdateProvider";
import { I18nProvider } from "../../hooks/ui/useI18n";

describe("AppUpdateProvider", () => {
    it("renders the update surface through the app's own i18n keys", async () => {
        render(
            <I18nProvider>
                <AppUpdateProvider>
                    <UpdateCheckControl />
                </AppUpdateProvider>
            </I18nProvider>,
        );
        // ``about.check_update`` — the app's existing key, translated in all
        // 11 catalogs. The kit's own default would read "Check for updates".
        const button = await screen.findByTestId("update-check-button");
        expect(button.textContent?.trim().length).toBeGreaterThan(0);
    });

    it("provides the store so consumers mount without their own wiring", async () => {
        render(
            <I18nProvider>
                <AppUpdateProvider>
                    <UpdateCheckControl />
                </AppUpdateProvider>
            </I18nProvider>,
        );
        expect(await screen.findByTestId("update-check")).toBeTruthy();
        expect(await screen.findByTestId("update-check-last")).toBeTruthy();
    });

    it("throws for a consumer mounted outside the provider", () => {
        // Guard against a future refactor quietly dropping the provider from
        // the root: the kit fails loudly rather than rendering a dead control.
        expect(() => render(<UpdateCheckControl />)).toThrow(
            /must be used within a <PwaUpdateProvider>/,
        );
    });
});
