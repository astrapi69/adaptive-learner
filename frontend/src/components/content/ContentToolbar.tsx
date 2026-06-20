/**
 * ContentToolbar — the Content Browser's compact action row: a full-width
 * search field (left) followed by the icon-only secondary actions (Import
 * Lesson / Import Chat / Anki export / Learning Path / Create New Lesson;
 * icon + label from ``md`` up). Extracted verbatim from ``Content.tsx`` (#883)
 * to keep that page under the cohesion gate.
 *
 * Presentational + props-driven: the search state arrives from the parent's
 * ``useContentSearch`` hook; navigation is handled internally. No storage,
 * no data fetching.
 */

import {
  Layers,
  Map as MapIcon,
  MessageSquare,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "../../hooks/ui/useI18n";

export interface ContentToolbarProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  activateSearch: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  /** Opens the import-lesson modal (parent-owned state). */
  onImportLesson: () => void;
}

/** Search field + secondary-action buttons for the Content Browser. */
export default function ContentToolbar({
  searchQuery,
  setSearchQuery,
  activateSearch,
  searchInputRef,
  onImportLesson,
}: ContentToolbarProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="content-toolbar">
      <div
        className="relative flex min-w-[200px] flex-1 items-center"
        data-testid="content-search-bar"
      >
        {!searchQuery && (
          <Search
            size={18}
            className="pointer-events-none absolute right-3 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <Input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onFocus={activateSearch}
          onChange={(e) => {
            activateSearch();
            setSearchQuery(e.target.value);
          }}
          placeholder={t("content.search.placeholder", "Search lessons...")}
          aria-label={t("content.search.placeholder", "Search lessons...")}
          className="pl-3 pr-10"
          data-testid="content-search-input"
        />
        {searchQuery && (
          <button
            type="button"
            className="absolute right-2 flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            onClick={() => setSearchQuery("")}
            aria-label={t("content.search.clear", "Clear search")}
            data-testid="content-search-clear"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
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
            export lives here as an action on "Meine Inhalte". */}
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
    </div>
  );
}
