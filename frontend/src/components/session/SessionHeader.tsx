/**
 * Session page header (extracted from Session for the complexity
 * burn-down #400): the title, the cycle-counter / method / active-
 * provider chips, the optional topic line, and the CycleProgress bar.
 * Pure presentation; all state comes via props.
 */

import HelpLink from "../help/HelpLink";
import HelpTooltip from "../help/HelpTooltip";
import MethodBadge from "../MethodBadge";
import CycleProgress from "../CycleProgress";
import type {
    LearningProject,
    LearningSession,
    StepEvaluationVerdict,
    UserSettings,
} from "../../types";

type Translate = (key: string, fallback?: string) => string;

export interface ActiveModelInfo {
    id: string;
    name: string;
    contextWindow: number | null;
}

/** Human-readable context-window size ("128K tokens" / "1M tokens"). */
function formatContextWindowLabel(tokens: number): string {
    if (tokens >= 1_000_000) {
        const text = (tokens / 1_000_000).toFixed(1);
        return `${text.endsWith(".0") ? text.slice(0, -2) : text}M tokens`;
    }
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}K tokens`;
    return `${tokens} tokens`;
}

interface SessionHeaderProps {
    session: LearningSession;
    project: LearningProject | null;
    userSettings: UserSettings | null;
    activeModelInfo: ActiveModelInfo | null;
    stepEvaluation: StepEvaluationVerdict | null;
    t: Translate;
}

/** The session header: title + chips + topic + cycle progress. */
export default function SessionHeader({
    session,
    project,
    userSettings,
    activeModelInfo,
    stepEvaluation,
    t,
}: SessionHeaderProps) {
    return (
        <header className="session-header">
            <div className="session-header-row">
                <h1>
                    <HelpTooltip glossaryKey="learning_session">
                        {t("session.title", "Learning session")}
                    </HelpTooltip>
                    <HelpLink glossaryKey="learning_session" size={18} />
                </h1>
                <div className="session-header-chips">
                    {session.cycle_count && session.cycle_count > 1 && (
                        <span
                            className="cycle-counter-badge"
                            data-testid="session-cycle-counter"
                        >
                            {t("session.cycle_label", "Cycle {n}").replace(
                                "{n}",
                                String(session.cycle_count),
                            )}
                        </span>
                    )}
                    <MethodBadge method={session.method} />
                    <HelpLink glossaryKey={`method_${session.method}`} />
                    {userSettings && (
                        <span
                            className="provider-chip"
                            data-testid="session-active-provider"
                            title={
                                activeModelInfo
                                    ? `${activeModelInfo.id}${
                                          activeModelInfo.contextWindow
                                              ? ` · ${formatContextWindowLabel(
                                                    activeModelInfo.contextWindow,
                                                )}`
                                              : ""
                                      }`
                                    : t(
                                          `settings.provider_${userSettings.active_provider}`,
                                          userSettings.active_provider,
                                      )
                            }
                        >
                            {t(
                                `settings.provider_${userSettings.active_provider}`,
                                userSettings.active_provider,
                            )}
                            {activeModelInfo && (
                                <>
                                    :{" "}
                                    <span
                                        className="provider-chip-model"
                                        data-testid="session-active-model"
                                    >
                                        {activeModelInfo.name}
                                    </span>
                                </>
                            )}
                        </span>
                    )}
                </div>
            </div>
            {project?.topic && (
                <p
                    className="session-header-topic"
                    data-testid="session-header-topic"
                >
                    <span className="session-header-topic-label">
                        {t("session.topic_label", "Topic")}:
                    </span>
                    {project.topic}
                </p>
            )}
            <CycleProgress
                currentStep={session.cycle_step}
                evaluationReason={
                    stepEvaluation && !stepEvaluation.fallback_used
                        ? stepEvaluation.reason
                        : null
                }
            />
        </header>
    );
}
