import {render, screen, fireEvent} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import MethodSwitchBanner from "./MethodSwitchBanner";

describe("MethodSwitchBanner", () => {
    it("renders the suggested method badge", () => {
        render(
            <MethodSwitchBanner
                suggested="dialogic"
                onAccept={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(screen.getByTestId("method-switch-banner")).toBeInTheDocument();
        expect(screen.getByTestId("method-switch-suggested").textContent).toMatch(
            /dialogic|Dialogisch|Dialogic/,
        );
    });

    it("uses the provided reason text when given, falls back to i18n otherwise", () => {
        const {rerender} = render(
            <MethodSwitchBanner
                suggested="error_based"
                reason="Du machst viele Fehler — Methode passt."
                onAccept={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(
            screen.getByText("Du machst viele Fehler — Methode passt."),
        ).toBeInTheDocument();
        rerender(
            <MethodSwitchBanner
                suggested="error_based"
                onAccept={() => {}}
                onDismiss={() => {}}
            />,
        );
        // Fallback i18n string is rendered (English "Your recent
        // ratings…" or German equivalent).
        const banner = screen.getByTestId("method-switch-banner");
        expect(banner.textContent ?? "").not.toContain(
            "Du machst viele Fehler — Methode passt.",
        );
    });

    it("fires onAccept / onDismiss on the matching buttons", () => {
        const onAccept = vi.fn();
        const onDismiss = vi.fn();
        render(
            <MethodSwitchBanner
                suggested="dialogic"
                onAccept={onAccept}
                onDismiss={onDismiss}
            />,
        );
        fireEvent.click(screen.getByTestId("method-switch-accept"));
        expect(onAccept).toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("method-switch-dismiss"));
        expect(onDismiss).toHaveBeenCalled();
    });
});
