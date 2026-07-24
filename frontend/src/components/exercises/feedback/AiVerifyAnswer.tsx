/**
 * AiVerifyAnswer — "have the AI re-check my answer" for a wrongly-graded
 * free-text answer (#1798).
 *
 * Distinct from the block-level "Ask AI" panel (``AskAiPanel``, #1321), which
 * is a free-form Q&A about the exercise. This is a TARGETED second opinion:
 * it sends the exercise question, the learner's typed answer and the accepted
 * answers, and asks the configured BYOK provider whether the answer should
 * count as correct despite not matching the accept list. The verdict is
 * INFORMATIONAL — it is displayed but never changes the exercise result, so a
 * model hallucination cannot corrupt the grade.
 *
 * Reuses the existing browser-direct AI path (``resolveActiveAiProvider`` +
 * ``aiComplete``) — the same one Ask AI and exercise generation use, no
 * second integration. Without a key the button renders greyed-out
 * (``aria-disabled``, kept tappable on touch) with a BYOK hint popover, the
 * same discoverable pattern as Ask AI (#1443). Token-backed Tailwind only.
 */

import * as HoverCard from "@radix-ui/react-hover-card";
import {Check, Loader2, ScanSearch, Sparkles} from "lucide-react";
import {useState} from "react";
import {Link} from "react-router-dom";

import {useApiKeyStatus} from "../../../hooks/settings/useApiKeyStatus";
import {useI18n} from "../../../hooks/ui/useI18n";
import {
    buildVerifyMessages,
    parseVerifyVerdict,
    type VerifyResult,
} from "../../../lib/ai/verify/build-verify-prompt";
import {readLearnerState} from "../../../lib/learning/learnerState";
import {resolveActiveAiProvider} from "../../../lib/ai/providers/resolve-provider";
import {aiComplete} from "../../../storage/ai/ai-providers";

export interface AiVerifyAnswerProps {
    /** The exercise question the learner answered. */
    prompt: string;
    /** What the learner typed (and was marked wrong). */
    userAnswer: string;
    /** The authored accepted answers. */
    accept: readonly string[];
    /** BCP-47 code the lesson teaches, if known. */
    targetLanguage?: string | null;
    /** BCP-47 code the learner speaks, if known. */
    sourceLanguage?: string | null;
    /** Content domain, if known. */
    domain?: string | null;
    /** Test id prefix. */
    testId?: string;
}

const VERDICT_KEY: Record<VerifyResult["verdict"], string> = {
    yes: "lesson.exercise.free_text.ai_verify.verdict_yes",
    partial: "lesson.exercise.free_text.ai_verify.verdict_partial",
    no: "lesson.exercise.free_text.ai_verify.verdict_no",
    unknown: "lesson.exercise.free_text.ai_verify.verdict_unknown",
};

const VERDICT_FALLBACK: Record<VerifyResult["verdict"], string> = {
    yes: "The AI agrees: your answer is essentially correct.",
    partial: "The AI thinks your answer is only partly correct.",
    no: "The AI agrees the answer isn't right.",
    unknown: "The AI couldn't give a clear verdict.",
};

/** Border/text colour token per verdict — a "yes" reads as a (possible) win,
 *  the rest stay neutral so nothing looks like the score changed. */
const VERDICT_TONE: Record<VerifyResult["verdict"], string> = {
    yes: "border-[var(--exercise-correct)] text-[var(--exercise-correct)]",
    partial: "border-border text-fg-primary",
    no: "border-border text-fg-secondary",
    unknown: "border-border text-fg-secondary",
};

export default function AiVerifyAnswer({
    prompt,
    userAnswer,
    accept,
    targetLanguage = null,
    sourceLanguage = null,
    domain = null,
    testId = "ai-verify",
}: AiVerifyAnswerProps) {
    const {t, lang} = useI18n();
    const {ready, hasKey} = useApiKeyStatus();
    const [hintOpen, setHintOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Still resolving the key status — render nothing to avoid a flash.
    if (!ready) return null;

    // No AI key: the SAME button, greyed-out but tappable (aria-disabled, not
    // the disabled attribute), so a tap/hover/focus reveals the BYOK hint
    // instead of a dead tap-target. Clicking never fires an AI request.
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
                        className="inline-flex min-h-11 cursor-help items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-muted hover:bg-muted"
                        data-testid={`${testId}-disabled`}
                    >
                        <ScanSearch size={16} aria-hidden="true" />
                        {t("lesson.exercise.free_text.ai_verify.button", "Have the AI check")}
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
                                "lesson.exercise.free_text.ai_verify.no_key",
                                "This needs your own AI key (BYOK). Optional - the app works fine without it.",
                            )}
                        </p>
                        <Link
                            to="/settings?tab=ai"
                            className="mt-2 inline-block font-medium text-accent underline hover:opacity-90"
                            data-testid={`${testId}-settings-link`}
                        >
                            {t("lesson.exercise.free_text.ai_verify.open_settings", "AI settings")}
                        </Link>
                    </HoverCard.Content>
                </HoverCard.Portal>
            </HoverCard.Root>
        );
    }

    async function handleVerify() {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const {userId} = readLearnerState();
            const resolved = userId ? await resolveActiveAiProvider(userId) : null;
            if (!resolved) {
                setError(
                    t(
                        "lesson.exercise.free_text.ai_verify.no_key",
                        "This needs your own AI key (BYOK). Optional - the app works fine without it.",
                    ),
                );
                return;
            }
            const messages = buildVerifyMessages({
                prompt,
                userAnswer,
                acceptedAnswers: [...accept],
                uiLanguage: lang,
                targetLanguage,
                sourceLanguage,
                domain,
            });
            const reply = await aiComplete({
                provider: resolved.provider,
                model: resolved.model,
                apiKey: resolved.apiKey,
                messages,
                maxTokens: 512,
            });
            setResult(parseVerifyVerdict(reply));
        } catch (err) {
            setError(
                err instanceof Error && err.message
                    ? err.message
                    : t(
                          "lesson.exercise.free_text.ai_verify.error",
                          "The AI request failed. Please try again.",
                      ),
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex w-full flex-col gap-2">
            <button
                type="button"
                onClick={handleVerify}
                disabled={busy}
                className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted disabled:opacity-60"
                data-testid={`${testId}-button`}
            >
                {busy ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                    <ScanSearch size={16} aria-hidden="true" />
                )}
                {busy
                    ? t("lesson.exercise.free_text.ai_verify.checking", "Checking…")
                    : t("lesson.exercise.free_text.ai_verify.button", "Have the AI check")}
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

            {result && (
                <div
                    className={`rounded-md border bg-[var(--bg-surface)] p-3 ${VERDICT_TONE[result.verdict]}`}
                    role="status"
                    aria-live="polite"
                    data-testid={`${testId}-result`}
                    data-verdict={result.verdict}
                >
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {result.verdict === "yes" ? (
                            <Check size={16} aria-hidden="true" />
                        ) : (
                            <Sparkles size={16} aria-hidden="true" />
                        )}
                        {t(VERDICT_KEY[result.verdict], VERDICT_FALLBACK[result.verdict])}
                    </div>
                    {result.reason && (
                        <p
                            className="m-0 mt-1 whitespace-pre-wrap text-sm text-fg-secondary"
                            data-testid={`${testId}-reason`}
                        >
                            {result.reason}
                        </p>
                    )}
                    <p
                        className="m-0 mt-2 text-xs text-fg-muted"
                        data-testid={`${testId}-disclaimer`}
                    >
                        {t(
                            "lesson.exercise.free_text.ai_verify.disclaimer",
                            "This is only the AI's opinion - your score for this exercise is unchanged.",
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
