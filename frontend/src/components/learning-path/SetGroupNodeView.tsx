/**
 * SetGroupNodeView — the presentational core of a content-set group
 * node (Phase 66C / EXP-022). Pure + React-Flow-free so it tests
 * without the store; ``SetGroupNode`` registers it as a React Flow
 * group node type.
 *
 * Shows the set's title + language pair, a completed/total progress
 * bar, and a per-direction mastery summary. Collapsible: the header
 * toggles; collapsed hides the mastery line (and, at graph level, the
 * set's lessons — wired in 66E). Theme-token-driven; a subtle accent
 * tint marks the group without a hardcoded colour.
 */

import {ChevronDown, ChevronRight} from "lucide-react";

import {useI18n} from "../../hooks/useI18n";

export interface SetGroupNodeData {
    setId: string;
    title: string;
    sourceLanguage: string;
    targetLanguage: string;
    completed: number;
    total: number;
    receptiveMastered: number;
    productiveMastered: number;
    collapsed: boolean;
    [key: string]: unknown;
}

export interface SetGroupNodeViewProps {
    data: SetGroupNodeData;
    onToggle?: () => void;
}

export function SetGroupNodeView({data, onToggle}: SetGroupNodeViewProps) {
    const {t} = useI18n();
    const pct =
        data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

    return (
        <div
            className={`set-group${data.collapsed ? " is-collapsed" : ""}`}
            data-testid={`set-group-${data.setId}`}
            data-collapsed={data.collapsed ? "true" : "false"}
        >
            <button
                type="button"
                className="set-group-header"
                data-testid={`set-group-toggle-${data.setId}`}
                aria-expanded={!data.collapsed}
                onClick={() => onToggle?.()}
            >
                {data.collapsed ? (
                    <ChevronRight size={16} aria-hidden="true" />
                ) : (
                    <ChevronDown size={16} aria-hidden="true" />
                )}
                <span className="set-group-title">{data.title}</span>
                <span className="set-group-pair">
                    {data.sourceLanguage} → {data.targetLanguage}
                </span>
            </button>

            <div
                className="set-group-progress"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t(
                    "learning_path.group.progress_aria",
                    "{completed} of {total} lessons completed",
                )
                    .replace("{completed}", String(data.completed))
                    .replace("{total}", String(data.total))}
                data-testid={`set-group-progress-${data.setId}`}
            >
                <div
                    className="set-group-progress-fill"
                    style={{width: `${pct}%`}}
                    data-pct={pct}
                />
                <span className="set-group-progress-label">
                    {data.completed}/{data.total}
                </span>
            </div>

            {!data.collapsed && (
                <p
                    className="set-group-mastery muted"
                    data-testid={`set-group-mastery-${data.setId}`}
                >
                    {t(
                        "learning_path.group.mastery",
                        "{r} receptive, {p} productive mastered",
                    )
                        .replace("{r}", String(data.receptiveMastered))
                        .replace("{p}", String(data.productiveMastered))}
                </p>
            )}
        </div>
    );
}
