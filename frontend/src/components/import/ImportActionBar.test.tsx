/**
 * #1158 — the tutor-session entry (start AND continue) must be gated on a
 * usable AI key. Before the fix only NEW sessions were gated; "Continue
 * session" was clickable without a key and led into a dead /session that only
 * error-toasts (a FUNKTION-NICHT-VERFUEGBAR violation). These pins assert both
 * doors are disabled-with-tooltip when the session feature is gated off, and
 * active when it isn't.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ImportActionBar from "./ImportActionBar";
import type { ConversationAnalysisResult, LearningSession } from "../../types/domain";

const t = (_key: string, fallback?: string) => fallback ?? _key;

const ANALYSIS = {} as ConversationAnalysisResult;

const ACTIVE_SESSION: LearningSession = {
  id: "sess-1",
  project_id: "p-1",
  method: "deductive",
  started_at: "2026-06-26T00:00:00Z",
  ended_at: null,
  cycle_step: 1,
  status: "active",
};

const ACTIVE_FEATURE = { isActive: true, isDisabled: false };
const GATED_FEATURE = {
  isActive: false,
  isDisabled: true,
  reason: "api_key_required",
};

function renderBar(overrides: Record<string, unknown> = {}) {
  const onSession = vi.fn();
  const props = {
    t,
    online: true,
    analysis: ANALYSIS,
    analyzing: false,
    analyzeFeature: ACTIVE_FEATURE,
    onAnalyze: vi.fn(),
    creatingCurriculum: false,
    existingCurriculum: null,
    onCurriculum: vi.fn(),
    onSaveLesson: vi.fn(),
    sessionFeature: ACTIVE_FEATURE,
    startingSession: false,
    activeSession: null,
    onSession,
    ankiFeature: ACTIVE_FEATURE,
    extractingAnki: false,
    onExtractAnki: vi.fn(),
    ...overrides,
  };
  render(<ImportActionBar {...(props as any)} />);
  return { onSession };
}

describe("ImportActionBar — tutor-session key gate (#1158)", () => {
  it("repro: continue-session disabled with tooltip when no AI key", () => {
    renderBar({ activeSession: ACTIVE_SESSION, sessionFeature: GATED_FEATURE });
    const btn = screen.getByTestId("continue-session-button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toBeTruthy();
    expect(btn.getAttribute("title")).toMatch(/API key/i);
  });

  it("happy: continue-session active + clickable when a key is present", async () => {
    const { onSession } = renderBar({
      activeSession: ACTIVE_SESSION,
      sessionFeature: ACTIVE_FEATURE,
    });
    const btn = screen.getByTestId("continue-session-button");
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute("title")).toBeNull();
    await userEvent.click(btn);
    expect(onSession).toHaveBeenCalledTimes(1);
  });

  it("parity: start-session (new) is also gated when no AI key", () => {
    renderBar({ activeSession: null, sessionFeature: GATED_FEATURE });
    const btn = screen.getByTestId("start-session-button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/API key/i);
  });

  it("regression: the gate fires regardless of activeSession (both doors)", () => {
    // The root-cause bug exempted the activeSession (continue) path from the
    // gate. Assert the disabled state is identical whether or not a session
    // is active — i.e. the gate no longer depends on activeSession.
    const { rerender } = (() => {
      const r = render(<DisabledBar activeSession={null} />);
      return { rerender: r.rerender };
    })();
    expect(screen.getByTestId("start-session-button")).toBeDisabled();
    rerender(<DisabledBar activeSession={ACTIVE_SESSION} />);
    expect(screen.getByTestId("continue-session-button")).toBeDisabled();
  });
});

/** Helper component fixing every prop except activeSession, gated off. */
function DisabledBar({ activeSession }: { activeSession: LearningSession | null }) {
  const props = {
    t,
    online: true,
    analysis: ANALYSIS,
    analyzing: false,
    analyzeFeature: ACTIVE_FEATURE,
    onAnalyze: vi.fn(),
    creatingCurriculum: false,
    existingCurriculum: null,
    onCurriculum: vi.fn(),
    onSaveLesson: vi.fn(),
    sessionFeature: GATED_FEATURE,
    startingSession: false,
    activeSession,
    onSession: vi.fn(),
    ankiFeature: ACTIVE_FEATURE,
    extractingAnki: false,
    onExtractAnki: vi.fn(),
  };
  return <ImportActionBar {...(props as any)} />;
}
