/**
 * StrangBadge (About tab, #1172).
 *
 * Shows which deployment strand the running instance is on, sourced
 * exclusively from the build-time provenance (see lib/provenance/build-info):
 *
 *   - **Latest/Test:** clearly marked as a test version with a warning
 *     style (warning tokens + alert icon) so a tester always knows the
 *     build can contain bugs.
 *   - **Haupt:** subtle, neutral — strand + version + hash, no warning.
 *   - **unknown:** muted; happens for local/Docker builds where no deploy
 *     workflow injected the strand.
 *
 * Branch + short commit hash are shown alongside the strand. When the
 * strand had to be inferred (no explicit deploy variable), a small note
 * marks it as a heuristic rather than authoritative. Token-backed
 * Tailwind only; modus-agnostic (reads build literals, not SystemInfo).
 */

import { AlertTriangle, GitBranch, ShieldCheck } from "lucide-react";

import { getBuildInfo, type BuildInfo } from "../../lib/provenance/build-info";

interface Props {
  t: (key: string, fallback?: string) => string;
  /** Override for tests; defaults to the live build info. */
  info?: BuildInfo;
}

export default function StrangBadge({ t, info }: Props) {
  const build = info ?? getBuildInfo();
  const isLatest = build.strang === "latest";
  const isHaupt = build.strang === "haupt";

  const strangLabel = isLatest
    ? t("about.strang.latest", "Latest version (test)")
    : isHaupt
      ? t("about.strang.haupt", "Main version (stable)")
      : t("about.strang.unknown", "Unknown strand");

  return (
    <article
      data-testid="about-strang-badge"
      data-strang={build.strang}
      className="rounded-md border p-3"
      style={
        isLatest
          ? { borderColor: "var(--warning)", background: "var(--warning-bg)" }
          : { borderColor: "var(--border)", background: "var(--surface)" }
      }
    >
      <div className="flex items-center gap-1.5">
        {isLatest ? (
          <AlertTriangle
            size={16}
            aria-hidden="true"
            className="text-warning"
          />
        ) : (
          <ShieldCheck
            size={16}
            aria-hidden="true"
            className="text-fg-secondary"
          />
        )}
        <span
          data-testid="about-strang-label"
          className={
            isLatest
              ? "text-sm font-semibold text-warning"
              : "text-sm font-semibold text-fg-primary"
          }
        >
          {strangLabel}
        </span>
      </div>

      {isLatest && (
        <p
          data-testid="about-strang-warning"
          className="text-sm text-fg-secondary"
          style={{ marginTop: 6, marginBottom: 0 }}
        >
          {t(
            "about.strang.latest_warning",
            "You are using a preview/test build. It is not stable and may contain errors.",
          )}
        </p>
      )}

      <dl
        className="mt-2 grid gap-x-4 gap-y-1 text-sm"
        style={{ gridTemplateColumns: "minmax(0, max-content) minmax(0, 1fr)" }}
      >
        <dt className="text-fg-secondary">
          {t("about.strang.branch_label", "Branch")}
        </dt>
        <dd
          data-testid="about-strang-branch"
          className="m-0 inline-flex min-w-0 items-center gap-1 break-all text-fg-primary"
        >
          <GitBranch size={13} aria-hidden="true" />
          {build.branch}
        </dd>
        <dt className="text-fg-secondary">
          {t("about.strang.commit_label", "Commit")}
        </dt>
        <dd
          data-testid="about-strang-hash"
          className="m-0 min-w-0 break-all text-fg-primary"
        >
          {build.hash}
        </dd>
      </dl>

      {build.derivedFromFallback && build.strang !== "unknown" && (
        <p
          data-testid="about-strang-fallback-note"
          className="muted"
          style={{ marginTop: 6, marginBottom: 0, fontSize: "0.8rem" }}
        >
          {t(
            "about.strang.fallback_note",
            "Strand inferred (no explicit build marker).",
          )}
        </p>
      )}
    </article>
  );
}
