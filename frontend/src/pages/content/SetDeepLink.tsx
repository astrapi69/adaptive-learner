/**
 * Deep-link "open a single set" page at ``/content/set/:setId`` (#892).
 *
 * The prerequisite for set-specific QR / share links (#775 deferred the
 * per-set QR because only the app root was linkable). A scanned/shared
 * link lands here; the page resolves the set by id and "opens it
 * directly":
 *
 *   - found + downloaded     → jump straight to the set's first lesson.
 *   - found + not downloaded → show the set card with a "Download &
 *     start" action (downloads, then opens the first lesson).
 *   - unknown set id         → a clean "Set not found" state linking to
 *     Discover, NOT a crash or a dead error toast.
 *
 * Storage-mode-agnostic: every call routes through
 * ``getStorage().contentLoader.*`` so the same page works in API mode
 * (backend orchestrator) and Dexie mode (in-browser fetch + IndexedDB
 * cache, the GH-Pages deployment). A set id is globally unique across
 * sources (``listSets`` dedups same-id sets), so the bare ``:setId`` is
 * enough to recover the owning ``source``.
 *
 * GH-Pages direct hits work via the existing 404.html→index.html SPA
 * fallback the deploy workflow installs; no extra routing infra needed.
 */

import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";

import FlashRoundCard from "../../components/content/FlashRoundCard";
import SetShareButton from "../../components/content/share/SetShareButton";
import DownloadProgress from "../../shared/feedback/DownloadProgress";
import { useI18n } from "../../hooks/ui/useI18n";
import PageContainer from "../../shared/layout/PageContainer";
import {
  baseLessons,
  isBonusUnlocked,
  orderWithBonusLast,
} from "../../lib/content/browse/bonus-lessons";
import {buildSetLessonList, type SetLessonList} from "../../lib/content/browse/set-lesson-list";
import {readLearnerState} from "../../lib/learning/learnerState";
import {PLAYFUL_MODE_CHANGE_EVENT} from "../../lib/learning/playful/playfulModePref";
import {
  PLAYFUL_BONUS_CHANGE_EVENT,
  playfulBonusActive,
} from "../../lib/learning/playful/playfulBonusPref";
import { undismissSet } from "../../lib/content/browse/lifecycle/dismissed-sets";
import { getStorage } from "../../storage";
import type { ContentSetEntry } from "../../storage/types";
import { notify } from "../../utils/notify";

type Resolution = "loading" | "found" | "not_found";

/** Build the ``/lesson/...`` route slug from a set source. */
function setSlug(source: string): string {
  return source.replace(/\//g, "--");
}

export default function SetDeepLink() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setId = "" } = useParams<{ setId: string }>();

  const [resolution, setResolution] = useState<Resolution>("loading");
  const [entry, setEntry] = useState<ContentSetEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  // #2793 - the set page stops being a pure launcher: it lists the set's
  // lessons with their state, so any lesson is one click away and "how far am
  // I" is answered where the set actually appears.
  const [lessonList, setLessonList] = useState<SetLessonList | null>(null);
  // #2890 - the bonus-lesson gate (game mode AND the bonus switch),
  // kept live so a settings flip updates the open page, plus the
  // derived unlock state (every regular lesson at one star or better).
  const [bonusGate, setBonusGate] = useState(() => playfulBonusActive());
  const [bonusUnlocked, setBonusUnlocked] = useState(false);
  useEffect(() => {
    const refresh = () => setBonusGate(playfulBonusActive());
    window.addEventListener(PLAYFUL_MODE_CHANGE_EVENT, refresh);
    window.addEventListener(PLAYFUL_BONUS_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PLAYFUL_MODE_CHANGE_EVENT, refresh);
      window.removeEventListener(PLAYFUL_BONUS_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setResolution("loading");
    setEntry(null);
    (async () => {
      try {
        const { sets } = await getStorage().contentLoader.listSets();
        if (cancelled) return;
        const match = sets.find((set) => set.id === setId) ?? null;
        if (match) {
          setEntry(match);
          setResolution("found");
        } else {
          setResolution("not_found");
        }
      } catch {
        // A failed set listing (offline + nothing cached) is the same
        // user-facing outcome as an unknown id: the set isn't reachable
        // here. Show the clean not-found state instead of crashing.
        if (!cancelled) setResolution("not_found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setId]);

  // Load the lesson list + per-lesson progress once the set has resolved.
  // Decoration, never a blocker: any failure simply leaves the list out.
  useEffect(() => {
    if (!entry) return;
    const userId = readLearnerState().userId;
    let cancelled = false;
    void (async () => {
      const storage = getStorage();
      const [listing, progressRows] = await Promise.all([
        storage.contentLoader
          .listLessons(entry.source, entry.id)
          .catch(() => ({ lessons: [] as string[] })),
        userId
          ? storage.lessonProgress.list(userId).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      // #2890 - bonus lessons sort to the end of the list (a plain
      // directory listing would put "bonus-*" before "01-*"), and the
      // derived unlock state rides the same progress read.
      const ordered = orderWithBonusLast(listing.lessons);
      setBonusUnlocked(
        isBonusUnlocked(listing.lessons, progressRows, entry.id),
      );
      // #2835 - the list previously showed the raw filename. Fetch each
      // lesson's title (mirroring SetLessonList.tsx's "Meine Lektionen"
      // pattern); a per-lesson fetch failure just falls back to the
      // filename for that one row instead of failing the whole list.
      const titles = new Map<string, string>(
        (
          await Promise.all(
            ordered.map(async (filename) => {
              try {
                const lesson = await storage.contentLoader.getLesson(
                  entry.source,
                  entry.id,
                  filename,
                );
                const title = lesson.title?.trim();
                return title ? ([filename, title] as const) : null;
              } catch {
                return null;
              }
            }),
          )
        ).filter((row): row is readonly [string, string] => row !== null),
      );
      if (cancelled) return;
      setLessonList(
        buildSetLessonList({
          setId: entry.id,
          lessons: ordered,
          progress: progressRows,
          titles,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const openFirstLesson = useCallback(
    async (set: ContentSetEntry) => {
      const listing = await getStorage().contentLoader.listLessons(set.source, set.id);
      // #2890 - "start learning" targets the first REGULAR lesson; a
      // bonus-only set (unusual) falls back to its first file.
      const first = baseLessons(listing.lessons)[0] ?? listing.lessons[0];
      // #2935 - resume where progress left off instead of always
      // restarting at lesson 1. `currentFilename` is the same
      // first-unfinished-lesson value already shown as the "Continue
      // here" badge; falls back to `first` for a fresh set or once
      // every lesson is completed (`currentFilename === null`).
      const target = lessonList?.currentFilename ?? first;
      if (!target) {
        notify.warning(t("content.warning.no_lessons_in_set", "This set has no lessons yet."));
        return;
      }
      navigate(
        `/lesson/${encodeURIComponent(setSlug(set.source))}/${encodeURIComponent(
          set.id,
        )}/${encodeURIComponent(target)}`,
      );
    },
    [navigate, t, lessonList],
  );

  const handleStart = useCallback(async () => {
    if (!entry) return;
    setBusy(true);
    try {
      const downloaded = entry.cached_version != null;
      if (!downloaded) {
        setProgress({ current: 0, total: 0 });
        await getStorage().contentLoader.downloadSet(entry.source, entry.id, (p) =>
          setProgress(p),
        );
        // #1709 — an explicit deep-link download revives a previously
        // deleted set; clear any stale dismissal record.
        undismissSet(entry.source, entry.id);
      }
      await openFirstLesson(entry);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(`${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [entry, openFirstLesson, t]);

  const goDiscover = useCallback(() => navigate("/content?tab=discover"), [navigate]);

  return (
    <PageContainer testId="set-deep-link-page">
      <div className="mx-auto mt-10 max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] p-6">
        {resolution === "loading" && (
          <p
            className="flex items-center gap-2 text-sm text-[var(--fg-muted)]"
            role="status"
            aria-live="polite"
            data-testid="set-deep-link-loading"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("content.set_link.loading", "Loading set…")}
          </p>
        )}

        {resolution === "not_found" && (
          <div data-testid="set-deep-link-not-found">
            <h1 className="m-0 text-xl font-semibold">
              {t("content.set_link.not_found_title", "Set not found")}
            </h1>
            <p className="mt-3 text-sm text-[var(--fg-muted)]">
              {t(
                "content.set_link.not_found_body",
                "This set isn’t available - it may not be downloaded yet, or it doesn’t exist.",
              )}
            </p>
            <Button
              type="button"
              className="mt-5 min-h-11"
              onClick={goDiscover}
              data-testid="set-deep-link-discover"
            >
              {t("content.set_link.go_discover", "Discover content")}
            </Button>
          </div>
        )}

        {resolution === "found" && entry && (
          <div data-testid="set-deep-link-found">
            <h1 className="m-0 text-xl font-semibold" data-testid="set-deep-link-title">
              {entry.title}
            </h1>
            {entry.title_native && (
              <p className="mt-1 text-sm text-[var(--fg-muted)]">{entry.title_native}</p>
            )}
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--fg-muted)]">
              <span>{entry.level}</span>
              <span data-testid="set-deep-link-lessons">
                {t("content.set_link.lessons", "{n} lessons").replace(
                  "{n}",
                  String(entry.lesson_count),
                )}
              </span>
            </p>
            {entry.description && <p className="mt-3 text-sm">{entry.description}</p>}

            {progress && (
              <div
                className="mt-4 flex flex-col gap-2"
                role="status"
                aria-live="polite"
                data-testid="set-deep-link-progress"
              >
                <span className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {progress.total > 0
                    ? `${progress.current}/${progress.total}`
                    : t("content.set_link.loading", "Loading set…")}
                </span>
                {progress.total > 0 && (
                  <DownloadProgress
                    current={progress.current}
                    total={progress.total}
                    testId="set-deep-link-progress-bar"
                  />
                )}
              </div>
            )}

            {lessonList && lessonList.total > 0 && (
              <section className="mt-5" data-testid="set-lesson-list">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="m-0 text-base font-semibold">
                    {t("content.set_link.lesson_list", "Lessons")}
                  </h2>
                  <span
                    className="text-sm text-[var(--fg-muted)]"
                    data-testid="set-lesson-progress"
                  >
                    {t(
                      "content.set_link.progress_done",
                      "{done} of {total} lessons completed",
                    )
                      .replace("{done}", String(lessonList.completed))
                      .replace("{total}", String(lessonList.total))}
                  </span>
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {lessonList.lessons.map((lesson) => {
                    // #2890 - a bonus lesson is visible-but-locked while
                    // the game-mode bonus gate is on and the set's regular
                    // lessons are not all at one star yet (feature-state
                    // policy #335: the row stays, the unlock condition is
                    // the tooltip). Gate off = a normal lesson.
                    const locked =
                      bonusGate && lesson.isBonus && !bonusUnlocked;
                    const rowInner = (
                      <>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex-none text-[var(--fg-muted)]">
                            {lesson.index}
                          </span>
                          <span className="truncate">{lesson.title}</span>
                          {lesson.isBonus && (
                            <span
                              className="flex-none rounded-md bg-[var(--accent-subtle)] px-2 py-0.5 text-xs"
                              data-testid="set-lesson-bonus-badge"
                            >
                              {t("content.set_link.bonus_badge", "Bonus")}
                            </span>
                          )}
                          {lesson.isCurrent && (
                            <span
                              className="flex-none rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                              data-testid="set-lesson-current"
                            >
                              {t("content.set_link.current_lesson", "Continue here")}
                            </span>
                          )}
                        </span>
                        {locked ? (
                          <Lock
                            className="h-4 w-4 flex-none text-[var(--fg-muted)]"
                            aria-hidden="true"
                          />
                        ) : (
                          lesson.status === "completed" && (
                            // #2935 - a plain score number read as "done"
                            // only on close inspection; the checkmark
                            // makes completion legible at a glance.
                            <span
                              className="flex flex-none items-center gap-1 text-[var(--fg-muted)]"
                              data-testid={`set-lesson-done-${lesson.filename}`}
                            >
                              <CheckCircle2
                                className="h-4 w-4 text-success"
                                aria-label={t("content.set_link.lesson_completed", "Completed")}
                              />
                              {lesson.scoreTotal !== null && (
                                <span>
                                  {lesson.scoreCorrect} / {lesson.scoreTotal}
                                </span>
                              )}
                            </span>
                          )
                        )}
                      </>
                    );
                    const rowClass =
                      "flex min-h-11 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm";
                    return (
                      <li key={lesson.filename}>
                        {locked ? (
                          <span
                            className={`${rowClass} cursor-not-allowed text-[var(--fg-muted)]`}
                            title={t(
                              "content.set_link.bonus_locked_tooltip",
                              "Finish every regular lesson of this set with at least one star to unlock this bonus lesson.",
                            )}
                            aria-disabled="true"
                            data-testid={`set-lesson-${lesson.index}`}
                            data-status={lesson.status}
                            data-locked="true"
                          >
                            {rowInner}
                          </span>
                        ) : (
                          <Link
                            to={`/lesson/${encodeURIComponent(
                              setSlug(entry.source),
                            )}/${encodeURIComponent(entry.id)}/${encodeURIComponent(
                              lesson.filename,
                            )}`}
                            className={rowClass}
                            data-testid={`set-lesson-${lesson.index}`}
                            data-status={lesson.status}
                            aria-current={lesson.isCurrent ? "step" : undefined}
                          >
                            {rowInner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* #2888 - the set's flash round: self-gating on the game
                mode + special-rounds switch, locked until the set is
                finished with at least one star everywhere. */}
            <FlashRoundCard
              source={entry.source}
              setId={entry.id}
              slug={setSlug(entry.source)}
              setTitle={entry.title}
            />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={handleStart}
                disabled={busy}
                data-testid="set-deep-link-start"
              >
                {entry.cached_version != null
                  ? t("content.set_link.start", "Start learning")
                  : t("content.set_link.download_start", "Download & start")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={goDiscover}
                disabled={busy}
                data-testid="set-deep-link-discover"
              >
                {t("content.set_link.go_discover", "Discover content")}
              </Button>
              {/* #1572 — share this exact set as a deep link + QR. */}
              <SetShareButton entry={entry} />
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
