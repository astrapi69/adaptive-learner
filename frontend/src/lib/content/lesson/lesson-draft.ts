/**
 * Lesson Creator draft persistence (Phase 65B / EXP-021).
 *
 * Auto-saves the in-progress lesson to localStorage so a closed
 * tab / reload never loses the user's work. One draft slot; cleared
 * on successful save or explicit discard.
 */

import {isKnownContentDomain} from "../content-domains";

export const LESSON_DRAFT_KEY = "adaptive-learner.lesson-draft";

/** Step-1 metadata. Lives here (not in the page component) so the
 *  draft module and the page can share the type without a circular
 *  import. */
export interface LessonMeta {
    title: string;
    titleNative: string;
    sourceLanguage: string;
    targetLanguage: string;
    level: string;
    description: string;
    author: string;
    /** Content domain (#1716). ``"language"`` (default) authors a
     *  source→target language lesson; any {@link KNOWN_CONTENT_DOMAINS}
     *  value authors knowledge content — a single content language
     *  (source == target) with an optional level-less shape. Threaded into
     *  the built lesson's ``domain`` field by the draft/book/extension
     *  builders. */
    domain: string;
}

export interface LessonCardDraft {
    id: string;
    front: string;
    back: string;
    notes: string;
    image: string;
    /** Example sentence that drives cloze + word-tiles generation (#1847).
     *  For cloze the sentence must contain the ``front`` term (so it can be
     *  blanked out); for word-tiles it needs at least two words. Separate
     *  from ``notes`` (a teaching aid) so the generation input is explicit
     *  and discoverable. Optional for backward compatibility with pre-#1847
     *  drafts; the loader normalises it to ``""``. */
    example?: string;
    /** Additional accepted answers for the generated free-text exercise
     *  (#1797). ``back`` stays the canonical answer; these are extra
     *  variants the learner may type. Optional for backward compatibility
     *  with pre-#1797 drafts; the loader normalises it to ``[]``. */
    altAnswers?: string[];
}

export interface LessonDraft {
    schema: 1;
    step: number;
    meta: LessonMeta;
    cards: LessonCardDraft[];
    updatedAt: string;
}

/**
 * Apply a single Step-1 field edit to the lesson metadata, keeping the
 * language pair + level coherent with the content domain (#1716).
 *
 * A NON-language domain authors knowledge content: a single content
 * language (source == target, which the validators allow) with an optional
 * level-less shape. So:
 *  - switching INTO a knowledge domain collapses the pair (source := target)
 *    and clears the level to the level-less shape;
 *  - switching back to the language domain restores a CEFR default when the
 *    level was left empty;
 *  - editing either language while a knowledge domain is active mirrors the
 *    edit across the pair so the single content language stays in sync.
 *
 * Pure: returns a new object, never mutates ``meta``.
 */
export function updateMetaField(
    meta: LessonMeta,
    key: keyof LessonMeta,
    value: string,
): LessonMeta {
    const next: LessonMeta = {...meta, [key]: value};
    const knowledge = isKnownContentDomain(next.domain);
    if (key === "domain") {
        if (knowledge) {
            next.sourceLanguage = next.targetLanguage;
            next.level = "";
        } else if (meta.level === "") {
            next.level = "A1";
        }
    } else if (
        knowledge &&
        (key === "targetLanguage" || key === "sourceLanguage")
    ) {
        next.sourceLanguage = value;
        next.targetLanguage = value;
    }
    return next;
}

let _idSeq = 0;

/** Stable-ish id for a new card (sortable key + React key). */
export function newCardId(): string {
    _idSeq += 1;
    return `card-${Date.now().toString(36)}-${_idSeq}`;
}

/** A blank card draft with a fresh id and empty fields. */
export function emptyCard(): LessonCardDraft {
    return {
        id: newCardId(),
        front: "",
        back: "",
        notes: "",
        image: "",
        example: "",
        altAnswers: [],
    };
}

/** Persist the in-progress draft to localStorage, stamping a fresh
 *  ``updatedAt``. Best-effort: a storage failure is swallowed (drafting
 *  is non-critical). */
export function saveLessonDraft(draft: LessonDraft): void {
    try {
        localStorage.setItem(
            LESSON_DRAFT_KEY,
            JSON.stringify({...draft, updatedAt: new Date().toISOString()}),
        );
    } catch {
        /* storage full / unavailable — drafting is best-effort */
    }
}

/** Load + defensively validate a stored draft. Returns null when no
 *  draft exists or the stored shape is unusable. */
export function loadLessonDraft(): LessonDraft | null {
    let raw: string | null;
    try {
        raw = localStorage.getItem(LESSON_DRAFT_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<LessonDraft>;
        if (!parsed || typeof parsed !== "object" || !parsed.meta) return null;
        const meta = parsed.meta as Partial<LessonMeta>;
        if (typeof meta.title !== "string") return null;
        const cards = Array.isArray(parsed.cards)
            ? (parsed.cards as LessonCardDraft[]).filter(
                  (c) => c && typeof c.front === "string",
              )
            : [];
        const domain =
            typeof meta.domain === "string" && meta.domain.trim()
                ? meta.domain
                : "language";
        const sourceLanguage = meta.sourceLanguage ?? "en";
        let targetLanguage = meta.targetLanguage ?? "fr";
        // #1716 — a same-language pair is INTENTIONAL for a knowledge
        // (non-language) domain (a single content language), so only repair
        // an equal LANGUAGE-domain pair. A language lesson with an equal
        // pair would otherwise leave Step 1 unadvanceable (the language-pair
        // gate never clears); repair it to a sane different default.
        if (targetLanguage === sourceLanguage && domain === "language") {
            targetLanguage = sourceLanguage === "en" ? "fr" : "en";
        }
        return {
            schema: 1,
            step: typeof parsed.step === "number" ? parsed.step : 1,
            meta: {
                title: meta.title ?? "",
                titleNative: meta.titleNative ?? "",
                sourceLanguage,
                targetLanguage,
                level: meta.level ?? "A1",
                description: meta.description ?? "",
                author: meta.author ?? "",
                domain,
            },
            cards: cards.map((c) => ({
                id: c.id || newCardId(),
                front: c.front ?? "",
                back: c.back ?? "",
                notes: c.notes ?? "",
                image: c.image ?? "",
                example: c.example ?? "",
                altAnswers: Array.isArray(c.altAnswers)
                    ? c.altAnswers.filter((a): a is string => typeof a === "string")
                    : [],
            })),
            updatedAt: parsed.updatedAt ?? new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

/** Remove the stored draft (on successful save or explicit discard). */
export function clearLessonDraft(): void {
    try {
        localStorage.removeItem(LESSON_DRAFT_KEY);
    } catch {
        /* ignore */
    }
}

/** True when the draft carries anything worth restoring. */
export function draftHasContent(draft: LessonDraft | null): boolean {
    if (!draft) return false;
    return (
        draft.meta.title.trim().length > 0 ||
        draft.meta.description.trim().length > 0 ||
        draft.cards.length > 0
    );
}
