/**
 * LessonTtsMiniPlayer — floating read-aloud player (TTS C8).
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {I18nProvider} from "../../hooks/useI18n";
import LessonTtsMiniPlayer from "./LessonTtsMiniPlayer";

function renderPlayer(
    overrides: Partial<React.ComponentProps<typeof LessonTtsMiniPlayer>> = {},
) {
    const props = {
        paused: false,
        position: 2,
        total: 4,
        hasPrev: true,
        hasNext: true,
        onPrev: vi.fn(),
        onPlayPause: vi.fn(),
        onNext: vi.fn(),
        onStop: vi.fn(),
        ...overrides,
    };
    render(
        <I18nProvider>
            <LessonTtsMiniPlayer {...props} />
        </I18nProvider>,
    );
    return props;
}

describe("LessonTtsMiniPlayer", () => {
    it("renders the transport controls + step position", () => {
        renderPlayer();
        expect(screen.getByTestId("lesson-tts-player")).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-tts-player-prev"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-tts-player-playpause"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-tts-player-next"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("lesson-tts-player-pos").textContent).toMatch(
            /2.*4/,
        );
    });

    it("wires prev / next / play-pause / stop callbacks", () => {
        const props = renderPlayer();
        fireEvent.click(screen.getByTestId("lesson-tts-player-prev"));
        fireEvent.click(screen.getByTestId("lesson-tts-player-next"));
        fireEvent.click(screen.getByTestId("lesson-tts-player-playpause"));
        fireEvent.click(screen.getByTestId("lesson-tts-player-stop"));
        expect(props.onPrev).toHaveBeenCalledTimes(1);
        expect(props.onNext).toHaveBeenCalledTimes(1);
        expect(props.onPlayPause).toHaveBeenCalledTimes(1);
        expect(props.onStop).toHaveBeenCalledTimes(1);
    });

    it("disables prev/next at the block edges", () => {
        renderPlayer({hasPrev: false, hasNext: false});
        expect(screen.getByTestId("lesson-tts-player-prev")).toBeDisabled();
        expect(screen.getByTestId("lesson-tts-player-next")).toBeDisabled();
    });

    it("reflects the paused state on the play/pause control", () => {
        renderPlayer({paused: true});
        expect(
            screen
                .getByTestId("lesson-tts-player-playpause")
                .getAttribute("aria-pressed"),
        ).toBe("true");
    });
});
