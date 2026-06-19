/**
 * LevelProgressCard (#727) — a reusable Level-Detail panel that COMPOSES
 * the {@link LevelDetail} progress block (level + bar + "{n} XP to next
 * level", shipped in #730) with two further sections the headline ask
 * wanted: a 7-day activity mini-chart and the level-milestone ladder
 * (which documents the level thresholds).
 *
 * App-agnostic and props-driven: all values are pre-computed and every
 * label is caller-supplied (templates with ``{placeholder}`` tokens), so
 * it imports no i18n / storage / icon library. Token-backed Tailwind only,
 * so it recolors across all 12 themes. Reusable anywhere a level
 * breakdown is shown — a header popover, the Dashboard, a stats page.
 *
 * @example
 * <LevelProgressCard
 *   level={3} xpIntoLevel={275} xpToNext={25}
 *   levelLabel="Level" toNextLabel="25 XP to next level"
 *   history={[{date:"2026-06-12",count:1}, …]}
 *   milestones={[{level:1,xp:0,reached:true}, …]}
 *   labels={{ activityTitle:"Activity (last 7 days)", … }}
 * />
 */

import LevelDetail from "./LevelDetail";

export interface LevelProgressLabels {
  /** Heading for the 7-day chart, e.g. "Activity (last 7 days)". */
  activityTitle: string;
  /** Per-bar unit for the accessible label, e.g. "sessions". */
  activityUnit: string;
  /** Shown when the 7-day window had no activity. */
  activityEmpty: string;
  /** Heading for the milestone ladder, e.g. "Milestones". */
  milestonesTitle: string;
  /** Per-row template, e.g. "Level {level}". */
  milestoneLevel: string;
  /** Per-row XP template, e.g. "{xp} XP". */
  milestoneXp: string;
  /** Accessible "reached" marker label. */
  reached: string;
  /** Accessible "locked" marker label. */
  locked: string;
  /** A short explanation of how levels are computed (documents the system). */
  howItWorks: string;
}

export interface LevelProgressCardProps {
  level: number;
  /** XP accumulated within the current level (drives the bar). */
  xpIntoLevel: number;
  /** XP still needed to reach the next level (0 = max). */
  xpToNext: number;
  /** Word before the level number, e.g. "Level". */
  levelLabel: string;
  /** Pre-formatted "{n} XP to next level" line. */
  toNextLabel: string;
  /** Accessible name for the progress bar. */
  progressAriaLabel?: string;
  history: ReadonlyArray<{ date: string; count: number }>;
  milestones: ReadonlyArray<{ level: number; xp: number; reached: boolean }>;
  labels: LevelProgressLabels;
  testId?: string;
}

function fill(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/** A weekday letter for an ISO date (locale-independent index lookup). */
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"] as const;

export default function LevelProgressCard({
  level,
  xpIntoLevel,
  xpToNext,
  levelLabel,
  toNextLabel,
  progressAriaLabel,
  history,
  milestones,
  labels,
  testId = "level-progress-card",
}: LevelProgressCardProps) {
  const maxCount = history.reduce((m, h) => Math.max(m, h.count), 0);
  const hasActivity = maxCount > 0;

  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      {/* Level + progress bar + to-next (the #730 block, reused). */}
      <LevelDetail
        level={level}
        xpIntoLevel={xpIntoLevel}
        xpToNext={xpToNext}
        levelLabel={levelLabel}
        toNextLabel={toNextLabel}
        progressAriaLabel={progressAriaLabel}
      />

      {/* 7-day activity mini-chart. */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-fg-primary">
          {labels.activityTitle}
        </h4>
        {hasActivity ? (
          <div
            className="flex items-end justify-between gap-1"
            style={{ height: 48 }}
            data-testid="level-detail-history"
          >
            {history.map((d) => {
              const h = Math.round((d.count / maxCount) * 100);
              const weekday = WEEKDAY[new Date(`${d.date}T00:00:00Z`).getUTCDay()];
              return (
                <div
                  key={d.date}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    className="w-full rounded-sm bg-accent"
                    style={{ height: `${Math.max(d.count > 0 ? 10 : 2, h)}%` }}
                    aria-label={`${d.date}: ${d.count} ${labels.activityUnit}`}
                    role="img"
                    data-testid="level-detail-history-bar"
                  />
                  <span className="text-[0.6rem] text-fg-muted" aria-hidden="true">
                    {weekday}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p
            className="text-xs text-fg-muted"
            data-testid="level-detail-history-empty"
          >
            {labels.activityEmpty}
          </p>
        )}
      </div>

      {/* Milestone ladder — documents the level thresholds visually. */}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-xs font-semibold text-fg-primary">
          {labels.milestonesTitle}
        </h4>
        <ul className="flex flex-col gap-1" data-testid="level-detail-milestones">
          {milestones.map((m) => {
            const isCurrent = m.level === level;
            return (
              <li
                key={m.level}
                className={`flex items-center justify-between rounded-md border px-2.5 py-1 text-xs ${
                  isCurrent
                    ? "border-accent bg-accent/10 font-semibold text-fg-primary"
                    : m.reached
                      ? "border-border-subtle text-fg-secondary"
                      : "border-border-subtle text-fg-muted"
                }`}
                data-testid={`level-detail-milestone-${m.level}`}
                aria-current={isCurrent ? "true" : undefined}
              >
                <span>{fill(labels.milestoneLevel, { level: m.level })}</span>
                <span className="flex items-center gap-2">
                  <span>{fill(labels.milestoneXp, { xp: m.xp })}</span>
                  <span aria-hidden="true">{m.reached ? "✓" : "•"}</span>
                  <span className="sr-only">
                    {m.reached ? labels.reached : labels.locked}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[0.65rem] text-fg-muted" data-testid="level-detail-how">
          {labels.howItWorks}
        </p>
      </div>
    </div>
  );
}
