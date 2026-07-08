/**
 * CustomPathsView — the "My Paths" / "Meine Pfade" mode of the
 * personal Learning Path (Curriculum Builder, Option A of #722).
 *
 * Lets the learner assemble existing content lessons into ordered,
 * personal "custom paths" and resume them. It is NOT a parallel
 * curricula system: the paths live in localStorage
 * (``lib/learning-path/custom-paths``) so both storage modes behave
 * identically with no backend. Lesson/set listings + progress are
 * read through ``getStorage()`` so API mode and Dexie mode both work.
 *
 * Presentation is delegated to the app-agnostic shared components
 * (``CurriculumCard`` + ``LessonPicker``); this component owns the
 * storage reads, the localStorage mutations, and the
 * ``lessonRoute(...)`` navigation.
 */

import {ArrowDown, ArrowUp, Plus, X} from "lucide-react";
import {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";

import {useI18n} from "../../hooks/ui/useI18n";
import {
    lessonLabelFromFilename,
    lessonRoute,
} from "../../lib/content/browse/continue-learning";
import {
    addLessonToPath,
    createCustomPath,
    customPathProgress,
    deleteCustomPath,
    listCustomPaths,
    moveLessonInPath,
    removeLessonFromPath,
    type CustomPath,
} from "../../lib/learning-path/custom-paths";
import {getStorage} from "../../storage";
import type {LessonProgress} from "../../storage/types";
import CurriculumCard from "../../shared/media/CurriculumCard";
import LessonPicker, {type PickableLesson} from "../../shared/forms/LessonPicker";
import {Button} from "@/components/ui/button";

interface CustomPathsViewProps {
    userId: string;
}

/** "My Paths" mode for the personal Learning Path. */
export default function CustomPathsView({userId}: CustomPathsViewProps) {
    const {t} = useI18n();
    const navigate = useNavigate();

    const [paths, setPaths] = useState<CustomPath[]>(() => listCustomPaths());
    const [progressRows, setProgressRows] = useState<LessonProgress[]>([]);
    const [available, setAvailable] = useState<PickableLesson[]>([]);
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [pickerForPath, setPickerForPath] = useState<string | null>(null);

    const reloadPaths = useCallback(() => {
        setPaths(listCustomPaths());
    }, []);

    // Load the learner's progress (for the done/total roll-up).
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            if (!userId) return;
            try {
                const rows = await getStorage().lessonProgress.list(userId);
                if (!cancelled) setProgressRows(rows);
            } catch {
                /* progress is a roll-up convenience — leave empty */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    // Load all downloaded lessons across every set (for the picker).
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const storage = getStorage();
                const setsList = await storage.contentLoader.listSets();
                if (cancelled) return;
                const downloaded = setsList.sets.filter((s) => s.cached_version);
                const lessons: PickableLesson[] = [];
                for (const entry of downloaded) {
                    const listing = await storage.contentLoader.listLessons(
                        entry.source,
                        entry.id,
                    );
                    if (cancelled) return;
                    for (const filename of listing.lessons) {
                        lessons.push({
                            source: entry.source,
                            setId: entry.id,
                            filename,
                            label: lessonLabelFromFilename(filename),
                            setTitle: entry.title,
                        });
                    }
                }
                if (!cancelled) setAvailable(lessons);
            } catch {
                /* picker stays empty on a failed read */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleCreate = () => {
        const name = newName.trim();
        if (!name) return;
        createCustomPath(name, newDescription);
        setNewName("");
        setNewDescription("");
        reloadPaths();
    };

    const handleContinue = (path: CustomPath) => {
        const {nextLesson} = customPathProgress(path, progressRows);
        if (!nextLesson) return;
        navigate(
            lessonRoute(nextLesson.source, nextLesson.setId, nextLesson.filename),
        );
    };

    const labelFor = (path: CustomPath, filename: string): string =>
        available.find(
            (a) => a.setId === path.lessons[0]?.setId && a.filename === filename,
        )?.label ?? lessonLabelFromFilename(filename);

    const lessonDisplay = useMemo(() => {
        const byKey = new Map<string, PickableLesson>();
        for (const l of available) {
            byKey.set(`${l.source}#${l.setId}#${l.filename}`, l);
        }
        return byKey;
    }, [available]);

    return (
        <div className="flex flex-col gap-4" data-testid="custom-paths-view">
            <form
                className="flex flex-col gap-2 rounded-app border border-border bg-card p-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    handleCreate();
                }}
                data-testid="custom-path-create-form"
            >
                <h2 className="text-base font-semibold text-fg-primary">
                    {t("learning_path.custom.create_title", "Create a path")}
                </h2>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t(
                        "learning_path.custom.name_placeholder",
                        "Path name",
                    )}
                    aria-label={t(
                        "learning_path.custom.name_placeholder",
                        "Path name",
                    )}
                    className="min-h-[44px] rounded-md border border-border bg-card px-3 text-sm text-fg-primary placeholder:text-fg-muted"
                    data-testid="custom-path-name-input"
                />
                <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder={t(
                        "learning_path.custom.description_placeholder",
                        "Description (optional)",
                    )}
                    aria-label={t(
                        "learning_path.custom.description_placeholder",
                        "Description (optional)",
                    )}
                    className="min-h-[44px] rounded-md border border-border bg-card px-3 text-sm text-fg-primary placeholder:text-fg-muted"
                    data-testid="custom-path-description-input"
                />
                <Button
                    type="submit"
                    variant="default"
                    disabled={!newName.trim()}
                    className="self-start gap-1.5"
                    data-testid="custom-path-create-button"
                >
                    <Plus size={16} aria-hidden="true" />
                    {t("learning_path.custom.create", "Create path")}
                </Button>
            </form>

            {paths.length === 0 ? (
                <p
                    className="rounded-app border border-border bg-card p-6 text-center text-fg-muted"
                    data-testid="custom-paths-empty"
                >
                    {t(
                        "learning_path.custom.empty",
                        "No custom paths yet. Create one above and add lessons to it.",
                    )}
                </p>
            ) : (
                <ul
                    className="flex flex-col gap-4"
                    data-testid="custom-paths-list"
                >
                    {paths.map((path) => {
                        const {done, total, nextLesson} = customPathProgress(
                            path,
                            progressRows,
                        );
                        const nextLabel = nextLesson
                            ? labelFor(path, nextLesson.filename)
                            : undefined;
                        return (
                            <li
                                key={path.id}
                                className="flex flex-col gap-3"
                                data-testid={`custom-path-${path.id}`}
                            >
                                <CurriculumCard
                                    name={path.name}
                                    description={path.description}
                                    done={done}
                                    total={total}
                                    nextLabel={nextLabel}
                                    progressLabel={t(
                                        "learning_path.custom.progress",
                                        "{done} of {total} done",
                                    )
                                        .replace("{done}", String(done))
                                        .replace("{total}", String(total))}
                                    continueLabel={t(
                                        "learning_path.custom.continue",
                                        "Continue",
                                    )}
                                    deleteLabel={t(
                                        "learning_path.custom.delete",
                                        "Delete path",
                                    )}
                                    emptyActionLabel={t(
                                        "learning_path.custom.add_first_lesson",
                                        "Add your first lesson",
                                    )}
                                    onEmptyAction={() =>
                                        setPickerForPath(path.id)
                                    }
                                    nextHintLabel={
                                        nextLabel
                                            ? t(
                                                  "learning_path.custom.next_hint",
                                                  "Next: {lesson}",
                                              ).replace("{lesson}", nextLabel)
                                            : undefined
                                    }
                                    onContinue={() => handleContinue(path)}
                                    onDelete={() => {
                                        deleteCustomPath(path.id);
                                        reloadPaths();
                                    }}
                                    testId={`custom-path-card-${path.id}`}
                                />

                                {path.lessons.length > 0 && (
                                    <ol
                                        className="flex flex-col gap-1 pl-1"
                                        data-testid={`custom-path-lessons-${path.id}`}
                                    >
                                        {path.lessons.map((lesson, index) => {
                                            const display = lessonDisplay.get(
                                                `${lesson.source}#${lesson.setId}#${lesson.filename}`,
                                            );
                                            return (
                                                <li
                                                    key={`${lesson.source}#${lesson.setId}#${lesson.filename}`}
                                                    className="flex items-center justify-between gap-2 rounded-md border border-border-subtle px-2 py-1"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm text-fg-primary">
                                                            {index + 1}.{" "}
                                                            {display?.label ??
                                                                lessonLabelFromFilename(
                                                                    lesson.filename,
                                                                )}
                                                        </span>
                                                        {display?.setTitle && (
                                                            <span className="block truncate text-xs text-fg-muted">
                                                                {display.setTitle}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex shrink-0 items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                moveLessonInPath(
                                                                    path.id,
                                                                    index,
                                                                    "up",
                                                                );
                                                                reloadPaths();
                                                            }}
                                                            disabled={index === 0}
                                                            aria-label={t(
                                                                "learning_path.custom.move_up",
                                                                "Move up",
                                                            )}
                                                            title={t(
                                                                "learning_path.custom.move_up",
                                                                "Move up",
                                                            )}
                                                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-fg-muted hover:bg-muted disabled:opacity-40"
                                                            data-testid={`custom-path-move-up-${path.id}-${index}`}
                                                        >
                                                            <ArrowUp
                                                                size={14}
                                                                aria-hidden="true"
                                                            />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                moveLessonInPath(
                                                                    path.id,
                                                                    index,
                                                                    "down",
                                                                );
                                                                reloadPaths();
                                                            }}
                                                            disabled={
                                                                index ===
                                                                path.lessons
                                                                    .length -
                                                                    1
                                                            }
                                                            aria-label={t(
                                                                "learning_path.custom.move_down",
                                                                "Move down",
                                                            )}
                                                            title={t(
                                                                "learning_path.custom.move_down",
                                                                "Move down",
                                                            )}
                                                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-fg-muted hover:bg-muted disabled:opacity-40"
                                                            data-testid={`custom-path-move-down-${path.id}-${index}`}
                                                        >
                                                            <ArrowDown
                                                                size={14}
                                                                aria-hidden="true"
                                                            />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                removeLessonFromPath(
                                                                    path.id,
                                                                    lesson,
                                                                );
                                                                reloadPaths();
                                                            }}
                                                            aria-label={t(
                                                                "learning_path.custom.remove_lesson",
                                                                "Remove lesson",
                                                            )}
                                                            title={t(
                                                                "learning_path.custom.remove_lesson",
                                                                "Remove lesson",
                                                            )}
                                                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-fg-muted hover:bg-muted"
                                                            data-testid={`custom-path-remove-${path.id}-${index}`}
                                                        >
                                                            <X
                                                                size={14}
                                                                aria-hidden="true"
                                                            />
                                                        </button>
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}

                                {pickerForPath === path.id ? (
                                    <div className="rounded-app border border-border bg-card p-3">
                                        <LessonPicker
                                            availableLessons={available}
                                            searchPlaceholder={t(
                                                "learning_path.custom.search_lessons",
                                                "Search lessons…",
                                            )}
                                            emptyLabel={t(
                                                "learning_path.custom.no_lessons",
                                                "No lessons found.",
                                            )}
                                            listLabel={t(
                                                "learning_path.custom.add_lesson",
                                                "Add a lesson",
                                            )}
                                            onSelect={(picked) => {
                                                addLessonToPath(path.id, picked);
                                                reloadPaths();
                                            }}
                                            testId={`custom-path-picker-${path.id}`}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setPickerForPath(null)}
                                            className="mt-2"
                                            data-testid={`custom-path-picker-close-${path.id}`}
                                        >
                                            {t(
                                                "learning_path.custom.done_adding",
                                                "Done",
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setPickerForPath(path.id)}
                                        className="self-start gap-1.5"
                                        data-testid={`custom-path-add-${path.id}`}
                                    >
                                        <Plus size={16} aria-hidden="true" />
                                        {t(
                                            "learning_path.custom.add_lesson",
                                            "Add a lesson",
                                        )}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
