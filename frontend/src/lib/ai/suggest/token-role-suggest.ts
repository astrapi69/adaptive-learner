/**
 * Token-role suggestions for the card editor (#3072, EXP-021).
 *
 * `Card.token_roles` shipped in v1.35.0 (Phase 52I / P-130) as a schema
 * field plus its readers - the cloze generator, the error classifier, the
 * exercise pool and the correction source card all consult it. Nothing
 * ever wrote it, so the cloze generator's self-described highest-fidelity
 * path has never fired. This module produces the proposals the author
 * confirms or changes; it never writes anything itself.
 *
 * ## What it suggests, and what it deliberately does not
 *
 * ONLY the closed word classes: `article` and `preposition`. Those are
 * finite, enumerable sets, so a match here is a lookup, not a guess.
 *
 * The open classes (`noun`, `verb`, `adjective`) and the morpheme markers
 * (`gender_marker`, `tense_marker`) get NO suggestion. There is no parser,
 * and the cost of being wrong is not symmetric: the cloze generator draws
 * a same-role distractor pool from whichever role it finds, so a
 * confidently mislabelled token produces worse exercises than an
 * unannotated one. The author can still set any of the seven roles by
 * hand - the UI offers the full enum, this module just declines to guess.
 *
 * A word that belongs to two classes in the same language (Portuguese
 * "a" is both the feminine article and the preposition "to") is skipped
 * for the same reason: picking one would be a coin flip.
 *
 * ## The verbatim-slice contract
 *
 * The schema states that `token` is a verbatim slice of the card's
 * `front`, with no whitespace normalisation, because the generator
 * matches it against the wrong-answer key recorded by the SRS layer. So
 * matching is case-insensitive but the returned token keeps its ORIGINAL
 * casing, and {@link isVerbatimSlice} is the check the editor gates on.
 *
 * @example
 * suggestTokenRoles("Der Hund in dem Garten", "de")
 * // [{token: "Der", role: "article"}, {token: "in", role: "preposition"},
 * //  {token: "dem", role: "article"}]
 */

import type {ContentLessonCardTokenRoleName} from "../../../storage/types";

/** One proposal; the author confirms, changes or drops it. */
export interface TokenRoleSuggestion {
    /** Verbatim slice of the card's front, original casing. */
    token: string;
    role: ContentLessonCardTokenRoleName;
}

/**
 * `Card.token_roles` carries `maxItems: 10` in the lesson schema. Pinned
 * by a test so a schema bump surfaces here instead of at write time.
 */
export const MAX_TOKEN_ROLES = 10;

/**
 * Closed word classes per language, lower-cased. Kept small and
 * high-signal, the same discipline as the language detector's keyword
 * lists: a wrong entry here becomes a wrong suggestion on every card.
 *
 * Turkish carries an empty `article` list on purpose - the language has
 * no definite article - while its postpositions qualify as prepositions
 * for this field's purpose.
 */
const CLOSED_CLASSES: Record<
    string,
    {article: readonly string[]; preposition: readonly string[]}
> = {
    de: {
        article: [
            "der", "die", "das", "den", "dem", "des",
            "ein", "eine", "einen", "einem", "einer", "eines",
        ],
        preposition: [
            "in", "an", "auf", "mit", "von", "zu", "für", "über", "unter",
            "bei", "nach", "aus", "um", "durch", "ohne", "gegen", "vor",
            "hinter", "neben", "zwischen", "seit", "bis",
        ],
    },
    en: {
        article: ["the", "a", "an"],
        preposition: [
            "in", "on", "at", "with", "from", "to", "of", "about", "under",
            "over", "by", "into", "through", "without", "against",
            "between", "before", "after",
        ],
    },
    es: {
        article: ["el", "la", "los", "las", "un", "una", "unos", "unas"],
        preposition: [
            "de", "en", "a", "con", "por", "para", "sin", "sobre", "entre",
            "hasta", "desde", "hacia", "contra",
        ],
    },
    fr: {
        article: ["le", "la", "les", "un", "une", "des"],
        preposition: [
            "de", "à", "en", "dans", "sur", "avec", "pour", "sans", "sous",
            "chez", "par", "vers", "entre",
        ],
    },
    it: {
        article: ["il", "lo", "la", "i", "gli", "le", "un", "uno", "una"],
        preposition: ["di", "a", "da", "in", "con", "su", "per", "tra", "fra"],
    },
    pt: {
        article: ["o", "a", "os", "as", "um", "uma", "uns", "umas"],
        preposition: [
            "de", "em", "a", "com", "por", "para", "sem", "sobre", "entre",
            "até", "desde",
        ],
    },
    tr: {
        article: [],
        preposition: [
            "ile", "için", "gibi", "kadar", "göre", "sonra", "önce",
            "doğru", "karşı",
        ],
    },
};

/** Strip the punctuation a token may be wrapped in, keeping the core. */
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function baseLanguage(code: string): string {
    return (code || "").split("-")[0].toLowerCase();
}

/**
 * Is `token` a literal substring of `front`?
 *
 * The editor gates saving on this: a token the generator cannot find in
 * the front can never match at read time, so storing it would create a
 * silently inert annotation.
 */
export function isVerbatimSlice(token: string, front: string): boolean {
    if (!token.trim()) return false;
    return front.includes(token);
}

/**
 * Propose `{token, role}` pairs for the closed word classes found in
 * `front`, in the order they appear.
 *
 * Returns an empty list when the language has no list, when nothing
 * matches, or when every match is ambiguous. Repeated tokens are
 * annotated once, and the result never exceeds {@link MAX_TOKEN_ROLES}.
 */
export function suggestTokenRoles(
    front: string,
    lang: string,
): TokenRoleSuggestion[] {
    const classes = CLOSED_CLASSES[baseLanguage(lang)];
    if (!classes || !front.trim()) return [];

    const articles = new Set(classes.article);
    const prepositions = new Set(classes.preposition);

    const out: TokenRoleSuggestion[] = [];
    const seen = new Set<string>();

    for (const raw of front.split(/\s+/)) {
        if (out.length >= MAX_TOKEN_ROLES) break;
        const token = raw.replace(EDGE_PUNCTUATION, "");
        if (!token) continue;

        const key = token.toLowerCase();
        if (seen.has(key)) continue;

        const isArticle = articles.has(key);
        const isPreposition = prepositions.has(key);
        // Both or neither: no honest single answer, so no proposal.
        if (isArticle === isPreposition) continue;

        seen.add(key);
        out.push({token, role: isArticle ? "article" : "preposition"});
    }

    return out;
}
