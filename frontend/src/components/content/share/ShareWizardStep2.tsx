/**
 * Share Wizard step 2 — advisory duplicate / variation scan against the
 * lessons already published in the target tree path. Scan state and the
 * chosen share mode come from {@link useShareWizard}; warnings never
 * block sharing.
 */

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { UseShareWizardResult } from "../../../hooks/content/useShareWizard";

export default function ShareWizardStep2({ wiz }: { wiz: UseShareWizardResult }) {
  const { t } = useI18n();
  const { scanning, dup, mode, setMode, note, setNote, showDiff, setShowDiff } = wiz;

  return (
    <section data-testid="share-wizard-step-2">
      {scanning || dup === null ? (
        <p data-testid="share-wizard-scanning">
          {t("content.wizard.checking", "Checking for similar lessons…")}
        </p>
      ) : dup.tier === "none" ? (
        <p
          className="content-share-passed"
          data-testid="share-wizard-unique"
        >
          {t("content.wizard.no_duplicates", "No duplicates found. Your lesson is unique!")}
        </p>
      ) : (
        <div data-testid="share-wizard-duplicate">
          <p className="content-share-warning">
            {(dup.tier === "near_duplicate"
              ? t("content.wizard.near_duplicate", "This lesson already exists: \"{title}\".")
              : t("content.wizard.similar_found", "Similar lesson found: \"{title}\".")
            ).replace("{title}", dup.match?.candidateTitle ?? "")}
          </p>
          <p
            className="share-wizard-overlap mt-1 text-sm text-fg-secondary"
            data-testid="share-wizard-overlap"
          >
            {t("content.wizard.overlap", "{cards} of {total} cards in common, {ex} matching exercises.")
              .replace("{cards}", String(dup.match?.matchedCards ?? 0))
              .replace("{total}", String(dup.match?.totalQueryCards ?? 0))
              .replace("{ex}", String(dup.match?.matchedExercises ?? 0))}
          </p>

          {showDiff && dup.match && (
            <ul
              className="share-wizard-diff mt-2 list-none space-y-1 p-0 text-sm text-fg-secondary"
              data-testid="share-wizard-diff"
            >
              <li>
                {t("content.wizard.diff_cards", "Cards: {m}/{t} shared")
                  .replace("{m}", String(dup.match.matchedCards))
                  .replace("{t}", String(dup.match.totalQueryCards))}
              </li>
              <li>
                {t("content.wizard.diff_exercises", "Exercises: {m}/{t} shared")
                  .replace("{m}", String(dup.match.matchedExercises))
                  .replace("{t}", String(dup.match.totalQueryExercises))}
              </li>
            </ul>
          )}

          <div className="share-wizard-dup-actions mt-3 flex flex-col gap-2">
            {dup.tier === "near_duplicate" && (
              <label className="share-wizard-mode flex items-center gap-2">
                <input
                  type="radio"
                  name="share-mode"
                  checked={mode === "supplement"}
                  onChange={() => setMode("supplement")}
                  data-testid="share-wizard-mode-supplement"
                />
                {t("content.wizard.suggest_new_only", "Suggest only the new exercises")}
              </label>
            )}
            <label className="share-wizard-mode flex items-center gap-2">
              <input
                type="radio"
                name="share-mode"
                checked={mode === "variation"}
                onChange={() => setMode("variation")}
                data-testid="share-wizard-mode-variation"
              />
              {t("content.wizard.share_as_variation", "Share anyway — as a variation")}
            </label>
            <label className="share-wizard-mode flex items-center gap-2">
              <input
                type="radio"
                name="share-mode"
                checked={mode === "full"}
                onChange={() => setMode("full")}
                data-testid="share-wizard-mode-full"
              />
              {t("content.wizard.share_full", "Share the full lesson anyway")}
            </label>

            {mode !== "full" && (
              <input
                type="text"
                className="share-wizard-note mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("content.wizard.variation_note_placeholder", "How does your version differ? (optional)")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid="share-wizard-note"
              />
            )}

            <Button
              type="button"
              variant="link"
              onClick={() => setShowDiff((v) => !v)}
              data-testid="share-wizard-toggle-diff"
            >
              {t("content.wizard.show_differences", "Show differences")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
