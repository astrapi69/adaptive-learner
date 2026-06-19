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
import {Link} from "react-router-dom";

import {useI18n} from "../hooks/ui/useI18n";

interface Props {
    /** Compact one-line layout for tight UI contexts.
     *  Default false (full warning box). */
    compact?: boolean;
    /** Per-feature subject line (e.g. "to analyze
     *  conversations"). Default empty (generic copy). */
    feature?: string;
    /** Override the default Settings link target. Useful
     *  when the AI keys live in a non-default Settings
     *  section. Defaults to ``/settings#api-keys``. */
    settingsHref?: string;
}

export default function ApiKeyRequiredNotice({
    compact = false,
    feature,
    settingsHref = "/settings#api-keys",
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
                className="api-key-required-compact"
                data-testid="api-key-required-notice"
                style={{
                    margin: "0 0 0.5rem 0",
                    fontSize: "0.875rem",
                    color: "var(--warning)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                }}
            >
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{body}</span>
                <Link
                    to={settingsHref}
                    data-testid="api-key-required-link"
                    style={{
                        marginLeft: "auto",
                        color: "var(--accent)",
                    }}
                >
                    {settingsLabel} →
                </Link>
            </p>
        );
    }
    return (
        <div
            className="api-key-required-notice"
            data-testid="api-key-required-notice"
            role="status"
            style={{
                margin: "0 0 0.75rem 0",
                padding: "0.6rem 0.9rem",
                background: "var(--warning-bg)",
                color: "var(--warning)",
                border: "1px solid var(--warning)",
                borderRadius: "var(--radius-md, 6px)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                fontSize: "0.9rem",
            }}
        >
            <AlertTriangle
                size={18}
                aria-hidden="true"
                style={{flexShrink: 0, marginTop: 2}}
            />
            <div style={{flex: 1}}>
                <strong>{body}</strong>{" "}
                <span>
                    {t(
                        "ui.api_key.required_long",
                        "Configure a provider key in Settings to enable this action.",
                    )}
                </span>
                <div style={{marginTop: "0.4rem"}}>
                    <Link
                        to={settingsHref}
                        data-testid="api-key-required-link"
                        style={{
                            color: "var(--accent)",
                            fontWeight: 600,
                            textDecoration: "underline",
                        }}
                    >
                        {settingsLabel} →
                    </Link>
                </div>
            </div>
        </div>
    );
}
