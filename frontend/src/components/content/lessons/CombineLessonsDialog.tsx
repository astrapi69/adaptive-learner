/**
 * Combine-into-a-set dialog (#1741).
 *
 * Opened from the "Meine Inhalte" selection mode: the learner has picked
 * several of their own sets and now chooses whether to group the gathered
 * lessons into a NEW own set (title + optional description + level) or to
 * append them to an EXISTING own set. Language/level are derived from the
 * selection and surfaced as a non-blocking hint (with a deviation warning
 * when the sources are not uniform). Pure presentational: the actual save
 * happens in the caller via {@link useCombineLessons}.
 */

import {useMemo, useState} from "react";

import {Button} from "@/components/ui/button";
import {CEFR_LEVELS} from "../../../lib/content/language/language-options";
import type {CombinedLanguages} from "../../../lib/content/lesson/combine-lessons";
import {useI18n} from "../../../hooks/ui/useI18n";
import type {ContentSetEntry} from "../../../storage/types";

/** What the dialog emits on confirm; the caller resolves the lessons. */
export type CombineDecision =
    | {mode: "new"; title: string; description: string; level: string}
    | {mode: "existing"; entry: ContentSetEntry};

interface CombineLessonsDialogProps {
    open: boolean;
    /** Number of selected source sets (for the summary line). */
    selectedCount: number;
    /** Derived languages/level + consistency, for the hint. */
    languages: CombinedLanguages;
    /** User sets that can be extended (the selected ones excluded). */
    existingTargets: ContentSetEntry[];
    combining: boolean;
    onCancel: () => void;
    onConfirm: (decision: CombineDecision) => void;
}

export default function CombineLessonsDialog({
    open,
    selectedCount,
    languages,
    existingTargets,
    combining,
    onCancel,
    onConfirm,
}: CombineLessonsDialogProps) {
    const {t} = useI18n();
    const hasExisting = existingTargets.length > 0;
    const [mode, setMode] = useState<"new" | "existing">("new");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [level, setLevel] = useState(languages.level);
    const [existingId, setExistingId] = useState(
        existingTargets[0]?.id ?? "",
    );

    // Re-seed the level default whenever the derived value changes (a new
    // selection re-opens the dialog with fresh sources).
    const seededLevel = useMemo(() => languages.level, [languages.level]);
    const effectiveLevel = level || seededLevel;

    const effectiveMode = hasExisting ? mode : "new";
    const canConfirm =
        !combining &&
        (effectiveMode === "new"
            ? title.trim().length > 0
            : existingId.length > 0);

    if (!open) return null;

    const submit = () => {
        if (!canConfirm) return;
        if (effectiveMode === "new") {
            onConfirm({
                mode: "new",
                title: title.trim(),
                description: description.trim(),
                level: effectiveLevel,
            });
            return;
        }
        const entry = existingTargets.find((e) => e.id === existingId);
        if (entry) onConfirm({mode: "existing", entry});
    };

    return (
        <div className="modal-overlay" data-testid="combine-lessons-dialog">
            <div
                className="modal-card flex flex-col gap-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="combine-lessons-title"
            >
                <h2 id="combine-lessons-title" className="modal-title">
                    {t("content.combine.title", "Combine into a set")}
                </h2>
                <p className="text-sm text-fg-muted">
                    {t(
                        "content.combine.summary",
                        "{n} selected lessons will be grouped into one set.",
                    ).replace("{n}", String(selectedCount))}
                </p>

                {!languages.consistent && (
                    <p
                        className="form-hint form-hint-warning"
                        data-testid="combine-lessons-mixed-hint"
                        role="status"
                    >
                        {t(
                            "content.combine.mixed_languages",
                            "The selected lessons differ in language or level. The new set uses the most common one ({lang}, {level}).",
                        )
                            .replace("{lang}", languages.targetLanguage)
                            .replace("{level}", languages.level)}
                    </p>
                )}

                <fieldset className="flex flex-col gap-2">
                    <legend className="sr-only">
                        {t("content.combine.target_legend", "Target set")}
                    </legend>
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="combine-mode"
                            value="new"
                            checked={effectiveMode === "new"}
                            onChange={() => setMode("new")}
                            data-testid="combine-mode-new"
                        />
                        {t("content.combine.mode_new", "New set")}
                    </label>
                    <label
                        className={
                            "flex items-center gap-2 " +
                            (hasExisting ? "" : "opacity-50")
                        }
                    >
                        <input
                            type="radio"
                            name="combine-mode"
                            value="existing"
                            checked={effectiveMode === "existing"}
                            disabled={!hasExisting}
                            onChange={() => setMode("existing")}
                            data-testid="combine-mode-existing"
                        />
                        {t("content.combine.mode_existing", "Add to an existing set")}
                    </label>
                </fieldset>

                {effectiveMode === "new" ? (
                    <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">
                                {t("content.combine.new_title", "Set title")}
                            </span>
                            <input
                                type="text"
                                className="rounded-md border border-border bg-card px-3 py-2"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                data-testid="combine-new-title"
                                placeholder={t(
                                    "content.combine.new_title_placeholder",
                                    "My combined set",
                                )}
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">
                                {t(
                                    "content.combine.new_description",
                                    "Description (optional)",
                                )}
                            </span>
                            <input
                                type="text"
                                className="rounded-md border border-border bg-card px-3 py-2"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                data-testid="combine-new-description"
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">
                                {t("content.combine.new_level", "Level")}
                            </span>
                            <select
                                className="rounded-md border border-border bg-card px-3 py-2"
                                value={effectiveLevel}
                                onChange={(e) => setLevel(e.target.value)}
                                data-testid="combine-new-level"
                            >
                                {CEFR_LEVELS.map((lvl) => (
                                    <option key={lvl} value={lvl}>
                                        {lvl}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                ) : (
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium">
                            {t("content.combine.existing_set", "Existing set")}
                        </span>
                        <select
                            className="rounded-md border border-border bg-card px-3 py-2"
                            value={existingId}
                            onChange={(e) => setExistingId(e.target.value)}
                            data-testid="combine-existing-select"
                        >
                            {existingTargets.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.title}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <p className="text-xs text-fg-muted">
                    {t(
                        "content.combine.keeps_originals",
                        "The original lessons are kept; this creates a grouped copy.",
                    )}
                </p>

                <div className="form-actions">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        data-testid="combine-cancel"
                    >
                        {t("common.cancel", "Cancel")}
                    </Button>
                    <Button
                        type="button"
                        disabled={!canConfirm}
                        onClick={submit}
                        data-testid="combine-confirm"
                    >
                        {combining
                            ? t("common.loading", "Loading…")
                            : t("content.combine.confirm", "Combine")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
