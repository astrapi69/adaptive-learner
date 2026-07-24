/**
 * assistant-ui Phase 4b-i (#1126): cycle-transition parity.
 *
 * The legacy SessionChat renders an inline "cycle_transition" card when the
 * auto-loop advances the session into a new cycle — carrying the cycle summary
 * and the next topic (real learning content, not chrome). The assistant-ui
 * thread has no ``messages`` array to inject that card into, so it appends the
 * SAME content as an inline assistant message (see AssistantUiThread). This pure
 * helper formats that content as markdown so it renders inline in the thread's
 * existing markdown pipeline, preserving the summary + next topic in the visible
 * conversation.
 */

import type {TopicTransitionVerdict} from "../../../types";

/** i18n translate signature (key + optional fallback). */
type Translate = (key: string, fallback?: string) => string;

/**
 * Format an auto-loop cycle transition as an inline markdown assistant turn:
 * a bold cycle label, the cycle summary, and (when present) the next topic.
 *
 * @param transition - The looped ``TopicTransitionVerdict`` from the exchange.
 * @param t - i18n translate function.
 *
 * @example
 * runtime.thread.append(formatCycleTransition(transition, t));
 */
export function formatCycleTransition(
    transition: TopicTransitionVerdict,
    t: Translate,
): string {
    const cycleLabel = t("session.cycle_label", "Cycle {n}").replace(
        "{n}",
        String(transition.new_cycle_count),
    );
    const lines = [`**${cycleLabel}**`, "", transition.summary];
    if (transition.next_topic) {
        lines.push(
            "",
            `**${t("session.next_topic", "Next topic:")}** ${transition.next_topic}`,
        );
    }
    return lines.join("\n");
}
