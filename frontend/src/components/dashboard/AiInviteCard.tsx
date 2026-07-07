/**
 * AiInviteCard — the ONE inviting "unlock AI help" card on the
 * Dashboard (#1417, Refs #1321/#1322 BYOK).
 *
 * Replaces the pre-#1417 pair of stacked API-key messages (the
 * blue "configure an API key" skip banner + the yellow
 * "API key required to start a session" warning) that greeted
 * every fresh learner. Nothing is broken or missing when no key
 * is configured — the app learns fully without AI — so the card
 * is info-styled (no warning colour, no warning icon) and framed
 * as an optional invitation in the learner's language: connect
 * your own AI provider (Claude, OpenAI or Gemini) to get help
 * inside the lessons. The term "API key" deliberately never
 * appears here; it stays in Settings where it is accurate.
 *
 * Render gates:
 *   - the active provider has no usable key
 *     (``useApiKeyStatus``, both storage modes; hidden until the
 *     status is known so a keyed user never sees a flash)
 *   - not dismissed. "Later" persists the dismissal in
 *     localStorage (the established pref pattern, works in Dexie
 *     mode); the legacy pre-#1417 banner-dismissal key is
 *     honoured so users who already clicked "Verstanden" are not
 *     re-invited.
 *
 * The session-specific "key required" hint did NOT move here —
 * it already lives contextually on /session (#1158).
 */

import {Sparkles} from "lucide-react";
import {useState} from "react";
import {Link} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {useApiKeyStatus} from "../../hooks/settings/useApiKeyStatus";
import {useI18n} from "../../hooks/ui/useI18n";

const DISMISS_KEY = "adaptive-learner.ai_invite_dismissed";
const LEGACY_DISMISS_KEY = "adaptive-learner.api_key_banner_dismissed";

function readDismissed(): boolean {
    try {
        return (
            localStorage.getItem(DISMISS_KEY) === "true" ||
            localStorage.getItem(LEGACY_DISMISS_KEY) === "true"
        );
    } catch {
        return false;
    }
}

export default function AiInviteCard() {
    const {t} = useI18n();
    const {ready, hasKey} = useApiKeyStatus();
    const [dismissed, setDismissed] = useState<boolean>(readDismissed);

    if (!ready || hasKey || dismissed) return null;

    function dismiss() {
        try {
            localStorage.setItem(DISMISS_KEY, "true");
        } catch {
            /* localStorage unavailable — dismiss for this session only */
        }
        setDismissed(true);
    }

    const title = t("dashboard.ai_invite.title", "Unlock AI help (optional)");
    return (
        <section
            role="region"
            aria-label={title}
            data-testid="ai-invite-card"
            className="mb-4 flex flex-col gap-3 rounded-app border border-border bg-bg-surface p-4"
        >
            <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-fg-primary">
                <Sparkles className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                {title}
            </h2>
            <p className="m-0 text-sm text-fg-secondary">
                {t(
                    "dashboard.ai_invite.body",
                    "Connect your own AI provider (Claude, OpenAI or Gemini) to get explanations and help right inside your lessons. The app works fine without it.",
                )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="default" data-testid="ai-invite-connect">
                    <Link to="/settings?tab=ai">
                        {t("dashboard.ai_invite.connect", "Connect now")}
                    </Link>
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={dismiss}
                    data-testid="ai-invite-later"
                >
                    {t("dashboard.ai_invite.later", "Later")}
                </Button>
            </div>
        </section>
    );
}
