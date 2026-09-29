/**
 * The ENGINE half of every extension this app has adopted, in the shape
 * ``learn-content-engine/rules`` takes (#3222 PR 4): one entry per
 * ``SUPPORTED_EXTENSIONS`` type at the major the wizard pins, whose
 * ``validate`` runs the app's payload validator and turns its messages into
 * engine issues. Passed to ``validateLessonRules`` by the lesson funnel, so
 * the engine's extension contract (declared, registered, payload valid)
 * covers the adopted types with the app's own rules and nothing is
 * re-implemented on the app side.
 *
 * Adopting a new extension: register the renderer half, add the type to
 * ``SUPPORTED_EXTENSIONS`` and its payload validator here; the registry test
 * pins that the two lists are one set.
 *
 * @example
 * const { errors } = validateLessonRules(lesson, { extensions: APP_EXTENSION_REGISTRY });
 */
import type {
  ExerciseExtension,
  ExtensionRegistry,
  ValidationIssue,
} from "learn-content-engine";

import type { ContentLessonExercise } from "../../../storage/types";
import { audioChoicePayloadErrors } from "../../exercises/payload/audio-choice";
import { audioTilesPayloadErrors } from "../../exercises/payload/audio-tiles";
import { categorizationPayloadErrors } from "../../exercises/payload/categorization";
import { dictationPayloadErrors } from "../../exercises/payload/dictation";
import { errorCorrectionPayloadErrors } from "../../exercises/payload/error-correction";
import { gradedQuizPayloadErrors } from "../../exercises/payload/graded-quiz";
import { hotspotPayloadErrors } from "../../exercises/payload/hotspot";
import { imageDescriptionPayloadErrors } from "../../exercises/payload/image-description";
import { orderingPayloadErrors } from "../../exercises/payload/ordering";
import { parsonsPayloadErrors } from "../../exercises/payload/parsons";
import { readingComprehensionPayloadErrors } from "../../exercises/payload/reading-comprehension";
import { speakAndRecordPayloadErrors } from "../../exercises/payload/speak-and-record";

/** The major every adopted extension is pinned at (``ext:al-*@1``); the
 *  wizard writes the same number into ``requires_extensions``. */
export const EXTENSION_MAJOR = 1;

/** The rule id of an app payload finding. The engine's own ``ext:ref-*``
 *  extensions use their ids; this one names the source (the app's payload
 *  validator) so a consumer of the issue list can tell the two apart. */
const APP_EXT_PAYLOAD_RULE = "E-APP-EXT-PAYLOAD";

type PayloadValidator = (exercise: ContentLessonExercise) => string[];

const PAYLOAD_VALIDATORS: Readonly<Record<string, PayloadValidator>> = {
  "ext:al-categorization": categorizationPayloadErrors,
  "ext:al-error-correction": errorCorrectionPayloadErrors,
  "ext:al-reading-comprehension": readingComprehensionPayloadErrors,
  "ext:al-graded-quiz": gradedQuizPayloadErrors,
  "ext:al-dictation": dictationPayloadErrors,
  "ext:al-image-description": imageDescriptionPayloadErrors,
  "ext:al-speak-and-record": speakAndRecordPayloadErrors,
  "ext:al-audio-choice": audioChoicePayloadErrors,
  "ext:al-audio-tiles": audioTilesPayloadErrors,
  "ext:al-ordering": orderingPayloadErrors,
  "ext:al-parsons": parsonsPayloadErrors,
  "ext:al-hotspot": hotspotPayloadErrors,
};

function toExtension(type: string, validator: PayloadValidator): ExerciseExtension {
  return {
    type,
    major: EXTENSION_MAJOR,
    validate: (exercise): ValidationIssue[] =>
      validator(exercise as unknown as ContentLessonExercise).map((message) => ({
        id: APP_EXT_PAYLOAD_RULE,
        severity: "error",
        path: "",
        message,
        docAnchor: "extensions",
      })),
  };
}

/** The registry the lesson funnel hands to ``validateLessonRules``. */
export const APP_EXTENSION_REGISTRY: ExtensionRegistry = Object.entries(
  PAYLOAD_VALIDATORS,
).map(([type, validator]) => toExtension(type, validator));
