/**
 * Search bar for the /content "Meine Inhalte" page (split out of the
 * former ContentToolbar, #1253).
 *
 * The action buttons (Import Lesson / Import Chat / Anki / Learning Path /
 * Create New Lesson) moved to the Import tab as part of the content
 * IA redesign; "Meine Inhalte" keeps only the search. Props-driven and
 * presentational — the page owns the search state (via
 * ``useContentSearch``). Behaviour-preserving for the search itself:
 * identical testids, placeholder, and clear button.
 */

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useI18n } from "../../../hooks/ui/useI18n";

interface ContentSearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activateSearch: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

/** The /content search bar (full width). */
export default function ContentSearchBar({
  searchQuery,
  setSearchQuery,
  activateSearch,
  searchInputRef,
}: ContentSearchBarProps) {
  const { t } = useI18n();
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
    </div>
  );
}
