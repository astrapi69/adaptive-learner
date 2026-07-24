/**
 * assistant-ui Phase 3a (#1126): Voice parity. The dictation button lives
 * inside the composer (so ``useComposerRuntime`` resolves and ``setText`` wires
 * the transcript into the draft), and the read-aloud button is a settled-only
 * assistant-bubble action. Web Speech is device-only (per quality-checks the
 * live dictation/synthesis is a manual gate), so here we only force the
 * support-detection seams to true and assert the mic control mounts inside the
 * composer WITHOUT crashing — i.e. ComposerMic resolved the composer runtime.
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        session: {streamMessage: vi.fn(), getMessages: () => Promise.resolve([])},
    }),
}));

// Force STT support so MicButton renders (happy-dom has no SpeechRecognition).
vi.mock("../../../lib/voice/speech-recognition", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    isSpeechRecognitionSupported: () => true,
}));

import AssistantUiThread from "./AssistantUiThread";

describe("AssistantUiThread voice parity (Phase 3a, #1126)", () => {
    it("mounts the dictation control inside the composer runtime context", () => {
        // ComposerMic calls useComposerRuntime(); if it were mounted outside a
        // composer context this render would throw. Reaching the assertion
        // proves the mic is wired to the composer.
        render(<AssistantUiThread sessionId="sess-1" />);
        expect(
            screen.getByTestId("mic-button-session-input"),
        ).toBeInTheDocument();
    });
});
