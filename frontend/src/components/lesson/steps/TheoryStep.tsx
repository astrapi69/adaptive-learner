/**
 * One theory step of the lesson viewer (extracted from Lesson.tsx,
 * #404).
 *
 * The authored content (Markdown body, code blocks, tables, worked
 * examples, external example link) renders through {@link TheoryBody},
 * which the runner shell shares for borrowed theory steps (#3224). What
 * this component adds is the lesson's own chrome around it: the per-step
 * read-aloud button driving the shared lesson TTS engine, step-anchor
 * links routed back to the viewer, and the Ask-AI panel.
 */

import { useMemo } from "react";
import { Square, Volume2 } from "lucide-react";

import AskAiPanel from "../ask/AskAiPanel";
import TheoryBody from "./TheoryBody";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { ReadAloudController } from "../../../hooks/lesson/audio/useReadAloud";
import type { ContentLessonExample } from "../../../storage/types";
import { markdownToSpeech } from "../../../lib/lesson/tts-text";

interface TheoryStepProps {
  body: string;
  /** Stable id of this theory step (keys the engine's active read). */
  stepId: string;
  /** TTS feature C2 - lesson target language for read-aloud. */
  ttsLang?: string | null;
  /** TTS feature C5 - the shared lesson read-aloud engine, so the
   *  theory button drives it (manual + auto both emit boundaries)
   *  and the follow-along highlight can track the spoken word. */
  tts: ReadAloudController;
  lessonRewriteFn: (body: string) => string;
  onAnchorClick: (stepId: string) => void;
  /** Schema v1.4 (#139) - optional external example link. */
  exampleUrl?: string | null;
  exampleLabel?: string | null;
  /** Schema v1.5 (#1326) - optional inline worked examples rendered under
   *  the body (text or syntax-highlighted code). Distinct from the
   *  ``example_url`` external-link variant; the two may coexist. */
  examples?: ContentLessonExample[] | null;
}

interface TheoryReadAloudProps {
  body: string;
  stepId: string;
  ttsLang: string | null;
  tts: ReadAloudController;
}

/**
 * The per-step read-aloud button. #147 - read-aloud only plays audio; the
 * panel keeps its rendered Markdown formatting (it used to swap to a
 * plain-text follow-along while speaking). Returns null when the step has
 * nothing to read or TTS is off.
 */
function TheoryReadAloud({ body, stepId, ttsLang, tts }: TheoryReadAloudProps) {
  const { t } = useI18n();
  // Plain-text projection of the body for read-aloud (markdown
  // syntax + code blocks stripped).
  const speechText = useMemo(() => markdownToSpeech(body), [body]);
  const utteranceId = `theory-${stepId}`;
  const isReading = tts.speaking && tts.activeId === utteranceId;
  if (!tts.enabled || !ttsLang || speechText.length === 0) return null;
  const readLabel = isReading
    ? t("lesson.tts.stop", "Stop")
    : t("lesson.tts.read_aloud", "Read aloud");
  return (
    <div className="lesson-theory-tts">
      <button
        type="button"
        className={`read-aloud-button${isReading ? " is-speaking" : ""}`}
        data-testid="read-aloud-theory"
        data-speaking={isReading ? "true" : "false"}
        aria-label={readLabel}
        onClick={() =>
          isReading ? tts.stop() : tts.speak(speechText, { lang: ttsLang, id: utteranceId })
        }
      >
        <span className="read-aloud-button__icon" aria-hidden="true">
          {isReading ? <Square size={14} /> : <Volume2 size={14} />}
        </span>
        <span className="read-aloud-button__label">{readLabel}</span>
      </button>
    </div>
  );
}

export default function TheoryStep({
  body,
  stepId,
  ttsLang = null,
  tts,
  lessonRewriteFn,
  onAnchorClick,
  exampleUrl = null,
  exampleLabel = null,
  examples = null,
}: TheoryStepProps) {
  return (
    <TheoryBody
      testId="lesson-theory-body"
      body={body}
      rewrite={lessonRewriteFn}
      onAnchorClick={onAnchorClick}
      exampleUrl={exampleUrl}
      exampleLabel={exampleLabel}
      examples={examples}
      leading={<TheoryReadAloud body={body} stepId={stepId} ttsLang={ttsLang} tts={tts} />}
      trailing={
        // #1321 - deepen this theory block via the existing BYOK AI path.
        // Self-gating: only shown with an AI key, discreet hint otherwise.
        <AskAiPanel
          context={{ kind: "theory", blockText: body, targetLanguage: ttsLang }}
          testId="ask-ai-theory"
        />
      }
    />
  );
}
