import ReadAloudButton from "../../lesson/tts/ReadAloudButton";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";

interface ExercisePromptRowProps {
    /** The exercise prompt (rendered as inline markdown). */
    prompt: string;
    /** TTS language; when set (and not in code mode) a read-aloud button shows. */
    ttsLang?: string | null;
    /** Code-mode exercises suppress the read-aloud button. */
    codeMode?: boolean;
    /** Stable test id applied to both the prompt paragraph and the TTS button. */
    testId: string;
}

/**
 * Prompt header shared by the exercise renderers: the markdown prompt plus an
 * optional read-aloud button (shown only when a TTS language is set and the
 * exercise is not in code mode).
 *
 * Extracted from the individual renderers so each renderer's component
 * function stays below the cyclomatic-complexity gate (#884 / #885) and the
 * identical prompt-row markup is not duplicated five times.
 *
 * @example
 * <ExercisePromptRow prompt={exercise.prompt ?? ""} ttsLang={ttsLang} testId="free-text-prompt" />
 */
export default function ExercisePromptRow({
    prompt,
    ttsLang = null,
    codeMode = false,
    testId,
}: ExercisePromptRowProps) {
    return (
        <div className="exercise-prompt-row">
            <p className="m-0 font-medium" data-testid={testId}>
                <InlineMarkdown>{prompt}</InlineMarkdown>
            </p>
            {ttsLang && !codeMode && (
                <ReadAloudButton text={prompt} lang={ttsLang} testId={testId} />
            )}
        </div>
    );
}
