/**
 * Share Wizard step 1 — preview, editable lesson metadata (title /
 * source / target / level), computed placement, and the optional author
 * credit. State + gating come from {@link useShareWizard}.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "../../hooks/useI18n";
import type { UseShareWizardResult } from "../../hooks/useShareWizard";
import { CEFR_LEVELS, LANGUAGE_OPTIONS } from "../../lib/content/language-options";
import { isCefr, LEVEL_NONE } from "./shareWizardHelpers";

export default function ShareWizardStep1({ wiz }: { wiz: UseShareWizardResult }) {
  const { t } = useI18n();
  const {
    isEmptyLesson,
    onRegenerate,
    editTitle,
    setEditTitle,
    editSource,
    setEditSource,
    editTarget,
    setEditTarget,
    editLevel,
    setEditLevel,
    exerciseCount,
    cardCount,
    lessons,
    minutes,
    sameLanguage,
    step1Blocked,
    step1Errors,
    placement,
    singleLesson,
    authorName,
    setAuthorName,
    showName,
    setShowName,
  } = wiz;

  return (
    <section data-testid="share-wizard-step-1">
      {/* BUG B — an empty lesson is never shareable; offer to
          rebuild it from the source analysis. */}
      {isEmptyLesson && (
        <div
          className="share-wizard-empty content-share-failed"
          data-testid="share-wizard-empty"
          role="alert"
        >
          <p>
            {t(
              "content.wizard.err_empty",
              "This lesson has no exercises. Please recreate the lesson.",
            )}
          </p>
          {onRegenerate && (
            <Button
              type="button"
              onClick={onRegenerate}
              data-testid="share-wizard-regenerate"
            >
              {t("content.wizard.regenerate", "Regenerate")}
            </Button>
          )}
        </div>
      )}

      {/* BUG A/C — editable metadata: old lessons carry bad
          source/target/level the user must be able to fix. */}
      <p className="share-wizard-metadata-intro">
        {t(
          "content.wizard.metadata_intro",
          "Check and correct the lesson details before sharing.",
        )}
      </p>
      <div
        className="share-wizard-metadata"
        data-testid="share-wizard-metadata"
      >
        <label className="form-row">
          <span className="form-label">
            {t("content.wizard.edit_title", "Title")}
          </span>
          <Input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            data-testid="share-wizard-edit-title"
          />
        </label>
        <div className="form-row">
          <span className="form-label">
            {t("content.wizard.edit_source", "Source language (you speak)")}
          </span>
          <Select
            value={editSource || undefined}
            onValueChange={(v) => setEditSource(v)}
          >
            <SelectTrigger data-testid="share-wizard-edit-source">
              <SelectValue
                placeholder={t(
                  "content.wizard.select_language",
                  "Select a language…",
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.code} value={opt.code}>
                  {opt.name} ({opt.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="form-row">
          <span className="form-label">
            {t("content.wizard.edit_target", "Target language (you learn)")}
          </span>
          <Select
            value={editTarget || undefined}
            onValueChange={(v) => setEditTarget(v)}
          >
            <SelectTrigger data-testid="share-wizard-edit-target">
              <SelectValue
                placeholder={t(
                  "content.wizard.select_language",
                  "Select a language…",
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.code} value={opt.code}>
                  {opt.name} ({opt.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="form-row">
          <span className="form-label">
            {t("content.wizard.edit_level", "Level (CEFR)")}
          </span>
          <Select
            value={
              isCefr(editLevel) ? editLevel.toUpperCase() : LEVEL_NONE
            }
            onValueChange={(v) =>
              setEditLevel(v === LEVEL_NONE ? "" : v)
            }
          >
            <SelectTrigger data-testid="share-wizard-edit-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Explicit "no level" — suggest a CEFR guess but let
                  the user clear it; the empty-level gate then blocks
                  Continue (BUG C). */}
              <SelectItem value={LEVEL_NONE}>
                {t("content.wizard.select_level", "— Select level —")}
              </SelectItem>
              {CEFR_LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>
                  {lvl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="share-wizard-counts">
          <span data-testid="share-wizard-exercise-count">
            {t("content.wizard.exercises_label", "Exercises")}:{" "}
            {exerciseCount}
          </span>
          {" · "}
          <span data-testid="share-wizard-card-count">
            {t("content.wizard.cards_label", "Cards")}: {cardCount}
          </span>
          {" · "}
          <span>
            {lessons.length} {t("content.lessons", "lessons")}
          </span>
          {" · "}
          <span>~{minutes} min</span>
        </p>
        {sameLanguage && (
          <p
            className="share-wizard-domain-hint"
            data-testid="share-wizard-domain-hint"
          >
            {t(
              "content.wizard.same_language_domain_hint",
              "Same source and target language - this will be shared as knowledge (non-language) content.",
            )}
          </p>
        )}
      </div>

      {step1Blocked && (
        <ul
          className="content-share-issues share-wizard-step1-errors"
          data-testid="share-wizard-step1-errors"
        >
          {step1Errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}

      <div
        className="share-wizard-placement"
        data-testid="share-wizard-placement"
      >
        <p className="share-wizard-placement-line">
          {t("content.wizard.lands_under", "Your lesson lands under")}:
        </p>
        <p className="share-wizard-breadcrumb">
          <strong>
            {placement.source.toUpperCase()} →{" "}
            {placement.target.toUpperCase()} → {placement.level}
          </strong>
        </p>
        <code className="share-wizard-path">
          {placement.path}/lessons/
          {singleLesson ? placement.filename : ""}
        </code>
        {placement.isNewSet ? (
          <p
            className="share-wizard-newset"
            data-testid="share-wizard-newset"
          >
            {t("content.wizard.new_set", "New set! You're the first to contribute here.")}
          </p>
        ) : (
          <p
            className="share-wizard-existing"
            data-testid="share-wizard-existing"
          >
            {t("content.wizard.next_to_existing", "Next to {count} existing lesson(s) in this set.")
              .replace("{count}", String(placement.existingLessonCount))}
          </p>
        )}
      </div>

      {/* Phase 64C-2 — optional author credit. */}
      <div
        className="share-wizard-author"
        data-testid="share-wizard-author"
      >
        <label className="form-row">
          <span className="form-label">
            {t("content.credit.name_label", "Your name (optional)")}
          </span>
          <Input
            type="text"
            className="share-wizard-author-name"
            placeholder={t("content.credit.name_placeholder", "e.g. Maria S.")}
            value={authorName}
            onChange={(e) => {
              setAuthorName(e.target.value);
              if (e.target.value.trim() && !showName) setShowName(true);
            }}
            data-testid="share-wizard-author-name"
          />
        </label>
        {authorName.trim() && (
          <label className="form-row form-row-toggle">
            <span className="form-label">
              {t("content.credit.show_name", "Show name in lesson")}
            </span>
            <input
              type="checkbox"
              checked={showName}
              onChange={(e) => setShowName(e.target.checked)}
              data-testid="share-wizard-author-show"
            />
          </label>
        )}
        {authorName.trim() && showName && (
          <p className="share-wizard-author-privacy">
            {t(
              "content.credit.privacy",
              "Your name will be shown in the lesson and the pull request.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}
