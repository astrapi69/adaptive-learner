import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import ShareButton from "./ShareButton";

const PROPS = {
    text: "I am on a 30-day streak! #AdaptiveLearner",
    url: "https://astrapi69.github.io/adaptive-learner/",
    label: "Share",
};

const MENU_LABELS = {
    facebook: "Auf Facebook teilen",
    linkedin: "Auf LinkedIn teilen",
    x: "Auf X teilen",
    whatsapp: "Per WhatsApp teilen",
    copy: "In die Zwischenablage kopieren",
    heading: "Teilen",
};

afterEach(() => {
    vi.unstubAllGlobals();
    // Remove any share/clipboard we attached to the real navigator.
    delete (navigator as unknown as {share?: unknown}).share;
});

describe("ShareButton", () => {
    it("uses navigator.share when available", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        (navigator as Navigator & {share?: unknown}).share = share;
        const onShared = vi.fn();

        render(<ShareButton {...PROPS} onShared={onShared} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() => expect(onShared).toHaveBeenCalledWith("shared"));
        // #1939 — URL folded into `text`, no separate `url` field.
        expect(share).toHaveBeenCalledWith({
            text: `${PROPS.text} ${PROPS.url}`,
        });
    });

    // #1939 — iOS/WebKit drops the `text` field when a separate `url` is
    // present and shares only the link, so the recipient sees just the app
    // name. Fold the URL into `text` (like the clipboard + intent paths) so
    // the message survives on every platform. The single self-contained text
    // must carry BOTH the caller's text and the URL.
    it("folds the URL into the shared text so it survives iOS's text-drop", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        (navigator as Navigator & {share?: unknown}).share = share;

        render(<ShareButton {...PROPS} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
        const payload = share.mock.calls[0][0] as ShareData;
        expect(payload.text).toBe(`${PROPS.text} ${PROPS.url}`);
        // No separate `url` field a link-preview target could share alone.
        expect(payload.url).toBeUndefined();
    });

    it("falls back to the clipboard when navigator.share is absent", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", {clipboard: {writeText}});
        const onShared = vi.fn();

        render(<ShareButton {...PROPS} onShared={onShared} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() => expect(onShared).toHaveBeenCalledWith("copied"));
        expect(writeText).toHaveBeenCalledWith(`${PROPS.text} ${PROPS.url}`);
    });

    it("reports 'unavailable' when neither share nor clipboard works", async () => {
        vi.stubGlobal("navigator", {});
        const onShared = vi.fn();

        render(<ShareButton {...PROPS} onShared={onShared} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() =>
            expect(onShared).toHaveBeenCalledWith("unavailable"),
        );
    });

    it("reports 'cancelled' when the user dismisses the share sheet", async () => {
        const share = vi
            .fn()
            .mockRejectedValue(new DOMException("dismissed", "AbortError"));
        (navigator as Navigator & {share?: unknown}).share = share;
        const onShared = vi.fn();

        render(<ShareButton {...PROPS} onShared={onShared} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() => expect(onShared).toHaveBeenCalledWith("cancelled"));
    });

    it("renders the provided label", () => {
        render(<ShareButton {...PROPS} />);
        expect(screen.getByTestId("share-button")).toHaveTextContent("Share");
    });

    describe("desktop fallback menu (no navigator.share, menuLabels given)", () => {
        it("opens a share menu with FB/LinkedIn/X/WhatsApp links + Copy", async () => {
            vi.stubGlobal("navigator", {clipboard: {writeText: vi.fn()}});
            render(<ShareButton {...PROPS} menuLabels={MENU_LABELS} />);

            fireEvent.click(screen.getByTestId("share-button"));

            const fb = await screen.findByTestId("share-button-facebook");
            expect(fb).toHaveAttribute(
                "href",
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PROPS.url)}`,
            );
            expect(fb).toHaveAttribute("target", "_blank");
            expect(fb).toHaveAttribute("rel", "noopener noreferrer");
            expect(screen.getByTestId("share-button-linkedin")).toHaveAttribute(
                "href",
                `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(PROPS.url)}`,
            );
            expect(screen.getByTestId("share-button-x")).toHaveAttribute(
                "href",
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${PROPS.text} ${PROPS.url}`)}`,
            );
            expect(screen.getByTestId("share-button-whatsapp")).toHaveAttribute(
                "href",
                `https://wa.me/?text=${encodeURIComponent(`${PROPS.text} ${PROPS.url}`)}`,
            );
            expect(screen.getByTestId("share-button-copy")).toBeInTheDocument();
            // No Instagram button in the desktop fallback.
            expect(
                screen.queryByTestId("share-button-instagram"),
            ).not.toBeInTheDocument();
        });

        it("copies the text via the menu's Copy item", async () => {
            const writeText = vi.fn().mockResolvedValue(undefined);
            vi.stubGlobal("navigator", {clipboard: {writeText}});
            const onShared = vi.fn();
            render(
                <ShareButton
                    {...PROPS}
                    menuLabels={MENU_LABELS}
                    onShared={onShared}
                />,
            );

            fireEvent.click(screen.getByTestId("share-button"));
            fireEvent.click(await screen.findByTestId("share-button-copy"));

            await waitFor(() =>
                expect(onShared).toHaveBeenCalledWith("copied"),
            );
            expect(writeText).toHaveBeenCalledWith(`${PROPS.text} ${PROPS.url}`);
        });

        it("reports 'shared' and closes when a platform link is chosen", async () => {
            vi.stubGlobal("navigator", {clipboard: {writeText: vi.fn()}});
            const onShared = vi.fn();
            render(
                <ShareButton
                    {...PROPS}
                    menuLabels={MENU_LABELS}
                    onShared={onShared}
                />,
            );

            fireEvent.click(screen.getByTestId("share-button"));
            const wa = await screen.findByTestId("share-button-whatsapp");
            // Don't let happy-dom attempt a real navigation.
            wa.addEventListener("click", (e) => e.preventDefault());
            fireEvent.click(wa);

            await waitFor(() => expect(onShared).toHaveBeenCalledWith("shared"));
            await waitFor(() =>
                expect(
                    screen.queryByTestId("share-button-copy"),
                ).not.toBeInTheDocument(),
            );
        });

        it("moves focus between items with the arrow keys", async () => {
            vi.stubGlobal("navigator", {clipboard: {writeText: vi.fn()}});
            render(<ShareButton {...PROPS} menuLabels={MENU_LABELS} />);

            fireEvent.click(screen.getByTestId("share-button"));
            const fb = await screen.findByTestId("share-button-facebook");
            await waitFor(() => expect(fb).toHaveFocus());

            fireEvent.keyDown(screen.getByTestId("share-button-menu"), {
                key: "ArrowDown",
            });
            expect(screen.getByTestId("share-button-linkedin")).toHaveFocus();

            fireEvent.keyDown(screen.getByTestId("share-button-menu"), {
                key: "End",
            });
            expect(screen.getByTestId("share-button-copy")).toHaveFocus();

            fireEvent.keyDown(screen.getByTestId("share-button-menu"), {
                key: "ArrowDown",
            });
            expect(screen.getByTestId("share-button-facebook")).toHaveFocus();
        });

        it("closes the menu on Escape", async () => {
            vi.stubGlobal("navigator", {clipboard: {writeText: vi.fn()}});
            render(<ShareButton {...PROPS} menuLabels={MENU_LABELS} />);

            fireEvent.click(screen.getByTestId("share-button"));
            await screen.findByTestId("share-button-copy");

            fireEvent.keyDown(document, {key: "Escape"});

            await waitFor(() =>
                expect(
                    screen.queryByTestId("share-button-copy"),
                ).not.toBeInTheDocument(),
            );
        });

        it("uses navigator.share (not the menu) when the native API exists", async () => {
            const share = vi.fn().mockResolvedValue(undefined);
            (navigator as Navigator & {share?: unknown}).share = share;
            render(<ShareButton {...PROPS} menuLabels={MENU_LABELS} />);

            fireEvent.click(screen.getByTestId("share-button"));

            await waitFor(() =>
                expect(share).toHaveBeenCalledWith({
                    text: `${PROPS.text} ${PROPS.url}`,
                }),
            );
            expect(
                screen.queryByTestId("share-button-copy"),
            ).not.toBeInTheDocument();
        });
    });
});
