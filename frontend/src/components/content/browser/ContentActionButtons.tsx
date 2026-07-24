/**
 * Content action buttons (split out of the former ContentToolbar, #1253).
 *
 * The five import/creation actions — Import Lesson / Import Chat / Anki
 * export / Learning Path / Create New Lesson. As part of the content IA
 * redesign they live in the **Import tab** (they are all import- or
 * creation-related) instead of cluttering the top of "Meine Inhalte".
 * Icon-only on mobile (icon + label from ``md`` up). Props-driven and
 * presentational — navigation + the import-lesson modal trigger come from
 * the host. Behaviour-preserving: identical testids, labels, order, and
 * handlers.
 */

import {
  Layers,
  Map as MapIcon,
  MessageSquare,
  Plus,
  Upload,
} from "lucide-react";
import type { NavigateFunction } from "react-router";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../hooks/ui/useI18n";

interface ContentActionButtonsProps {
  /** Open the import-lesson modal (owned by the host). */
  onImportLesson: () => void;
  navigate: NavigateFunction;
}

/** The five content import/creation action buttons. */
export default function ContentActionButtons({
  onImportLesson,
  navigate,
}: ContentActionButtonsProps) {
  const { t } = useI18n();
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-1"
      data-testid="content-action-buttons"
    >
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] gap-2"
        onClick={onImportLesson}
        title={t("content.import_lesson.button", "Import Lesson")}
        aria-label={t("content.import_lesson.button", "Import Lesson")}
        data-testid="content-import-lesson"
      >
        <Upload className="h-5 w-5" aria-hidden="true" />
        <span className="hidden md:inline">
          {t("content.import_lesson.button", "Import Lesson")}
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] gap-2"
        onClick={() => navigate("/content?tab=import")}
        title={t("content.import_chat.button", "Import Chat")}
        aria-label={t("content.import_chat.button", "Import Chat")}
        data-testid="content-import-chat"
      >
        <MessageSquare className="h-5 w-5" aria-hidden="true" />
        <span className="hidden md:inline">
          {t("content.import_chat.button", "Import Chat")}
        </span>
      </Button>
      {/* EXP-037 (#850) — Anki is no longer a top-level nav entry; its
          export lives here as an action. */}
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] gap-2"
        onClick={() => navigate("/anki")}
        title={t("content.anki_export.button", "Anki export")}
        aria-label={t("content.anki_export.button", "Anki export")}
        data-testid="content-anki-export"
      >
        <Layers className="h-5 w-5" aria-hidden="true" />
        <span className="hidden md:inline">
          {t("content.anki_export.button", "Anki export")}
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] gap-2"
        onClick={() => navigate("/learning-path")}
        title={t("nav.learning_path", "Learning Path")}
        aria-label={t("nav.learning_path", "Learning Path")}
        data-testid="content-learning-path"
      >
        <MapIcon className="h-5 w-5" aria-hidden="true" />
        <span className="hidden md:inline">{t("nav.learning_path", "Learning Path")}</span>
      </Button>
      <Button
        type="button"
        className="min-h-[44px] gap-2"
        onClick={() => navigate("/create-lesson")}
        title={t("content.create_lesson.button", "Create New Lesson")}
        aria-label={t("content.create_lesson.button", "Create New Lesson")}
        data-testid="content-create-lesson"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        <span className="hidden md:inline">
          {t("content.create_lesson.button", "Create New Lesson")}
        </span>
      </Button>
    </div>
  );
}
