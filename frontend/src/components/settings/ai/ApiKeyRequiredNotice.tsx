/**
 * Inline notice + Settings link for AI-gated UI surfaces
 * (Issue 4 / v1.23.1).
 *
 * Rendered above any action button that fires an AI call
 * when the active provider has no key configured. Replaces
 * the pre-v1.23.1 pattern of letting the user click the
 * button and getting a 400 error toast — the user now sees
 * the blocker BEFORE clicking, plus a direct path to fix it.
 *
 * Usage:
 *
 *   const {ready, hasKey} = useApiKeyStatus();
 *   {ready && !hasKey && <ApiKeyRequiredNotice />}
 *   <button disabled={!hasKey} ...>Analyze</button>
 *
 * Compact mode (``compact={true}``) renders a single line
 * suitable for dense card layouts. Default mode renders a
 * full warning box with the explanation + the link.
 */

import {AlertTriangle} from "lucide-react";
import {Link} from "react-router";

import {useI18n} from "../../../hooks/ui/useI18n";

interface Props {
    /** Compact one-line layout for tight UI contexts.
     *  Default false (full warning box). */
    compact?: boolean;
    /** Per-feature subject line (e.g. "to analyze
     *  conversations"). Default empty (generic copy). */
    feature?: string;
    /** Override the default Settings link target. Useful
     *  when the AI keys live in a non-default Settings
     *  section. Defaults to the AI tab (#1133), where the
     *  provider keys actually live — ``#api-keys`` landed on
     *  the General tab. */
    settingsHref?: string;
}

export default function ApiKeyRequiredNotice({
    compact = false,
    feature,
    settingsHref = "/settings?tab=ai",
}: Props) {
    const {t} = useI18n();
    const body = feature
        ? t(
              "ui.api_key.required_with_feature",
              "API key required {feature}.",
          ).replace("{feature}", feature)
        : t(
              "ui.api_key.required",
              "API key required.",
          );
    const settingsLabel = t(
        "ui.api_key.open_settings",
        "Open Settings",
    );
    if (compact) {
        return (
            <p
                className="api-key-required-compact m-0 mb-2 flex items-center gap-[0.4rem] text-sm text-warning"
                data-testid="api-key-required-notice"
            >
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{body}</span>
                <Link
                    to={settingsHref}
                    data-testid="api-key-required-link"
                    className="ml-auto text-accent"
                >
                    {settingsLabel} →
                </Link>
            </p>
        );
    }
    return (
        <div
            className="api-key-required-notice mb-3 flex items-start gap-2 rounded-app border border-warning bg-[var(--warning-bg)] px-[0.9rem] py-[0.6rem] text-[0.9rem] text-warning"
            data-testid="api-key-required-notice"
            role="status"
        >
            <AlertTriangle
                size={18}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
            />
            <div className="flex-1">
                <strong>{body}</strong>{" "}
                <span>
                    {t(
                        "ui.api_key.required_long",
                        "Configure a provider key in Settings to enable this action.",
                    )}
                </span>
                <div className="mt-[0.4rem]">
                    <Link
                        to={settingsHref}
                        data-testid="api-key-required-link"
                        className="font-semibold text-accent underline"
                    >
                        {settingsLabel} →
                    </Link>
                </div>
            </div>
        </div>
    );
}
