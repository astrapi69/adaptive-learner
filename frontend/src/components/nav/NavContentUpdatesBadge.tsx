/**
 * NavContentUpdatesBadge — a small header badge that appears next to the
 * reviews/XP badges when an installed content set has a newer version
 * available (#2904). Runs the existing, already-cheap ``update_available``
 * check once per session at app-shell mount (Navigation renders on every
 * authenticated page) instead of only when the learner happens to open
 * ``/content`` — where the same per-row information already lives.
 *
 * Renders nothing while nothing has an update, so it never adds header
 * clutter on a fresh install or a fully up-to-date library.
 */

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router";

import { useI18n } from "../../hooks/ui/useI18n";
import { getContentUpdateCount } from "../../lib/content/browse/content-updates-badge";

export default function NavContentUpdatesBadge() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getContentUpdateCount()
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        // Supplementary chrome — never surface a read failure (offline,
        // a source repo unreachable, ...); the badge just stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === 0) return null;

  const label = t("content.updates_badge", "{n} updates").replace(
    "{n}",
    String(count),
  );
  return (
    <NavLink
      to="/content"
      className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent"
      data-testid="nav-content-updates-badge"
      title={t("content.updates_badge_tooltip", "Content updates available")}
      // WCAG 2.5.3 (matches NavReviewsBadge): the accessible name is
      // composed from the visible label plus the action.
      aria-label={`${label}, ${t("content.updates_badge_action", "view content")}`}
    >
      <RefreshCw size={12} aria-hidden="true" />
      {label}
    </NavLink>
  );
}
