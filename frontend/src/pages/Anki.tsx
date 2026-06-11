/**
 * Anki page — review + export flashcard suggestions
 * (Phase 30C / v1.17.0).
 *
 * Surfaces every saved card for the active user, lets them
 * accept / reject / inline-edit, filters by project + accepted-
 * only, and bundles the accepted set into a .apkg download
 * (lazy-loaded sql.js + jszip — no main-bundle cost until the
 * user clicks Export).
 */

import { Layers } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

import { useFeature } from "@astrapi69/feature-strategy-react";

import { ApiError } from "../api/client";
import ApiKeyRequiredNotice from "../components/ApiKeyRequiredNotice";
import { FEATURES } from "../features/featureConfig";
import { useI18n } from "../hooks/useI18n";
import { filterStandardProjects } from "../lib/learning-project";
import { readLearnerState } from "../lib/learnerState";
import { getStorage } from "../storage";
import type { AnkiCardSuggestion } from "../storage/types";
import { notify } from "../utils/notify";
import type { LearningProject } from "../types";

export default function AnkiPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [cards, setCards] = useState<AnkiCardSuggestion[]>([]);
  const [projects, setProjects] = useState<LearningProject[]>([]);
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterAccepted, setFilterAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    front: string;
    back: string;
    card_type: "basic" | "cloze";
  } | null>(null);
  const userId = readLearnerState().userId;
  const ankiFeature = useFeature(FEATURES.ANKI_EXTRACT);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getStorage().anki.list(userId, {
        projectId: filterProject || undefined,
        acceptedOnly: filterAccepted,
      });
      setCards(data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.detail : t("anki.load_failed", "Could not load cards.");
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  }, [userId, filterProject, filterAccepted, t]);

  useEffect(() => {
    if (!userId) {
      navigate("/onboarding", { replace: true });
      return;
    }
    let cancelled = false;
    getStorage()
      .users.projects.list(userId)
      .then((p) => {
        // v1.31.0 / Phase 46F.3: skip the auto-managed
        // "Content Lessons" pseudo-project — Anki cards
        // come from chat sessions on standard projects,
        // not from content-lesson completions.
        if (!cancelled) setProjects(filterStandardProjects(p));
      })
      .catch(() => {
        /* non-fatal — page still works without filter */
      });
    return () => {
      cancelled = true;
    };
  }, [userId, navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleAccept = async (card: AnkiCardSuggestion) => {
    try {
      const next = await getStorage().anki.update(card.id, {
        accepted: !card.accepted,
      });
      setCards((prev) => prev.map((c) => (c.id === card.id ? next : c)));
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : t("common.error");
      notify.error(msg);
    }
  };

  const reject = async (card: AnkiCardSuggestion) => {
    try {
      await getStorage().anki.update(card.id, { rejected: true });
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : t("common.error");
      notify.error(msg);
    }
  };

  const remove = async (card: AnkiCardSuggestion) => {
    if (!confirm(t("anki.delete_confirm", "Delete this card?"))) return;
    try {
      await getStorage().anki.remove(card.id);
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : t("common.error");
      notify.error(msg);
    }
  };

  const startEdit = (card: AnkiCardSuggestion) => {
    setEditingCardId(card.id);
    setEditDraft({
      front: card.front,
      back: card.back,
      card_type: card.card_type,
    });
  };

  const saveEdit = async () => {
    if (!editingCardId || !editDraft) return;
    try {
      const next = await getStorage().anki.update(editingCardId, {
        front: editDraft.front,
        back: editDraft.back,
        card_type: editDraft.card_type,
      });
      setCards((prev) => prev.map((c) => (c.id === next.id ? next : c)));
      setEditingCardId(null);
      setEditDraft(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : t("common.error");
      notify.error(msg);
    }
  };

  const exportApkg = async () => {
    const accepted = cards.filter((c) => c.accepted);
    if (accepted.length === 0) {
      notify.warning(t("anki.export_no_accepted", "Accept at least one card before exporting."));
      return;
    }
    setExporting(true);
    try {
      // Lazy-load the heavy WASM + ZIP libs only when the
      // user actually exports.
      const { buildApkg } = await import("../lib/anki/apkg-builder");
      const deckName = filterProject
        ? (projects.find((p) => p.id === filterProject)?.topic ?? "Adaptive Learner")
        : "Adaptive Learner";
      const result = await buildApkg(
        accepted.map((c) => ({
          guid: c.id,
          type: c.card_type,
          front: c.front,
          back: c.back,
          tags: c.tags,
        })),
        {
          name: `${deckName} - Adaptive Learner`,
          description: t("anki.deck_description", "Cards exported from Adaptive Learner."),
        },
      );
      // Trigger the browser download.
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Mark the exported cards so the next "newest" filter
      // sorts them lower.
      await getStorage().anki.markExported(accepted.map((c) => c.id));
      notify.success(
        t("anki.export_success", "Exported {n} cards to {filename}.")
          .replace("{n}", String(result.cardCount))
          .replace("{filename}", result.filename),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("anki.export_failed", "Export failed.");
      notify.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const acceptedCount = cards.filter((c) => c.accepted).length;
  const totalCount = cards.length;

  return (
    <main id="main" className="anki-page" data-testid="anki-page">
      <header className="page-header">
        <h1>{t("anki.title", "Anki Export")}</h1>
        <p className="muted">
          {t(
            "anki.intro",
            "Review AI-suggested flashcards, accept the ones you want, then export as an .apkg file for Anki.",
          )}
        </p>
      </header>

      <section className="anki-toolbar" data-testid="anki-toolbar">
        <label className="form-row">
          <span className="form-label">{t("anki.filter_project", "Project")}</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            data-testid="anki-filter-project"
          >
            <option value="">{t("anki.filter_all_projects", "All projects")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.topic}
              </option>
            ))}
          </select>
        </label>
        <label className="form-row form-row-toggle">
          <span className="form-label">{t("anki.filter_accepted", "Accepted only")}</span>
          <input
            type="checkbox"
            checked={filterAccepted}
            onChange={(e) => setFilterAccepted(e.target.checked)}
            data-testid="anki-filter-accepted"
          />
        </label>
        <div className="anki-toolbar__summary">
          <span data-testid="anki-stats">
            {t("anki.stats", "{accepted} of {total} accepted")
              .replace("{accepted}", String(acceptedCount))
              .replace("{total}", String(totalCount))}
          </span>
        </div>
        <Button
          type="button"
          onClick={exportApkg}
          disabled={exporting || acceptedCount === 0}
          data-testid="anki-export-button"
        >
          {exporting
            ? t("anki.exporting", "Generating .apkg…")
            : t("anki.export_button", "Export as .apkg")}
        </Button>
      </section>

      {loading ? (
        <p data-testid="anki-loading">{t("common.loading", "Loading…")}</p>
      ) : cards.length === 0 ? (
        <section
          data-testid="anki-empty"
          className="anki-empty flex flex-col items-center gap-3 px-4 py-12 text-center"
        >
          <Layers size={48} aria-hidden="true" className="text-fg-muted" />
          <h2 className="m-0 text-lg font-semibold">
            {t("anki.empty_title", "No Anki cards yet.")}
          </h2>
          <p className="m-0 max-w-md text-fg-muted">
            {t(
              "anki.empty_body",
              "Import a conversation and click 'Extract Anki cards' to create flashcards.",
            )}
          </p>
          {ankiFeature.isDisabled && (
            <ApiKeyRequiredNotice
              feature={t("ui.api_key.feature_anki", "to extract Anki cards")}
              settingsHref="/settings?tab=integrations"
            />
          )}
          <Button asChild variant="outline">
            <Link to="/import" data-testid="anki-empty-import-link">
              {t("anki.empty_cta", "Import a conversation")}
            </Link>
          </Button>
        </section>
      ) : (
        <ul className="anki-card-list" data-testid="anki-card-list">
          {cards.map((card) => {
            const editing = editingCardId === card.id;
            return (
              <li
                key={card.id}
                className={
                  "anki-card " + (card.accepted ? "anki-card--accepted" : "anki-card--suggested")
                }
                data-testid={`anki-card-${card.id}`}
                data-accepted={card.accepted ? "true" : "false"}
              >
                <div className="anki-card__type">
                  {card.card_type === "cloze" ? "Cloze" : "Basic"}
                </div>
                {editing && editDraft ? (
                  <>
                    <label>
                      <span className="form-label">{t("anki.front", "Front")}</span>
                      <textarea
                        value={editDraft.front}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            front: e.target.value,
                          })
                        }
                        data-testid={`anki-edit-front-${card.id}`}
                      />
                    </label>
                    <label>
                      <span className="form-label">{t("anki.back", "Back")}</span>
                      <textarea
                        value={editDraft.back}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            back: e.target.value,
                          })
                        }
                        data-testid={`anki-edit-back-${card.id}`}
                      />
                    </label>
                    <label>
                      <span className="form-label">{t("anki.card_type", "Type")}</span>
                      <select
                        value={editDraft.card_type}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            card_type: e.target.value as "basic" | "cloze",
                          })
                        }
                      >
                        <option value="basic">Basic</option>
                        <option value="cloze">Cloze</option>
                      </select>
                    </label>
                    <div className="anki-card__actions">
                      <Button type="button" onClick={saveEdit} data-testid={`anki-save-${card.id}`}>
                        {t("common.save", "Save")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingCardId(null);
                          setEditDraft(null);
                        }}
                      >
                        {t("common.cancel", "Cancel")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="anki-card__front">{card.front}</div>
                    <div className="anki-card__back">{card.back}</div>
                    {card.tags.length > 0 && (
                      <div className="anki-card__tags">
                        {card.tags.map((tag) => (
                          <span key={tag} className="anki-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="anki-card__actions">
                      <Button
                        type="button"
                        variant={card.accepted ? "secondary" : "default"}
                        onClick={() => toggleAccept(card)}
                        data-testid={`anki-toggle-${card.id}`}
                      >
                        {card.accepted
                          ? t("anki.unaccept", "Unaccept")
                          : t("anki.accept", "Accept")}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => startEdit(card)}>
                        {t("common.edit", "Edit")}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => reject(card)}>
                        {t("anki.reject", "Reject")}
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => remove(card)}>
                        {t("common.delete", "Delete")}
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
