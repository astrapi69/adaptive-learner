/**
 * Selection + combine flow for "Meine Inhalte" (#1741).
 *
 * Owns the multi-select state over the user's own sets and the
 * combine-into-a-set action: gathers the selected sets' lessons and
 * persists a NEW own set (or extends an EXISTING one) through the same
 * ``saveUserSet`` path as every other user set, so the result is
 * export-compatible with no parallel format. Non-destructive: the source
 * sets are left in place.
 */

import {useMemo, useState} from "react";

import {
    buildCombinedSetInput,
    deriveCombinedLanguages,
    type CombinedLanguages,
    type CombineSource,
    type CombineTarget,
} from "../../lib/content/lesson/combine-lessons";
import type {CombineDecision} from "../../components/content/lessons/CombineLessonsDialog";
import {getStorage} from "../../storage";
import type {ContentLesson, ContentSetEntry} from "../../storage/types";
import {useI18n} from "../ui/useI18n";
import {notify} from "../../utils/notify";

interface UseCombineLessonsDeps {
    /** The user's own sets (already filtered to USER_GENERATED_SOURCE). */
    userSets: ContentSetEntry[];
    fetchSetLessons: (entry: ContentSetEntry) => Promise<ContentLesson[]>;
    /** Refresh the set list after a successful combine. */
    reload: () => Promise<void> | void;
}

const keyOf = (e: ContentSetEntry): string => `${e.source}#${e.id}`;

export function useCombineLessons({
    userSets,
    fetchSetLessons,
    reload,
}: UseCombineLessonsDeps) {
    const {t} = useI18n();
    const [selectMode, setSelectMode] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [dialogOpen, setDialogOpen] = useState(false);
    const [combining, setCombining] = useState(false);

    const selectedEntries = useMemo(
        () => userSets.filter((e) => selectedKeys.has(keyOf(e))),
        [userSets, selectedKeys],
    );
    const existingTargets = useMemo(
        () => userSets.filter((e) => !selectedKeys.has(keyOf(e))),
        [userSets, selectedKeys],
    );
    const languages: CombinedLanguages = useMemo(
        () =>
            deriveCombinedLanguages(
                selectedEntries.map((entry) => ({entry, lessons: []})),
            ),
        [selectedEntries],
    );

    const isSelected = (e: ContentSetEntry) => selectedKeys.has(keyOf(e));

    const toggleSelect = (e: ContentSetEntry) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            const k = keyOf(e);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    };

    const toggleSelectMode = () => {
        setSelectMode((on) => {
            if (on) setSelectedKeys(new Set());
            return !on;
        });
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedKeys(new Set());
        setDialogOpen(false);
    };

    const openDialog = () => {
        if (selectedKeys.size > 0) setDialogOpen(true);
    };

    const combine = async (decision: CombineDecision) => {
        if (combining || selectedEntries.length === 0) return;
        setCombining(true);
        try {
            const storage = getStorage();
            const sources: CombineSource[] = await Promise.all(
                selectedEntries.map(async (entry) => ({
                    entry,
                    lessons: await fetchSetLessons(entry),
                })),
            );
            let target: CombineTarget;
            if (decision.mode === "new") {
                target = {
                    mode: "new",
                    title: decision.title,
                    description: decision.description,
                    level: decision.level,
                };
            } else {
                target = {
                    mode: "existing",
                    entry: decision.entry,
                    lessons: await fetchSetLessons(decision.entry),
                };
            }
            const input = buildCombinedSetInput(
                sources,
                target,
                new Set(userSets.map((s) => s.id)),
            );
            await storage.contentLoader.saveUserSet(input);
            await reload();
            notify.success(
                t("content.combine.success", "Lessons combined into a set."),
            );
            exitSelectMode();
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                `${t("content.combine.failed", "Could not combine the lessons.")} ${detail}`,
            );
        } finally {
            setCombining(false);
        }
    };

    return {
        selectMode,
        toggleSelectMode,
        selectedKeys,
        selectedCount: selectedKeys.size,
        isSelected,
        toggleSelect,
        dialogOpen,
        openDialog,
        closeDialog: () => setDialogOpen(false),
        combining,
        languages,
        existingTargets,
        combine,
    };
}
