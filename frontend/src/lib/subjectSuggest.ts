/**
 * Subject fuzzy-matching for onboarding (Phase 22F).
 *
 * Given the user's free-text ``topic`` and the full subjects
 * tree, score each subject by how well it matches and return
 * the top-K candidates ordered by score (best first). The
 * scoring is intentionally simple:
 *
 *  - exact case-insensitive substring of topic → high score
 *  - words from the topic that match the subject name → +1
 *    per matched word
 *  - subject depth (parents) breaks ties so leaf nodes
 *    (specific topics) win over root categories
 *
 * Used by Onboarding to surface "Your topic looks like
 * 'Languages > Spanish > Grammar'" without forcing AI calls.
 */

import type {Subject} from "../types/domain";

export interface SubjectSuggestion {
    subject: Subject;
    score: number;
    /** Display label like "Languages > Spanish > Grammar". */
    path: string;
}

function tokens(value: string): string[] {
    return value
        .toLowerCase()
        .split(/[^a-zäöüßéèêíóúñ]+/u)
        .filter((token) => token.length >= 2);
}

function buildPath(
    subject: Subject,
    byId: Map<string, Subject>,
): string {
    const parts: string[] = [subject.name];
    let cursor: string | null | undefined = subject.parent_id;
    let safety = 16;
    while (cursor && safety-- > 0) {
        const parent = byId.get(cursor);
        if (!parent) break;
        parts.unshift(parent.name);
        cursor = parent.parent_id;
    }
    return parts.join(" > ");
}

function depth(subject: Subject, byId: Map<string, Subject>): number {
    let n = 0;
    let cursor: string | null | undefined = subject.parent_id;
    while (cursor && n < 16) {
        const parent = byId.get(cursor);
        if (!parent) break;
        n += 1;
        cursor = parent.parent_id;
    }
    return n;
}

export function suggestSubjects(
    topic: string,
    subjects: readonly Subject[],
    limit = 3,
): SubjectSuggestion[] {
    if (!topic.trim() || subjects.length === 0) return [];
    const lowerTopic = topic.toLowerCase();
    const topicTokens = new Set(tokens(topic));
    const byId = new Map(subjects.map((s) => [s.id, s]));

    const scored: SubjectSuggestion[] = [];
    for (const subject of subjects) {
        const name = subject.name.toLowerCase();
        let score = 0;
        if (lowerTopic.includes(name)) {
            score += 5;
        }
        const nameTokens = tokens(subject.name);
        for (const tk of nameTokens) {
            if (topicTokens.has(tk)) score += 1;
        }
        // Path-aware boost: every ancestor whose name appears
        // in the topic adds half a point. "Spanish Grammar"
        // boosts both "Spanish" (parent) and "Grammar" (leaf).
        let cursor: string | null | undefined = subject.parent_id;
        let depthSeen = 0;
        while (cursor && depthSeen < 8) {
            const parent = byId.get(cursor);
            if (!parent) break;
            const parentLower = parent.name.toLowerCase();
            if (lowerTopic.includes(parentLower)) score += 1;
            cursor = parent.parent_id;
            depthSeen += 1;
        }
        if (score > 0) {
            scored.push({
                subject,
                score,
                path: buildPath(subject, byId),
            });
        }
    }

    // Sort: higher score first; deeper (more specific) wins ties.
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return depth(b.subject, byId) - depth(a.subject, byId);
    });
    return scored.slice(0, limit);
}
