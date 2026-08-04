/**
 * Shared primary-navigation target model (#1390).
 *
 * ONE typed list of primary destinations (route, label key, icon, group)
 * drives the single primary-navigation renderer ({@link ../nav/Navigation}).
 * That one links container renders in two PRESENTATIONS — the desktop inline
 * top bar and the mobile hamburger drawer — switched by a single boolean and
 * exposed as ``data-variant``; CSS drives the layout, both presentations emit
 * the same anchors from this list, so the desktop and mobile route sets can
 * never drift. (Unlike ``lib/settings/sidebar-model.ts``, which feeds two
 * genuinely separate renderers, here there is one renderer with two looks.)
 *
 * ``Navigation.viewport.test.tsx`` pins that both presentations expose the
 * same route set; ``nav-targets.test.ts`` pins this model's own shape against
 * a literal table (count, order, groups, labels, uniqueness) so an empty or
 * wrong model fails loudly instead of reading green (#2343).
 *
 * History of the entry set: EXP-037 (#850) reduced the bar to grouped-order
 * entries; #856 merged "My content" + "Discover" into one Content entry;
 * #1129 re-added Session; #1149 added Contribute, #1494 dropped it again
 * (the gap-suggestion section moved into /content, /contribute redirects
 * there). Removed from the bar but reachable elsewhere: Curriculum +
 * Statistics (tabs in /progress), Import (tab in /content), Anki (action on
 * /content).
 */

import {
  BarChart3,
  BookOpen,
  HelpCircle,
  Home,
  Map as MapIcon,
  MessageSquare,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

/** Group ids in render order; ``utility`` entries render flat (no header). */
export type NavTargetGroup = "learn" | "content" | "progress" | "utility";

/** One primary-navigation destination. */
export interface NavTarget {
  /** Route the entry navigates to. */
  readonly to: string;
  /** i18n key for the label (existing keys — i18n unchanged). */
  readonly labelKey: string;
  /** English fallback passed to ``t()``. */
  readonly labelFallback: string;
  /** Icon for renderers that show one (bottom tab bar; the top bar doesn't). */
  readonly icon: LucideIcon;
  /** Labelled group the entry belongs to. */
  readonly group: NavTargetGroup;
  /** ``data-testid`` of the rendered entry. */
  readonly testId: string;
}

/** A labelled nav group (the uppercase section headers). */
export interface NavGroupDef {
  readonly id: NavTargetGroup;
  readonly labelKey: string;
  readonly labelFallback: string;
  readonly testId: string;
}

/** The labelled groups, in render order (utility renders flat after them). */
export const NAV_GROUPS: readonly NavGroupDef[] = [
  {
    id: "learn",
    labelKey: "nav.group.learn",
    labelFallback: "LEARN",
    testId: "nav-group-learn",
  },
  {
    id: "content",
    labelKey: "nav.group.content",
    labelFallback: "CONTENT",
    testId: "nav-group-content",
  },
  {
    id: "progress",
    labelKey: "nav.group.progress",
    labelFallback: "PROGRESS",
    testId: "nav-group-progress",
  },
];

/** The single source of truth for the primary destinations. */
export const NAV_TARGETS: readonly NavTarget[] = [
  {
    to: "/dashboard",
    labelKey: "nav.dashboard",
    labelFallback: "Dashboard",
    icon: Home,
    group: "learn",
    testId: "nav-dashboard",
  },
  {
    to: "/learning-path",
    labelKey: "nav.learning_path",
    labelFallback: "Learning Path",
    icon: MapIcon,
    group: "learn",
    testId: "nav-learning-path",
  },
  {
    to: "/session",
    labelKey: "nav.session",
    labelFallback: "Session",
    icon: MessageSquare,
    group: "learn",
    testId: "nav-session",
  },
  {
    to: "/content",
    labelKey: "nav.tab.content",
    labelFallback: "Content",
    icon: BookOpen,
    group: "content",
    testId: "nav-content",
  },
  {
    to: "/progress",
    labelKey: "nav.progress",
    labelFallback: "Progress",
    icon: BarChart3,
    group: "progress",
    testId: "nav-progress",
  },
  {
    to: "/settings",
    labelKey: "nav.settings",
    labelFallback: "Settings",
    icon: SettingsIcon,
    group: "utility",
    testId: "nav-settings",
  },
];

/**
 * Help is a primary entry but an ACTION (opens the HelpDrawer in place, no
 * route change), so it is modelled beside the route targets. Placement may
 * vary per surface; presence is part of the parity invariant.
 */
export const HELP_TARGET = {
  labelKey: "nav.help",
  labelFallback: "Help",
  icon: HelpCircle,
  testId: "nav-help",
} as const;

/** The targets of one group, in declaration order. */
export function navTargetsByGroup(group: NavTargetGroup): readonly NavTarget[] {
  return NAV_TARGETS.filter((target) => target.group === group);
}

/**
 * Look up a primary target by route. Throws on an unknown route so a
 * consumer referencing a dropped destination fails loudly at render/test
 * time instead of silently rendering a dead entry.
 */
export function navTarget(to: string): NavTarget {
  const target = NAV_TARGETS.find((candidate) => candidate.to === to);
  if (!target) {
    throw new Error(`Unknown primary nav target: ${to}`);
  }
  return target;
}
