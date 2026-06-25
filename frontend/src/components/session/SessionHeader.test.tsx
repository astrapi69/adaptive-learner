/**
 * #1141 — the session header topic line shows the imported chat's topic
 * (topicOverride) for an imported session, falling back to the project topic.
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import SessionHeader from "./SessionHeader";
import type {LearningProject, LearningSession} from "../../types";

// Help sub-components need the Help context; render them inert here.
vi.mock("../help/HelpLink", () => ({default: () => null}));
vi.mock("../help/HelpTooltip", () => ({default: () => null}));

const t = (_key: string, fallback = "") => fallback;

const SESSION = {
    id: "s1",
    project_id: "p1",
    method: "deductive",
    started_at: "2026-06-25T00:00:00Z",
    ended_at: null,
    cycle_step: 1,
    status: "active",
    imported_conversation_id: "conv1",
} as unknown as LearningSession;

const PROJECT = {id: "p1", topic: "My learning"} as unknown as LearningProject;

function renderHeader(topicOverride?: string | null) {
    return render(
        <SessionHeader
            session={SESSION}
            project={PROJECT}
            userSettings={null}
            activeModelInfo={null}
            stepEvaluation={null}
            topicOverride={topicOverride}
            t={t}
        />,
    );
}

describe("SessionHeader topic line (#1141)", () => {
    it("shows the imported topic override instead of the project topic", () => {
        renderHeader("Reflexive Verben");
        const line = screen.getByTestId("session-header-topic");
        expect(line.textContent).toContain("Reflexive Verben");
        expect(line.textContent).not.toContain("My learning");
    });

    it("falls back to the project topic when no override is given", () => {
        renderHeader(null);
        expect(screen.getByTestId("session-header-topic").textContent).toContain(
            "My learning",
        );
    });
});
