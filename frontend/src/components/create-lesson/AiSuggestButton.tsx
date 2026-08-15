/**
 * AiSuggestButton — the "Mit KI vorschlagen" control that fills a converted
 * exercise's empty target field (EXP-050 Stage 4, #2511).
 *
 * A conversion (Stage 3) leaves the target field empty — a multiple-choice
 * question with no distractors, a cloze with no sentence, a
 * reading-comprehension with no passage. This button asks the author's BYOK
 * provider to draft that field via the pure ``suggest*`` helpers
 * (``lib/ai/suggest/exercise-suggest.ts``); the author then reviews and edits
 * the draft in the same inline editor before saving.
 *
 * Self-contained: it owns a {@link useExerciseSuggest} hook, so a field
 * component drops it in without threading a provider down. It mirrors
 * {@link AiVerifyAnswer}'s BYOK affordances — greyed-but-tappable with a
 * settings hint when no key is configured, a spinner while busy, an inline
 * error, and a "nothing usable came back" message when the quality gate drops
 * every suggestion (the "rather one fewer" discipline surfaced to the user).
 *
 * Presentational + generic: the parent passes ``run`` (the pure suggester bound
 * to the current exercise), ``isEmpty`` (so a null/empty result reads as "no
 * suggestions" rather than success), and ``onResult`` (applies the draft via
 * the field's ``onPatch``). Token-backed Tailwind only.
 */

import * as HoverCard from "@radix-ui/react-hover-card";
import {Loader2, Sparkles} from "lucide-react";
import {useState} from "react";
import {Link} from "react-router";

import {useExerciseSuggest} from "../../hooks/ai/useExerciseSuggest";
import {useI18n} from "../../hooks/ui/useI18n";
import type {AiProvider} from "../../lib/ai/generation/generate-exercises";

export interface AiSuggestButtonProps<T> {
    /** Bound pure suggester — receives the resolved provider. */
    run: (provider: AiProvider) => Promise<T>;
    /** True when the runner's result carries nothing usable ([] / null). */
    isEmpty: (result: T) => boolean;
    /** Apply a non-empty result to the field (via the field's onPatch). */
    onResult: (result: T) => void;
    /** Idle button label. */
    label: string;
    /** Message shown when the gate dropped every suggestion. */
    emptyLabel: string;
    /** Test id prefix; the button is ``${testId}-button``. */
    testId: string;
}

export default function AiSuggestButton<T>({
    run,
    isEmpty,
    onResult,
    label,
    emptyLabel,
    testId,
}: AiSuggestButtonProps<T>) {
    const {t} = useI18n();
    const {ready, hasKey, busy, error, suggest} = useExerciseSuggest();
    const [hintOpen, setHintOpen] = useState(false);
    const [empty, setEmpty] = useState(false);

    // Still resolving key status — render nothing to avoid a flash.
    if (!ready) return null;

    // No AI key: greyed-out but tappable (aria-disabled, not disabled), so a
    // tap/hover/focus reveals the BYOK hint instead of a dead tap-target.
    if (!hasKey) {
        const hintId = `${testId}-hint`;
        return (
            <HoverCard.Root
                open={hintOpen}
                onOpenChange={setHintOpen}
                openDelay={120}
                closeDelay={150}
            >
                <HoverCard.Trigger asChild>
                    <button
                        type="button"
                        aria-disabled="true"
                        aria-describedby={hintId}
                        onClick={(event) => event.preventDefault()}
                        className="inline-flex min-h-11 w-fit cursor-help items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-muted hover:bg-muted"
                        data-testid={`${testId}-disabled`}
                    >
                        <Sparkles size={16} aria-hidden="true" />
                        {label}
                    </button>
                </HoverCard.Trigger>
                <HoverCard.Portal forceMount>
                    <HoverCard.Content
                        forceMount
                        hidden={!hintOpen}
                        id={hintId}
                        sideOffset={6}
                        align="start"
                        className="z-[1100] max-w-xs rounded-md border border-border bg-[var(--bg-surface)] p-3 text-sm shadow-[var(--shadow-elevated)]"
                        data-testid={`${testId}-no-key`}
                    >
                        <p className="m-0 text-fg-primary">
                            {t(
                                "create_lesson.suggest.no_key",
                                "This needs your own AI key (BYOK). Add one under AI settings.",
                            )}
                        </p>
                        <Link
                            to="/settings?tab=ai"
                            className="mt-2 inline-block font-medium text-accent underline hover:opacity-90"
                            data-testid={`${testId}-settings-link`}
                        >
                            {t("create_lesson.suggest.open_settings", "AI settings")}
                        </Link>
                    </HoverCard.Content>
                </HoverCard.Portal>
            </HoverCard.Root>
        );
    }

    async function handleSuggest() {
        if (busy) return;
        setEmpty(false);
        const result = await suggest(run);
        if (result === null) return; // no key / error — hook set `error`
        if (isEmpty(result)) {
            setEmpty(true);
            return;
        }
        onResult(result);
    }

    return (
        <div className="flex flex-col gap-1.5">
            <button
                type="button"
                onClick={handleSuggest}
                disabled={busy}
                className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted disabled:opacity-60"
                data-testid={`${testId}-button`}
            >
                {busy ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                    <Sparkles size={16} aria-hidden="true" />
                )}
                {busy ? t("create_lesson.suggest.busy", "Suggesting…") : label}
            </button>

            {error && (
                <p
                    className="m-0 text-sm text-[var(--danger)]"
                    role="status"
                    aria-live="polite"
                    data-testid={`${testId}-error`}
                >
                    {error}
                </p>
            )}

            {empty && !error && (
                <p
                    className="m-0 text-sm text-fg-muted"
                    role="status"
                    aria-live="polite"
                    data-testid={`${testId}-empty`}
                >
                    {emptyLabel}
                </p>
            )}

            <p className="m-0 text-xs text-fg-muted" data-testid={`${testId}-disclaimer`}>
                {t(
                    "create_lesson.suggest.disclaimer",
                    "AI drafts — review and edit before saving.",
                )}
            </p>
        </div>
    );
}
