/**
 * Subject-name display i18n (data-i18n).
 *
 * Subjects are seeded with their canonical English ``name`` in the DB —
 * there is no slug/key column (see
 * ``backend/app/services/subjects_seed.py``), so the display
 * translation keys off a deterministic normalization of that English
 * name. The ``subjects.*`` catalog section holds one entry per
 * translatable name; proper nouns (Python, JavaScript, React, ...) and
 * any user-created custom subject carry no entry and fall back to the
 * raw name in every language.
 *
 * Matching/scoring stays on the raw English name (see ``subjectSuggest``);
 * only the rendered label is translated.
 */

type Translate = (key: string, fallback?: string) => string;

/**
 * Normalize a subject name to its ``subjects.*`` catalog key:
 * lowercase, non-alphanumeric runs collapsed to ``_``, edges trimmed.
 * Mirrors the keys generated for ``backend/config/i18n/*.yaml``.
 */
export function subjectNameKey(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

/**
 * Translate a single subject name, falling back to the raw name when
 * no catalog entry exists (proper nouns, custom subjects).
 */
export function translateSubjectName(name: string, t: Translate): string {
    const key = subjectNameKey(name);
    if (!key) return name;
    return t(`subjects.${key}`, name);
}

/**
 * Translate a ``"A > B > C"`` subject path (as built by
 * ``subjectSuggest.buildPath``) segment by segment. Subject names never
 * contain ``" > "``, so the split is unambiguous.
 */
export function translateSubjectPath(path: string, t: Translate): string {
    return path
        .split(" > ")
        .map((segment) => translateSubjectName(segment, t))
        .join(" > ");
}
