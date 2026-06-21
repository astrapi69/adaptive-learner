/**
 * personal-path — pure data layer behind the redesigned Learning
 * Path (feature/learning-path-redesign).
 *
 * The old /learning-path rendered ALL ~225 lessons as one xyflow
 * graph — unusable. This redesign answers the learner's real
 * question ("Wo bin ich? Was kommt als Nächstes?") with two zoom
 * levels:
 *
 *   Level 1 — one compact row per DOWNLOADED set (progress, last
 *             activity, current/next lesson, one action), sorted by
 *             last activity (most-recent first, same as Continue
 *             Learning). Untouched downloaded sets sink to the
 *             bottom.
 *   Level 2 — expand a row to per-lesson detail (stars, per-direction
 *             mastery, last attempt, the current marker).
 *
 * Everything here is synchronous + side-effect-free so it unit-tests
 * without a DOM; the page (LearningPathPersonal.tsx) does the storage
 * reads and feeds the results in. Reuses the existing mastery / star /
 * lessonKey helpers so the redesign and the graph view agree.
 */

import {computeStars, type StarRating} from "../lesson-summary";
import {compareByDownloadPriority} from "../content/browse/download-priority";
import {
    elementSrsDetails,
    srsLessonSummary,
    type SrsElementDetail,
    type SrsLessonSummary,
} from "../srs/status";
import type {ContentSetEntry} from "../../storage/types";
import type {ElementError, LessonProgress} from "../../storage/types";
import {lessonKey, masteryForLesson} from "./graph-builder";
import type {LessonNodeStatus} from "../../components/learning-path/LessonNodeView";

/** Mini-track dot state for a lesson (Level 1 progress track). */
export type DotState = "done" | "in_progress" | "not_started";

/** Per-direction mastery state for a lesson (Level 2 indicators).
 *  ``na`` = no tracked elements in that direction yet. */
export type MasteryState = "mastered" | "in_progress" | "not_started" | "na";

/** The single sensible action for a set, mirroring Continue Learning. */
export type SetActionMode = "resume" | "start" | "next" | "set_complete";

export interface PersonalPathLesson {
    source: string;
    setId: string;
    filename: string;
    /** 1-based position within the set. */
    number: number;
    title: string;
    stars: StarRating;
    status: LessonNodeStatus;
    /** Coarse dot for the Level 1 mini-track. */
    dot: DotState;
    receptive: MasteryState;
    productive: MasteryState;
    /** ISO ``updated_at`` of the progress row, or null if untouched. */
    lastActivity: string | null;
    /** The set's current/next lesson — gets the ▶ marker + action. */
    isCurrent: boolean;
    /** Spaced-repetition roll-up for the lesson's tracked elements
     *  (#588). Absent only on objects built outside buildPersonalPath. */
    srs?: SrsLessonSummary;
    /** Per-element SRS detail, weakest-first, for the element-detail
     *  surface (#588). */
    elementDetails?: SrsElementDetail[];
}

export interface PersonalPathSet {
    source: string;
    setId: string;
    title: string;
    titleNative: string | null;
    domain: string;
    sourceLanguage: string;
    targetLanguage: string;
    level: string;
    lessons: PersonalPathLesson[];
    completedCount: number;
    totalCount: number;
    /** 0-100, rounded. */
    percentComplete: number;
    /** ISO ``updated_at`` of the most-recently-touched lesson, null
     *  when the set has no progress at all. */
    lastActivity: string | null;
    /** The lesson to act on (resume/next/start); null when complete. */
    currentLesson: PersonalPathLesson | null;
    mode: SetActionMode;
    /** Active (non-mastered) element errors across the set. */
    errorCount: number;
    /** When this set is complete and a higher CEFR level of the same
     *  course exists, a pointer to it (so the row can offer "next
     *  level available"). Null otherwise. Filled by
     *  {@link attachNextLevels}. */
    nextLevel: NextLevelPointer | null;
}

export interface NextLevelPointer {
    source: string;
    setId: string;
    title: string;
    level: string;
    /** Whether the learner already downloaded the next-level set. */
    downloaded: boolean;
}

export interface NotDownloadedSet {
    source: string;
    setId: string;
    title: string;
    domain: string;
    lessonCount: number;
}

export interface PersonalPathData {
    activeSets: PersonalPathSet[];
    notDownloadedSets: NotDownloadedSet[];
}

/** One downloaded set's ordered lessons, as loaded by the page. */
export interface PersonalSetInput {
    entry: ContentSetEntry;
    /** Ordered lesson filenames + resolved titles. */
    lessons: {filename: string; number: number; title: string}[];
}

export interface BuildPersonalPathInput {
    sets: PersonalSetInput[];
    /** keyed by ``lessonKey(setId, filename)``. */
    progress: Record<string, LessonProgress>;
    /** ElementError rows per lesson, keyed by ``lessonKey``. */
    errors: Record<string, ElementError[]>;
    /** Available-but-not-downloaded sets (for the bottom section). */
    notDownloaded: ContentSetEntry[];
}

function dotFor(status: LessonNodeStatus): DotState {
    if (status === "completed" || status === "mastered") return "done";
    if (status === "not_started") return "not_started";
    return "in_progress"; // in_progress | paused
}

function statusFor(
    progress: LessonProgress | undefined,
    receptive: boolean,
    productive: boolean,
): LessonNodeStatus {
    if (!progress) return "not_started";
    if (progress.status === "paused") return "paused";
    if (progress.status === "in_progress") return "in_progress";
    if (progress.status === "abandoned") return "in_progress";
    // completed:
    if (receptive && productive) return "mastered";
    return "completed";
}

/** Per-direction mastery for the Level 2 dots. ``na`` when nothing in
 *  that direction has been tracked (e.g. a never-attempted lesson, or
 *  a flawless run that produced no error rows). */
function directionMastery(
    rows: ElementError[],
    direction: "target_to_source" | "source_to_target",
): MasteryState {
    const inDir =
        direction === "target_to_source"
            ? rows.filter(
                  (r) =>
                      (r.direction ?? "target_to_source") ===
                      "target_to_source",
              )
            : rows.filter((r) => r.direction === "source_to_target");
    if (inDir.length === 0) return "na";
    if (inDir.every((r) => r.mastered)) return "mastered";
    return "in_progress";
}

/**
 * Decide the set's single action + which lesson it targets.
 *
 *   - any in-progress / paused lesson → resume the most recent one.
 *   - else the first not-started lesson → "next" if some progress
 *     already exists in the set, otherwise "start".
 *   - else (every lesson done) → "set_complete", no target.
 */
function resolveSetAction(lessons: PersonalPathLesson[]): {
    mode: SetActionMode;
    current: PersonalPathLesson | null;
} {
    const active = lessons.filter(
        (l) => l.status === "in_progress" || l.status === "paused",
    );
    if (active.length > 0) {
        const current = active.reduce((a, b) =>
            (a.lastActivity ?? "") >= (b.lastActivity ?? "") ? a : b,
        );
        return {mode: "resume", current};
    }
    const next = lessons.find((l) => l.status === "not_started");
    if (next) {
        const anyProgress = lessons.some((l) => l.status !== "not_started");
        return {mode: anyProgress ? "next" : "start", current: next};
    }
    return {mode: "set_complete", current: null};
}

function buildSet(
    input: PersonalSetInput,
    progress: Record<string, LessonProgress>,
    errors: Record<string, ElementError[]>,
): PersonalPathSet {
    const {entry} = input;
    let completedCount = 0;
    let errorCount = 0;
    let lastActivity: string | null = null;

    const lessons: PersonalPathLesson[] = input.lessons.map((l) => {
        const key = lessonKey(entry.id, l.filename);
        const row = progress[key];
        const rows = errors[key] ?? [];
        const mastery = masteryForLesson(rows);
        const status = statusFor(row, mastery.receptive, mastery.productive);
        if (status === "completed" || status === "mastered") completedCount += 1;
        errorCount += rows.filter((r) => !r.mastered).length;
        if (row && (lastActivity === null || row.updated_at > lastActivity)) {
            lastActivity = row.updated_at;
        }
        return {
            source: entry.source,
            setId: entry.id,
            filename: l.filename,
            number: l.number,
            title: l.title,
            stars: row
                ? computeStars(row.score_correct, row.score_total)
                : (0 as StarRating),
            status,
            dot: dotFor(status),
            receptive: directionMastery(rows, "target_to_source"),
            productive: directionMastery(rows, "source_to_target"),
            lastActivity: row?.updated_at ?? null,
            isCurrent: false,
            srs: srsLessonSummary(rows),
            elementDetails: elementSrsDetails(rows),
        };
    });

    const {mode, current} = resolveSetAction(lessons);
    if (current) current.isCurrent = true;

    const totalCount = lessons.length;
    return {
        source: entry.source,
        setId: entry.id,
        title: entry.title,
        titleNative: entry.title_native ?? null,
        domain: entry.domain,
        sourceLanguage: entry.source_language,
        targetLanguage: entry.target_language,
        level: entry.level,
        lessons,
        completedCount,
        totalCount,
        percentComplete:
            totalCount > 0
                ? Math.round((completedCount / totalCount) * 100)
                : 0,
        lastActivity,
        currentLesson: current,
        mode,
        errorCount,
        nextLevel: null,
    };
}

/** CEFR ladder used to find "the next level" of a language course. */
const CEFR_LADDER = ["a1", "a2", "b1", "b2", "c1", "c2"];

/** A minimal view of a content set for next-level matching. */
interface LevelCandidate {
    source: string;
    setId: string;
    title: string;
    level: string;
    sourceLanguage: string;
    targetLanguage: string;
    domain: string;
    downloaded: boolean;
}

/**
 * For each completed-ready set, attach a pointer to the next CEFR
 * level of the SAME course (same source/target language + domain) if
 * one exists among the known sets (downloaded or not). Mutates the
 * passed sets and returns them.
 */
function attachNextLevels(
    sets: PersonalPathSet[],
    candidates: LevelCandidate[],
): PersonalPathSet[] {
    for (const set of sets) {
        const idx = CEFR_LADDER.indexOf(set.level.toLowerCase());
        if (idx < 0 || idx >= CEFR_LADDER.length - 1) continue;
        const nextLevel = CEFR_LADDER[idx + 1];
        const match = candidates.find(
            (c) =>
                c.setId !== set.setId &&
                c.level.toLowerCase() === nextLevel &&
                c.sourceLanguage === set.sourceLanguage &&
                c.targetLanguage === set.targetLanguage &&
                c.domain === set.domain,
        );
        if (match) {
            set.nextLevel = {
                source: match.source,
                setId: match.setId,
                title: match.title,
                level: match.level,
                downloaded: match.downloaded,
            };
        }
    }
    return sets;
}

/**
 * Build the two-level personal learning path from downloaded sets +
 * their lessons + progress + element errors, plus the list of
 * available-but-not-downloaded sets.
 *
 * Active sets are sorted by last activity (most recent first);
 * untouched downloaded sets fall to the bottom, ordered by title.
 * Not-downloaded sets are sorted by domain then title.
 */
export function buildPersonalPath(
    input: BuildPersonalPathInput,
): PersonalPathData {
    // All active sets are downloaded; the shared comparator (#909) orders them
    // started-first (most-recent activity), then untouched downloaded by title.
    // Not-downloaded sets are tier 3, handled as a separate section below.
    const activeSets = input.sets
        .map((s) => buildSet(s, input.progress, input.errors))
        .sort((a, b) =>
            compareByDownloadPriority(
                {downloaded: true, lastActivity: a.lastActivity, title: a.title},
                {downloaded: true, lastActivity: b.lastActivity, title: b.title},
            ),
        );

    const candidates: LevelCandidate[] = [
        ...input.sets.map((s) => ({
            source: s.entry.source,
            setId: s.entry.id,
            title: s.entry.title,
            level: s.entry.level,
            sourceLanguage: s.entry.source_language,
            targetLanguage: s.entry.target_language,
            domain: s.entry.domain,
            downloaded: true,
        })),
        ...input.notDownloaded.map((e) => ({
            source: e.source,
            setId: e.id,
            title: e.title,
            level: e.level,
            sourceLanguage: e.source_language,
            targetLanguage: e.target_language,
            domain: e.domain,
            downloaded: false,
        })),
    ];
    attachNextLevels(activeSets, candidates);

    const notDownloadedSets: NotDownloadedSet[] = input.notDownloaded
        .map((entry) => ({
            source: entry.source,
            setId: entry.id,
            title: entry.title,
            domain: entry.domain,
            lessonCount: entry.lesson_count,
        }))
        .sort(
            (a, b) =>
                a.domain.localeCompare(b.domain) ||
                a.title.localeCompare(b.title),
        );

    return {activeSets, notDownloadedSets};
}
