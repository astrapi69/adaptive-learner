/**
 * Sync conflict resolution dialog (Phase 13D + 13E).
 *
 * Surfaces when the SyncEngine receives one or more mutable-row
 * conflicts during sync. For each conflict the user picks:
 *
 *   - Keep local       (this device's version wins)
 *   - Keep remote      (the other device's version wins)
 *   - Merge            (manually edit a side-by-side merge)
 *   - Smart Merge      (only when an AI provider is configured;
 *                       the AI receives both versions and
 *                       proposes a merged record the user
 *                       confirms or edits)
 *
 * Smart Merge ALWAYS asks for confirmation. The AI suggestion
 * is never written automatically — the user has to explicitly
 * "Apply" the AI's merge.
 *
 * Default pre-selection: "remote" — the spec calls this
 * "Last-Write-Wins as default" for the manual case but we lean
 * to remote because the user just initiated a sync and the
 * remote is what they're trying to pull in. The user can flip
 * any conflict individually.
 */

import {useEffect, useState} from "react";

import {Button} from "@/components/ui/button";
import {ApiError} from "../../api/client";
import {useI18n} from "../../hooks/ui/useI18n";
import {extractJsonObject} from "../../lib/extract-json";
import {readLearnerState} from "../../lib/learnerState";
import {getStorage} from "../../storage";
import {getDb} from "../../storage/dexie/db";
import {aiComplete, resolveModel} from "../../storage/ai/ai-providers";
import type {
    ConflictBundle,
    ConflictChoice,
    ConflictResolution,
} from "../../storage/sync/sync-engine";
import {notify} from "../../utils/notify";
import type {AIProvider} from "../../lib/constants";

interface DialogProps {
    conflicts: ConflictBundle[];
    onResolve: (decisions: ConflictResolution[]) => void;
    onCancel: () => void;
}

interface PerConflictState {
    chosen: ConflictChoice;
    merged: Record<string, unknown>;
    aiBusy: boolean;
    aiAvailable: boolean | null;
}

const SMART_MERGE_SYSTEM_PROMPT = [
    "You are a data-merge assistant for a learning app. The user has",
    "two versions of the same database row, one from each device. Your",
    "job is to propose ONE merged row that preserves the intent of",
    "both edits.",
    "",
    "OUTPUT FORMAT (MUST follow exactly):",
    "1. Your response MUST start with the character `{` and end with `}`.",
    "2. NO text before the opening `{`. No 'Here is', 'Sure', 'I'll merge'.",
    "3. NO text after the closing `}`. No explanations of your choices.",
    "4. NO markdown code fences (no ``` or ```json).",
    "5. NO comments inside the JSON.",
    "6. The JSON must contain every column the input rows have, with no",
    "   extra keys.",
    "",
    "Failure to follow these rules breaks the calling system.",
    "",
    "MERGE RULES:",
    "- For text fields: pick whichever side carries the more recent",
    "  or more specific content. If both sides changed substantively,",
    "  concatenate with a space.",
    "- For boolean fields: prefer the version most aligned with the",
    "  conversation; default to the locally-edited side when in doubt.",
    "- For numeric fields: prefer the more recent timestamp; for",
    "  counts/scores prefer the higher value.",
    "- Never invent fields. Every output key must appear in at least",
    "  one input row.",
    "- Preserve the 'id' from either input (they are identical).",
    "",
    "REMINDER: start your response with `{`. End with `}`. Nothing else.",
].join("\n");

export default function SyncConflictDialog({
    conflicts,
    onResolve,
    onCancel,
}: DialogProps) {
    const {t} = useI18n();
    const [states, setStates] = useState<PerConflictState[]>(() =>
        conflicts.map((c) => ({
            chosen: "remote",
            merged: c.remote,
            aiBusy: false,
            aiAvailable: null,
        })),
    );

    // WCAG SC 2.1.2 (No Keyboard Trap): close on Escape.
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onCancel();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onCancel]);

    // Probe for an AI provider once on mount.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const available = await aiProviderAvailable();
            if (cancelled) return;
            setStates((prev) =>
                prev.map((s) => ({...s, aiAvailable: available})),
            );
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    function updateState(idx: number, patch: Partial<PerConflictState>) {
        setStates((prev) =>
            prev.map((s, i) => (i === idx ? {...s, ...patch} : s)),
        );
    }

    async function runSmartMerge(idx: number) {
        const conflict = conflicts[idx];
        updateState(idx, {aiBusy: true});
        try {
            const merged = await smartMerge(conflict);
            updateState(idx, {
                chosen: "merged",
                merged,
                aiBusy: false,
            });
            notify.success(
                t("sync.smart_merge_ready"),
            );
        } catch (err) {
            updateState(idx, {aiBusy: false});
            const detail =
                err instanceof ApiError
                    ? err.detail
                    : err instanceof Error
                      ? err.message
                      : t("sync.smart_merge_error");
            notify.error(detail);
        }
    }

    function buildResolutions(): ConflictResolution[] {
        return conflicts.map((c, i) => {
            const s = states[i];
            return {
                table: c.table,
                id: c.id,
                chosen: s.chosen,
                merged_data:
                    s.chosen === "merged"
                        ? s.merged
                        : s.chosen === "remote"
                          ? c.remote
                          : undefined,
            };
        });
    }

    function handleApply() {
        onResolve(buildResolutions());
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            data-testid="sync-conflict-dialog"
            style={{
                position: "fixed",
                inset: 0,
                background: "var(--bg-overlay)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
            }}
        >
            <div
                style={{
                    background: "var(--bg)",
                    color: "var(--text)",
                    borderRadius: 8,
                    maxWidth: 1000,
                    width: "100%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    padding: "1.5rem",
                }}
            >
                <h2 style={{marginTop: 0}}>
                    {t("sync.conflicts_title")}{" "}
                    ({conflicts.length})
                </h2>
                <p className="muted">
                    {t("sync.conflicts_intro")}
                </p>
                {conflicts.map((c, idx) => (
                    <ConflictRow
                        key={`${c.table}-${c.id}`}
                        index={idx}
                        conflict={c}
                        state={states[idx]}
                        onChoose={(chosen) => updateState(idx, {chosen})}
                        onMergeFieldEdit={(field, value) =>
                            updateState(idx, {
                                merged: {...states[idx].merged, [field]: value},
                            })
                        }
                        onSmartMerge={() => runSmartMerge(idx)}
                        t={t}
                    />
                ))}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.5rem",
                        marginTop: "1.5rem",
                    }}
                >
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        data-testid="sync-conflict-cancel"
                    >
                        {t("sync.conflict_cancel")}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleApply}
                        data-testid="sync-conflict-apply"
                    >
                        {t("sync.conflict_apply")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ConflictRow({
    index,
    conflict,
    state,
    onChoose,
    onMergeFieldEdit,
    onSmartMerge,
    t,
}: {
    index: number;
    conflict: ConflictBundle;
    state: PerConflictState;
    onChoose: (chosen: ConflictChoice) => void;
    onMergeFieldEdit: (field: string, value: unknown) => void;
    onSmartMerge: () => void;
    t: (k: string, fb?: string) => string;
}) {
    const fields = mergedFieldList(conflict);
    return (
        <div
            data-testid={`sync-conflict-${index}`}
            style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "1rem",
                marginBottom: "1rem",
                background: "var(--surface)",
            }}
        >
            <header style={{marginBottom: "0.5rem"}}>
                <strong>{conflict.table}</strong>{" "}
                <small style={{opacity: 0.6}}>#{conflict.id.slice(0, 8)}…</small>
            </header>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                }}
            >
                <ColumnCard
                    title={t("sync.local_version")}
                    record={conflict.local}
                    fields={fields}
                    highlightAgainst={conflict.remote}
                />
                <ColumnCard
                    title={t("sync.remote_version")}
                    record={conflict.remote}
                    fields={fields}
                    highlightAgainst={conflict.local}
                />
            </div>
            <fieldset
                style={{
                    border: "none",
                    padding: 0,
                    marginTop: "0.75rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                }}
            >
                <Choice
                    label={t("sync.keep_local")}
                    value="local"
                    selected={state.chosen}
                    onSelect={onChoose}
                    name={`conflict-${index}`}
                    testid={`sync-conflict-${index}-local`}
                />
                <Choice
                    label={t("sync.keep_remote")}
                    value="remote"
                    selected={state.chosen}
                    onSelect={onChoose}
                    name={`conflict-${index}`}
                    testid={`sync-conflict-${index}-remote`}
                />
                <Choice
                    label={t("sync.merge")}
                    value="merged"
                    selected={state.chosen}
                    onSelect={onChoose}
                    name={`conflict-${index}`}
                    testid={`sync-conflict-${index}-merged`}
                />
                {state.aiAvailable === true && (
                    <Button
                        type="button"
                        onClick={onSmartMerge}
                        disabled={state.aiBusy}
                        variant="secondary"
                        data-testid={`sync-conflict-${index}-smart`}
                        style={{marginLeft: "auto"}}
                    >
                        {state.aiBusy
                            ? t("sync.smart_merge_running")
                            : t("sync.smart_merge")}
                    </Button>
                )}
            </fieldset>
            {state.chosen === "merged" && (
                <MergeEditor
                    fields={fields}
                    merged={state.merged}
                    onEdit={onMergeFieldEdit}
                    t={t}
                />
            )}
        </div>
    );
}

function ColumnCard({
    title,
    record,
    fields,
    highlightAgainst,
}: {
    title: string;
    record: Record<string, unknown>;
    fields: string[];
    highlightAgainst: Record<string, unknown>;
}) {
    return (
        <div
            style={{
                background: "var(--bg)",
                borderRadius: 4,
                padding: "0.5rem 0.75rem",
                fontSize: "0.85rem",
            }}
        >
            <h3 style={{margin: "0 0 0.25rem", fontSize: "0.95rem"}}>{title}</h3>
            <dl style={{margin: 0}}>
                {fields.map((f) => {
                    const value = record[f];
                    const otherValue = highlightAgainst[f];
                    const differs = !isEqual(value, otherValue);
                    return (
                        <div key={f} style={{marginBottom: "0.15rem"}}>
                            <dt
                                style={{
                                    fontWeight: 600,
                                    display: "inline",
                                    opacity: 0.7,
                                }}
                            >
                                {f}:
                            </dt>{" "}
                            <dd
                                style={{
                                    display: "inline",
                                    margin: 0,
                                    background: differs
                                        ? "color-mix(in srgb, var(--warning) 15%, transparent)"
                                        : undefined,
                                    padding: differs ? "0 2px" : undefined,
                                    borderRadius: 2,
                                }}
                            >
                                {renderValue(value)}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </div>
    );
}

function MergeEditor({
    fields,
    merged,
    onEdit,
    t,
}: {
    fields: string[];
    merged: Record<string, unknown>;
    onEdit: (field: string, value: unknown) => void;
    t: (k: string, fb?: string) => string;
}) {
    return (
        <div
            data-testid="merge-editor"
            style={{
                marginTop: "0.75rem",
                background: "var(--bg)",
                borderRadius: 4,
                padding: "0.5rem 0.75rem",
            }}
        >
            <small style={{opacity: 0.7}}>
                {t("sync.merge_editor")}
            </small>
            {fields.map((f) => {
                if (f === "id" || f.endsWith("_at") || f === "user_id") {
                    return (
                        <div key={f} style={{fontSize: "0.85rem"}}>
                            <strong>{f}:</strong> {renderValue(merged[f])}
                        </div>
                    );
                }
                const value = merged[f];
                if (typeof value === "boolean") {
                    return (
                        <label
                            key={f}
                            style={{
                                display: "block",
                                fontSize: "0.85rem",
                                margin: "0.25rem 0",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) =>
                                    onEdit(f, e.target.checked)
                                }
                                data-testid={`merge-field-${f}`}
                            />{" "}
                            {f}
                        </label>
                    );
                }
                if (typeof value === "number") {
                    return (
                        <label
                            key={f}
                            style={{
                                display: "block",
                                fontSize: "0.85rem",
                                margin: "0.25rem 0",
                            }}
                        >
                            <span>{f}:</span>{" "}
                            <input
                                type="number"
                                value={value}
                                onChange={(e) =>
                                    onEdit(
                                        f,
                                        parseFloat(e.target.value) || 0,
                                    )
                                }
                                data-testid={`merge-field-${f}`}
                                style={{width: 100}}
                            />
                        </label>
                    );
                }
                const text = value === null || value === undefined ? "" : String(value);
                return (
                    <label
                        key={f}
                        style={{
                            display: "block",
                            fontSize: "0.85rem",
                            margin: "0.25rem 0",
                        }}
                    >
                        <span style={{display: "block", opacity: 0.7}}>
                            {f}:
                        </span>
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => onEdit(f, e.target.value)}
                            data-testid={`merge-field-${f}`}
                            style={{
                                width: "100%",
                                padding: "0.25rem 0.4rem",
                                background: "var(--surface)",
                                color: "var(--text)",
                                border: "1px solid var(--border)",
                                borderRadius: 3,
                            }}
                        />
                    </label>
                );
            })}
        </div>
    );
}

function Choice({
    label,
    value,
    selected,
    onSelect,
    name,
    testid,
}: {
    label: string;
    value: ConflictChoice;
    selected: ConflictChoice;
    onSelect: (value: ConflictChoice) => void;
    name: string;
    testid: string;
}) {
    return (
        <label style={{display: "flex", gap: "0.25rem", alignItems: "center"}}>
            <input
                type="radio"
                name={name}
                value={value}
                checked={selected === value}
                onChange={() => onSelect(value)}
                data-testid={testid}
            />
            <span>{label}</span>
        </label>
    );
}

// ---- AI merge --------------------------------------------------------

export async function smartMerge(
    conflict: ConflictBundle,
): Promise<Record<string, unknown>> {
    const {userId} = readLearnerState();
    if (!userId) {
        throw new ApiError(401, "No active user", "/sync/smart-merge", "POST");
    }
    const settings = await getStorage().settings.get(userId);
    const provider = settings.active_provider as AIProvider;
    const apiKey = await readApiKeyFor(userId, provider);
    if (!apiKey) {
        throw new ApiError(
            400,
            "No API key configured for the active AI provider.",
            "/sync/smart-merge",
            "POST",
        );
    }
    const modelOverride =
        provider === "anthropic"
            ? settings.model_override_anthropic
            : provider === "openai"
              ? settings.model_override_openai
              : settings.model_override_gemini;
    const userContent =
        `Table: ${conflict.table}\n` +
        `Record id: ${conflict.id}\n\n` +
        `Local version (this device):\n${JSON.stringify(conflict.local, null, 2)}\n\n` +
        `Remote version (other device):\n${JSON.stringify(conflict.remote, null, 2)}\n\n` +
        `Return only the merged JSON. No surrounding prose.`;
    const raw = await aiComplete({
        provider,
        model: resolveModel(provider, modelOverride),
        apiKey,
        messages: [
            {role: "system", content: SMART_MERGE_SYSTEM_PROMPT},
            {role: "user", content: userContent},
        ],
        maxTokens: 1024,
    });
    return parseMergeResponse(raw, conflict);
}

export function parseMergeResponse(
    raw: string | null,
    conflict: ConflictBundle,
): Record<string, unknown> {
    if (typeof raw !== "string" || raw.trim() === "") {
        throw new ApiError(
            502,
            "Smart merge returned empty content",
            "/sync/smart-merge",
            "POST",
        );
    }
    const merged = extractJsonObject(raw);
    if (merged === null) {
        throw new ApiError(
            502,
            "Smart merge response was not valid JSON",
            "/sync/smart-merge",
            "POST",
        );
    }
    // Force-preserve ``id`` so the resolver writes to the right row.
    merged.id = conflict.id;
    return merged;
}

async function aiProviderAvailable(): Promise<boolean> {
    try {
        const {userId} = readLearnerState();
        if (!userId) return false;
        const settings = await getStorage().settings.get(userId);
        const provider = settings.active_provider as AIProvider;
        const apiKey = await readApiKeyFor(userId, provider);
        return Boolean(apiKey);
    } catch {
        return false;
    }
}

async function readApiKeyFor(
    userId: string,
    provider: AIProvider,
): Promise<string | null> {
    try {
        const db = getDb();
        const row = await db.userSettings
            .where("user_id")
            .equals(userId)
            .first();
        if (!row) return null;
        if (provider === "anthropic") return row.api_key_anthropic ?? null;
        if (provider === "openai") return row.api_key_openai ?? null;
        if (provider === "gemini") return row.api_key_gemini ?? null;
        return null;
    } catch {
        return null;
    }
}

// ---- Helpers ---------------------------------------------------------

function mergedFieldList(conflict: ConflictBundle): string[] {
    const keys = new Set<string>([
        ...Object.keys(conflict.local),
        ...Object.keys(conflict.remote),
    ]);
    return Array.from(keys).sort();
}

function isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) {
        return a === b;
    }
    if (typeof a !== typeof b) return false;
    return JSON.stringify(a) === JSON.stringify(b);
}

function renderValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
}
