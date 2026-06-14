/**
 * NotebookLM-optimised ZIP export (Phase 32A / v1.19.0).
 *
 * Bundles project data into a ZIP whose contents are
 * structured for NotebookLM's source upload:
 *
 *   summary.md       — topic + goal + profile + tracking
 *                      counts + accepted study questions and
 *                      vocabulary, all under H2 sections
 *   vocabulary.md    — every vocabulary entry from analyzed
 *                      imported conversations (one table)
 *   rules.md         — extracted rules from completed sessions
 *                      (first AI message per session, which
 *                      typically states a rule/concept)
 *   errors.md        — session-rating notes flagged as
 *                      common-error patterns
 *   flashcards.md    — accepted Anki cards + every saved
 *                      study question in Q&A pairs
 *   sessions/*.md    — one MD per recent session with key
 *                      excerpts (NOT the full transcript)
 *
 * JSZip is lazy-loaded (same chunk that already serves the
 * .apkg builder), so the cost is paid only on demand.
 */

import {ApiError} from "../../api/client";
import {getStorage} from "../../storage";
import type {
    AnkiCardSuggestion,
    StudyQuestion,
} from "../../storage/types";
import type {
    LearningProfile,
    LearningProject,
    ProgressSummary,
    SessionMessage,
} from "../../types";
import type {
    ImportedConversation,
    VocabularyEntry,
} from "../../types/domain";

export interface NotebookLMPackageResult {
    blob: Blob;
    filename: string;
    /** How many files landed in the ZIP. */
    fileCount: number;
}

function escMd(s: string): string {
    // Escape Markdown control chars that would break NotebookLM's
    // parser. Conservative — we leave headers + lists alone since
    // those are intentional structure.
    return s.replace(/\|/g, "\\|");
}

function bullet(s: string): string {
    return `- ${s}`;
}

/**
 * Build the ``summary.md`` body. NotebookLM-optimised: short
 * paragraphs, clear H2 sections, no nested deep structure.
 */
function buildSummary(args: {
    project: LearningProject;
    profile: LearningProfile | null;
    progress: ProgressSummary | null;
    questions: StudyQuestion[];
    vocabulary: VocabularyEntry[];
}): string {
    const lines: string[] = [];
    lines.push(`# ${args.project.topic}`);
    lines.push("");
    lines.push(`Goal: ${args.project.goal}`);
    lines.push(`Timeframe: ${args.project.timeframe}`);
    lines.push(`Daily target: ${args.project.daily_minutes} minutes`);
    lines.push("");

    if (args.profile) {
        lines.push("## Learning profile");
        lines.push("");
        lines.push("Preferred methods (weighted 0..1):");
        for (const m of [
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
        ] as const) {
            const v = (args.profile as unknown as Record<string, number>)[m];
            if (typeof v === "number") {
                lines.push(`- ${m}: ${v.toFixed(2)}`);
            }
        }
        lines.push("");
    }

    if (args.progress?.tracking) {
        const t = args.progress.tracking;
        lines.push("## Activity counts");
        lines.push("");
        lines.push(`- Sessions: ${t.total_sessions}`);
        lines.push(`- Total minutes: ${t.total_minutes}`);
        lines.push(`- Current streak (days): ${t.streak_days}`);
        if (typeof t.mean_understanding === "number") {
            lines.push(
                `- Mean understanding: ${(t.mean_understanding * 100).toFixed(0)}%`,
            );
        }
        if (typeof t.mean_stress === "number") {
            lines.push(
                `- Mean stress: ${(t.mean_stress * 100).toFixed(0)}%`,
            );
        }
        lines.push("");
    }

    if (args.questions.length > 0) {
        lines.push("## Open study questions");
        lines.push("");
        lines.push(`${args.questions.length} questions saved.`);
        lines.push("See flashcards.md for the full list.");
        lines.push("");
    }

    if (args.vocabulary.length > 0) {
        lines.push("## Vocabulary");
        lines.push("");
        lines.push(
            `${args.vocabulary.length} vocabulary entries collected.`,
        );
        lines.push("See vocabulary.md for the full list.");
        lines.push("");
    }
    return lines.join("\n");
}

function buildVocabulary(entries: VocabularyEntry[]): string {
    if (entries.length === 0) {
        return "# Vocabulary\n\nNo vocabulary collected yet.\n";
    }
    const lines: string[] = [];
    lines.push("# Vocabulary");
    lines.push("");
    lines.push("| Word | Translation | Example |");
    lines.push("|------|-------------|---------|");
    for (const e of entries) {
        const word = escMd(e.word);
        const tr = escMd(e.translation);
        const ex = escMd(e.example ?? "");
        lines.push(`| ${word} | ${tr} | ${ex} |`);
    }
    lines.push("");
    return lines.join("\n");
}

function buildRules(sessionFirstAssistantMessages: string[]): string {
    if (sessionFirstAssistantMessages.length === 0) {
        return "# Rules and Concepts\n\nNo session rules captured yet.\n";
    }
    const lines: string[] = [];
    lines.push("# Rules and Concepts");
    lines.push("");
    lines.push(
        "The first AI response in each session typically states the rule, " +
            "concept, or example the session focuses on. Listed below by session.",
    );
    lines.push("");
    for (const msg of sessionFirstAssistantMessages) {
        lines.push("---");
        lines.push("");
        lines.push(msg);
        lines.push("");
    }
    return lines.join("\n");
}

function buildErrors(notes: string[]): string {
    if (notes.length === 0) {
        return "# Error Patterns\n\nNo session notes captured yet.\n";
    }
    const lines: string[] = [];
    lines.push("# Error Patterns and Reflections");
    lines.push("");
    lines.push(
        "Notes captured during session ratings. Each bullet is one " +
            "self-reflection on a learning moment or error.",
    );
    lines.push("");
    for (const n of notes) {
        lines.push(bullet(escMd(n)));
    }
    lines.push("");
    return lines.join("\n");
}

function buildFlashcards(
    questions: StudyQuestion[],
    anki: AnkiCardSuggestion[],
): string {
    if (questions.length === 0 && anki.length === 0) {
        return "# Flashcards (Q&A)\n\nNo questions or cards saved yet.\n";
    }
    const lines: string[] = [];
    lines.push("# Flashcards (Q&A)");
    lines.push("");
    lines.push(
        "Each Q&A is structured for NotebookLM's source parsing. " +
            "Question lines start with ``Q:``; answers with ``A:``.",
    );
    lines.push("");
    if (questions.length > 0) {
        lines.push("## Study questions");
        lines.push("");
        for (const q of questions) {
            lines.push(`Q: ${q.question}`);
            lines.push(`A: ${q.expected_answer || "(no answer yet)"}`);
            if (q.topic) {
                lines.push(`Topic: ${q.topic}  Difficulty: ${q.difficulty}`);
            }
            lines.push("");
        }
    }
    if (anki.length > 0) {
        lines.push("## Anki cards (accepted)");
        lines.push("");
        for (const c of anki) {
            lines.push(`Q: ${c.front}`);
            lines.push(`A: ${c.back}`);
            if (c.tags.length > 0) {
                lines.push(`Tags: ${c.tags.join(", ")}`);
            }
            lines.push("");
        }
    }
    return lines.join("\n");
}

function buildSessionExcerpt(
    sessionMeta: {id: string; method: string; started_at: string | null},
    messages: SessionMessage[],
): string {
    // Pick the first assistant message + the last user/assistant
    // pair — they tend to carry the most teaching value (the
    // intro + the final-state interaction).
    const firstAssistant = messages.find((m) => m.role === "assistant");
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastAssistant = messages.length > 0 ? messages[messages.length - 1] : null;
    const lines: string[] = [];
    const dateStr = sessionMeta.started_at
        ? sessionMeta.started_at.slice(0, 10)
        : "unknown date";
    lines.push(`# Session ${dateStr} (${sessionMeta.method})`);
    lines.push("");
    if (firstAssistant) {
        lines.push("## Concept introduced");
        lines.push("");
        lines.push(firstAssistant.content);
        lines.push("");
    }
    if (lastUser && lastAssistant && lastUser.id !== firstAssistant?.id) {
        lines.push("## Final exchange");
        lines.push("");
        lines.push(`**You:** ${lastUser.content}`);
        lines.push("");
        lines.push(`**AI:** ${lastAssistant.content}`);
        lines.push("");
    }
    return lines.join("\n");
}

type RecentSession = NonNullable<
    NonNullable<ProgressSummary["tracking"]>["recent_sessions"]
>[number];

/**
 * Collect every vocabulary entry from the user's analyzed
 * conversations. Per Phase 30D, vocabulary lives at
 * ``analysis_result.vocabulary``; malformed entries are skipped.
 */
function collectVocabulary(
    conversations: ImportedConversation[],
): VocabularyEntry[] {
    const vocabulary: VocabularyEntry[] = [];
    for (const conv of conversations) {
        if (!conv.analyzed || !conv.analysis_result) continue;
        const v = (
            conv.analysis_result as unknown as {vocabulary?: VocabularyEntry[]}
        ).vocabulary;
        if (Array.isArray(v)) {
            for (const entry of v) {
                if (entry && entry.word && entry.translation) {
                    vocabulary.push(entry);
                }
            }
        }
    }
    return vocabulary;
}

/**
 * Pull per-session data for the recent sessions: the first-assistant
 * message (the rule/concept), the rating note, and a per-session
 * excerpt file. Best-effort — a session that fails to load is skipped.
 */
async function collectSessionData(
    storage: ReturnType<typeof getStorage>,
    recentSessions: RecentSession[],
): Promise<{
    firstAssistantMsgs: string[];
    excerptFiles: Array<{name: string; body: string}>;
    noteSnippets: string[];
}> {
    const firstAssistantMsgs: string[] = [];
    const excerptFiles: Array<{name: string; body: string}> = [];
    const noteSnippets: string[] = [];
    for (const sess of recentSessions) {
        try {
            const detail = await storage.export.session(sess.id, "en");
            const msgs = (detail.messages ?? []) as SessionMessage[];
            const firstAssistant = msgs.find((m) => m.role === "assistant");
            if (firstAssistant?.content) {
                firstAssistantMsgs.push(firstAssistant.content);
            }
            const note = (detail.rating?.notes ?? "").trim();
            if (note) {
                noteSnippets.push(note);
            }
            excerptFiles.push({
                name: `sessions/${sess.id.slice(0, 8)}.md`,
                body: buildSessionExcerpt(
                    {
                        id: sess.id,
                        method: sess.method,
                        // ``RecentSessionEntry`` carries
                        // ``committed_at`` (the progress-commit
                        // timestamp), not ``started_at``. Same
                        // calendar day in practice.
                        started_at: sess.committed_at ?? null,
                    },
                    msgs,
                ),
            });
        } catch {
            /* skip — best-effort */
        }
    }
    return {firstAssistantMsgs, excerptFiles, noteSnippets};
}

// ---- Public API ----

/**
 * Build the .zip blob client-side. Reads from the active
 * storage backing (works in both API + Dexie modes since
 * everything goes through ``getStorage()``).
 */
export async function buildNotebookLMPackage(
    userId: string,
    projectId: string,
): Promise<NotebookLMPackageResult> {
    const storage = getStorage();
    const project = await storage.projects.get(projectId);
    if (!project) {
        throw new ApiError(404, `Project ${projectId} not found`);
    }

    // Fetch all the data we need in parallel. Each call's
    // failure is non-fatal — the package is best-effort and
    // missing sections render with a "nothing yet" placeholder.
    const [
        profile,
        progress,
        questions,
        ankiCards,
        conversations,
    ] = await Promise.all([
        storage.assessment.profile(projectId).catch(() => null),
        storage.tracking.progress(projectId).catch(() => null),
        storage.notebooklm
            .listQuestions(userId, {projectId})
            .catch(() => [] as StudyQuestion[]),
        storage.anki
            .list(userId, {projectId, acceptedOnly: true})
            .catch(() => [] as AnkiCardSuggestion[]),
        storage.imports.list(userId).catch(() => [] as ImportedConversation[]),
    ]);

    // Collect vocabulary from every analyzed conversation
    // belonging to the user.
    const vocabulary = collectVocabulary(conversations);

    // Sessions (up to the 10 most recent). ``recent_sessions``
    // lives under the ``tracking`` namespace in the progress
    // summary (per Phase 7B's TrackingSummary shape).
    const recentSessions = (progress?.tracking?.recent_sessions ?? []).slice(
        0,
        10,
    );
    const {
        firstAssistantMsgs: sessionFirstAssistantMsgs,
        excerptFiles: sessionExcerptFiles,
        noteSnippets,
    } = await collectSessionData(storage, recentSessions);

    const JSZipMod = (await import("jszip")).default;
    const zip = new JSZipMod();

    zip.file(
        "summary.md",
        buildSummary({
            project,
            profile,
            progress,
            questions,
            vocabulary,
        }),
    );
    zip.file("vocabulary.md", buildVocabulary(vocabulary));
    zip.file("rules.md", buildRules(sessionFirstAssistantMsgs));
    zip.file("errors.md", buildErrors(noteSnippets));
    zip.file("flashcards.md", buildFlashcards(questions, ankiCards));
    for (const f of sessionExcerptFiles) {
        zip.file(f.name, f.body);
    }

    const blob = await zip.generateAsync({type: "blob"});

    const safeTopic = project.topic
        .replace(/[^a-zA-Z0-9_\- ]/g, "_")
        .slice(0, 80)
        .trim()
        .replace(/\s+/g, "_");
    const filename = `${safeTopic || "project"}-notebooklm.zip`;
    return {
        blob,
        filename,
        fileCount: 5 + sessionExcerptFiles.length,
    };
}

export const _testing = {
    buildSummary,
    buildVocabulary,
    buildRules,
    buildErrors,
    buildFlashcards,
    buildSessionExcerpt,
};
