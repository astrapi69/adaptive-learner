/**
 * Local (Dexie-mode) assessment logic — Phase 10C.
 *
 * Ports the backend ``adaptive_learner_assessment`` plugin so the
 * GH Pages build doesn't need the backend reachable for
 * onboarding. Two surfaces:
 *
 *   - ``questionsForLang(lang)`` mirrors the plugin's
 *     ``questions_for_lang`` resolver: 12 questions with the
 *     ``text`` field resolved against the bundled DE/EN/ES/FR/EL
 *     translations.
 *   - ``calculateProfile(answers)`` mirrors ``calculate_profile``:
 *     same multi-select normalisation, same per-method
 *     totals/num_questions, same 4-decimal rounding.
 *
 * Both functions read from ``assessment-questions.json`` (the
 * exported QUESTIONS list); the data is shared verbatim with the
 * backend so the Dexie + API modes produce identical results.
 *
 * Cross-mode consistency is verified by an integration test that
 * runs the same fixture against both ``apiStorage`` (via mocked
 * fetch) and ``dexieStorage`` and asserts byte-identical
 * profiles.
 */

import type {AssessmentAnswer, AssessmentQuestion} from "../../types/domain";
import type {LearningMethod} from "../../lib/constants";
import {LEARNING_METHODS} from "../../lib/constants";
import QUESTIONS_RAW from "../../data/assessment-questions.json";

interface QuestionRaw {
    id: string;
    type?: "single" | "multi";
    text_de?: string;
    text_en: string;
    text_es?: string;
    text_fr?: string;
    text_el?: string;
    answers: AnswerRaw[];
}

interface AnswerRaw {
    id: string;
    text_de?: string;
    text_en: string;
    text_es?: string;
    text_fr?: string;
    text_el?: string;
    weights: Partial<Record<LearningMethod, number>>;
}

const QUESTIONS = QUESTIONS_RAW as QuestionRaw[];

const LANG_TO_KEY: Record<string, keyof QuestionRaw> = {
    de: "text_de",
    en: "text_en",
    es: "text_es",
    fr: "text_fr",
    el: "text_el",
};

function textKey(lang: string): keyof QuestionRaw {
    for (const prefix in LANG_TO_KEY) {
        if (lang.startsWith(prefix)) return LANG_TO_KEY[prefix];
    }
    return "text_en";
}

/**
 * Resolve the 12-question pack for ``lang`` into the same shape
 * the backend ``/questions`` endpoint returns. Unknown languages
 * fall back to English silently — matches the backend.
 */
export function questionsForLang(lang: string): AssessmentQuestion[] {
    const key = textKey(lang);
    const answerKey = key as keyof AnswerRaw;
    return QUESTIONS.map((q) => {
        const qText = (q[key] as string | undefined) ?? q.text_en;
        return {
            id: q.id,
            type: q.type ?? "single",
            text: qText,
            answers: q.answers.map((a): AssessmentAnswer => {
                const aText = (a[answerKey] as string | undefined) ?? a.text_en;
                return {
                    id: a.id,
                    text: aText,
                    weights: {...a.weights},
                };
            }),
        };
    });
}

interface AnswerInput {
    question_id: string;
    answer_id?: string;
    answer_ids?: string[];
}

/**
 * Aggregate per-answer weights into a 6-method profile, mirroring
 * the backend ``calculate_profile`` exactly. Multi-select picks
 * split their weight equally; single-select wraps to a 1-element
 * list. Last-write-wins on duplicate question ids.
 */
export function calculateProfile(
    answers: AnswerInput[],
): Record<LearningMethod, number> {
    const numQuestions = QUESTIONS.length;
    const lookup = new Map<string, Map<string, Partial<Record<LearningMethod, number>>>>();
    for (const q of QUESTIONS) {
        const byAns = new Map<string, Partial<Record<LearningMethod, number>>>();
        for (const a of q.answers) {
            byAns.set(a.id, {...a.weights});
        }
        lookup.set(q.id, byAns);
    }

    const totals: Record<LearningMethod, number> = {
        deductive: 0,
        inductive: 0,
        error_based: 0,
        dialogic: 0,
        contextual: 0,
        ai_adaptive: 0,
    };

    const byQid = new Map<string, string[]>();
    for (const ans of answers) {
        if (typeof ans.question_id !== "string") continue;
        let aids: string[] = [];
        if (Array.isArray(ans.answer_ids)) {
            aids = ans.answer_ids.filter((x): x is string => typeof x === "string");
        } else if (typeof ans.answer_id === "string") {
            aids = [ans.answer_id];
        }
        if (aids.length > 0) byQid.set(ans.question_id, aids);
    }

    for (const [qid, aids] of byQid) {
        const n = aids.length;
        if (n === 0) continue;
        const ansMap = lookup.get(qid);
        if (!ansMap) continue;
        for (const aid of aids) {
            const weights = ansMap.get(aid);
            if (!weights) continue;
            for (const method of LEARNING_METHODS) {
                const w = weights[method];
                if (typeof w === "number") {
                    totals[method] += w / n;
                }
            }
        }
    }

    if (numQuestions === 0) {
        return {
            deductive: 0,
            inductive: 0,
            error_based: 0,
            dialogic: 0,
            contextual: 0,
            ai_adaptive: 0,
        };
    }

    const out = {} as Record<LearningMethod, number>;
    for (const method of LEARNING_METHODS) {
        const raw = totals[method] / numQuestions;
        const clamped = Math.min(1, Math.max(0, raw));
        out[method] = Math.round(clamped * 10000) / 10000;
    }
    return out;
}

/**
 * Dominant-method tie-broken alphabetically (matches
 * ``LearningProfile.dominant_method`` on the backend).
 */
export function dominantMethod(
    weights: Record<LearningMethod, number>,
): LearningMethod {
    const sorted = [...LEARNING_METHODS].sort();
    let best: LearningMethod = sorted[0];
    let bestVal = -Infinity;
    for (const m of sorted) {
        if (weights[m] > bestVal) {
            best = m;
            bestVal = weights[m];
        }
    }
    return best;
}
