/**
 * "My Lessons" section on /content — the user-generated sets, separate
 * from downloaded content (extracted from Content.tsx, #401).
 *
 * Each row carries up to six actions (Play / Edit / Export / Export as
 * set / Share / Delete); all are delivered as callbacks from the page.
 */

import { Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentSetEntry } from "../../../storage/types";
import GenerateSetExercisesButton from "../quality/GenerateSetExercisesButton";
import UserSetActions from "./UserSetActions";

interface MyLessonsSectionProps {
  userSets: ContentSetEntry[];
  communitySharingEnabled: boolean;
  onOpen: (entry: ContentSetEntry) => void;
  onEdit: (entry: ContentSetEntry) => void;
  onExportJson: (entry: ContentSetEntry) => void;
  onExportSet: (entry: ContentSetEntry) => void;
  onShare: (entry: ContentSetEntry) => void;
  onDelete: (entry: ContentSetEntry) => void;
  // #1741 — combine-into-a-set selection mode.
  selectMode: boolean;
  selectedCount: number;
  isSelected: (entry: ContentSetEntry) => boolean;
  onToggleSelectMode: () => void;
  onToggleSelect: (entry: ContentSetEntry) => void;
  onOpenCombine: () => void;
}

export default function MyLessonsSection({
  userSets,
  communitySharingEnabled,
  onOpen,
  onEdit,
  onExportJson,
  onExportSet,
  onShare,
  onDelete,
  selectMode,
  selectedCount,
  isSelected,
  onToggleSelectMode,
  onToggleSelect,
  onOpenCombine,
}: MyLessonsSectionProps) {
  const { t } = useI18n();

  const setKey = (entry: ContentSetEntry): string => `${entry.source}#${entry.id}`;
  const originLabel = (entry: ContentSetEntry): string => {
    if (entry.domain === "adaptive")
      return t("content.my_lessons.from_adaptive", "from adaptive lesson");
    if (entry.domain === "imported") return t("content.my_lessons.from_imported", "imported");
    return t("content.my_lessons.from_analysis", "from analysis");
  };

  return (
    <section className="content-section content-my-lessons" data-testid="content-my-lessons">
      <div className="content-section-head flex flex-wrap items-center justify-between gap-2">
        <h2>{t("content.my_lessons.title", "My Lessons")}</h2>
        {userSets.length > 0 && (
          <Button
            type="button"
            variant={selectMode ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleSelectMode}
            data-testid="my-lessons-combine-toggle"
          >
            <Layers size={14} aria-hidden="true" />
            {selectMode
              ? t("content.combine.cancel_select", "Cancel selection")
              : t("content.combine.start", "Combine into a set")}
          </Button>
        )}
      </div>
      {selectMode && userSets.length > 0 && (
        <div
          className="content-combine-bar mb-2 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-2"
          data-testid="my-lessons-combine-bar"
        >
          <span className="text-sm" aria-live="polite">
            {t("content.combine.selected_count", "{n} selected").replace(
              "{n}",
              String(selectedCount),
            )}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onOpenCombine}
            data-testid="my-lessons-combine-open"
          >
            {t("content.combine.start", "Combine into a set")}
          </Button>
        </div>
      )}
      {userSets.length === 0 ? (
        <p className="content-empty" data-testid="content-my-lessons-empty">
          {t(
            "content.my_lessons.empty",
            "Import a chat and analyze it to create your first lesson.",
          )}
        </p>
      ) : (
        <ul className="content-set-list" data-testid="content-my-lessons-list">
          {userSets.map((entry) => (
            <li
              key={setKey(entry)}
              className="content-set-row"
              data-testid={`my-lesson-${entry.id}`}
            >
              {selectMode && (
                <label className="mr-2 flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelected(entry)}
                    onChange={() => onToggleSelect(entry)}
                    data-testid={`my-lesson-${entry.id}-select`}
                    aria-label={t(
                      "content.combine.select_aria",
                      "Select {title}",
                    ).replace("{title}", entry.title)}
                  />
                </label>
              )}
              <div className="content-set-meta">
                <h3>{entry.title}</h3>
                <p className="content-set-tags">
                  <span>
                    {entry.language.toUpperCase()}
                    {" · "}
                    {entry.lesson_count} {t("content.lessons", "lessons")}
                    {" · "}
                    {originLabel(entry)}
                  </span>
                </p>
              </div>
              {/* #226 — the shared action set drops onto its own
                  full-width line so the up-to-6 buttons wrap below the
                  meta instead of overflowing the card. */}
              <UserSetActions
                entry={entry}
                communitySharingEnabled={communitySharingEnabled}
                testIdPrefix={`my-lesson-${entry.id}`}
                onPlay={onOpen}
                onEdit={onEdit}
                onExportJson={onExportJson}
                onExportSet={onExportSet}
                onShare={onShare}
                onDelete={onDelete}
              />
              {/* AIX-06 (#833) — batch-generate exercises for every
                  theory-only lesson in this set. */}
              <div className="mt-2">
                <GenerateSetExercisesButton entry={entry} t={t} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
