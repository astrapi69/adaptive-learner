/**
 * RepoCategoryBadge — one consistent trust-/origin badge for an imported
 * content source (#1319).
 *
 * Renders the unified {@link RepoCategory} (resolved via
 * ``resolveRepoCategory``) with an icon + localized label, replacing the
 * previously-scattered inline trust/coach/recommended badges. Props-driven: the
 * caller passes the resolved ``category`` and its ``t`` function, so the badge
 * carries no storage/i18n coupling and can be reused wherever a source is
 * listed (repo settings, content browser). Token-backed Tailwind only.
 *
 * @example
 * <RepoCategoryBadge
 *   category={resolveRepoCategory({ source, trust: repo.trust, coach: repo.coach })}
 *   t={t}
 * />
 */

import { Shield, ShieldCheck, ShieldQuestion, Lock } from "lucide-react";
import type { ComponentType } from "react";

import type { RepoCategory } from "../../lib/content/repos/content-repos";

export interface RepoCategoryBadgeProps {
  category: RepoCategory;
  /** Localiser; defaults to the English fallback (identity on the fallback). */
  t?: (key: string, fallback?: string) => string;
  testId?: string;
  /** Extra layout classes appended by the host (e.g. ``ml-1 shrink-0`` in a
   *  flex heading row); the badge's own look stays token-backed inside. */
  className?: string;
}

interface Style {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  key: string;
  fallback: string;
  /** Token-backed background + foreground classes. */
  className: string;
}

const STYLES: Record<RepoCategory, Style> = {
  official: {
    icon: Shield,
    key: "content_repo.badge.official",
    fallback: "Official",
    className:
      "bg-[color-mix(in_srgb,var(--accent)_16%,var(--bg-surface))] text-[var(--accent-text)]",
  },
  private: {
    icon: Lock,
    key: "content_repo.badge.private",
    fallback: "Private",
    className: "bg-[var(--info-bg)] text-[var(--info)]",
  },
  validated: {
    icon: ShieldCheck,
    key: "content_repo.trust.validated",
    fallback: "Validated",
    className: "bg-[var(--success-bg)] text-[var(--success)]",
  },
  unverified: {
    icon: ShieldQuestion,
    key: "content_repo.trust.unknown",
    fallback: "Unverified",
    className: "bg-[var(--warning-bg)] text-[var(--warning)]",
  },
};

export default function RepoCategoryBadge({
  category,
  t = (_key, fallback) => fallback ?? "",
  testId = "repo-category-badge",
  className,
}: RepoCategoryBadgeProps) {
  const style = STYLES[category];
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold ${style.className}${className ? ` ${className}` : ""}`}
      data-testid={testId}
      data-category={category}
    >
      <Icon className="h-3 w-3" aria-hidden={true} />
      {t(style.key, style.fallback)}
    </span>
  );
}
