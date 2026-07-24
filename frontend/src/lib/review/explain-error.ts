/**
 * review/explain-error — turn a tracked error into a short, rule-based
 * explanation (#599), reusing the existing ``classifyError`` tags (no
 * parallel classifier). Pure + i18n-free: returns the i18n key +
 * fallback so the UI localizes.
 *
 * The explanations are intentionally generic per pattern (article
 * gender by ending, spelling/accents, conjugation, word order) — enough
 * to nudge the learner toward the rule without per-card authoring.
 */

import {classifyError, type ErrorTag} from "../adaptive/error-classifier";
import type {ElementError} from "../../storage/types";

export interface ErrorExplanation {
    tag: ErrorTag;
    key: string;
    fallback: string;
}

const EXPLANATIONS: Record<ErrorTag, {key: string; fallback: string}> = {
    article_gender: {
        key: "review.explain_article_gender",
        fallback:
            "Watch the gender: nouns ending in -o are usually masculine (el/un), -a feminine (la/una). The article follows the ending.",
    },
    spelling_accent: {
        key: "review.explain_spelling_accent",
        fallback:
            "Check the exact spelling and accent marks - a small difference changes the word.",
    },
    verb_conjugation: {
        key: "review.explain_verb_conjugation",
        fallback:
            "Match the verb to its subject and tense before answering.",
    },
    word_order: {
        key: "review.explain_word_order",
        fallback: "Mind the word order for this structure.",
    },
};

/** Stable display order for the patterns. */
const ORDER: readonly ErrorTag[] = [
    "article_gender",
    "spelling_accent",
    "verb_conjugation",
    "word_order",
];

/** The single best explanation for one error, or null when no pattern matches. */
export function explainError(error: ElementError): ErrorExplanation | null {
    const tags = classifyError(error);
    for (const tag of ORDER) {
        if (tags.includes(tag)) return {tag, ...EXPLANATIONS[tag]};
    }
    return null;
}

/** Distinct explanations across a set of errors, in display order. */
export function explainErrors(
    errors: readonly ElementError[],
): ErrorExplanation[] {
    const tags = new Set<ErrorTag>();
    for (const error of errors) {
        for (const tag of classifyError(error)) tags.add(tag);
    }
    return ORDER.filter((tag) => tags.has(tag)).map((tag) => ({
        tag,
        ...EXPLANATIONS[tag],
    }));
}
