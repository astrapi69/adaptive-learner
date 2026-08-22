/**
 * Small help icon button (Phase 38D).
 *
 * Subtle grey ``?`` icon. Click opens the help drawer on the
 * given glossary entry. Use next to key terms / headings as
 * an escape hatch — NOT as the primary way to reach help
 * content (the tooltip on the term itself is the primary
 * path; this button is the "I never noticed the dotted
 * underline" fallback).
 *
 * Usage:
 *   <h2>Lernprofil <HelpLink glossaryKey="learning_profile" /></h2>
 *
 * Visual rules:
 *   - Default size: 14px (compact, fits inline next to
 *     headings without breaking baseline).
 *   - Opacity 0.5 default, 1 on hover (subtle until
 *     interacted with).
 *   - Mobile uses ``min-width / min-height: 44px`` touch
 *     target via the surrounding ``padding`` (CSS variable).
 *
 * Missing key: button still renders (we don't catch this on
 * the icon side — the ``help-sync.test.ts`` pin catches it
 * at build time). The drawer renders nothing for unknown
 * keys, so a stray help icon at most produces an empty
 * click-no-op.
 */

import {HelpCircle} from "lucide-react";

import {useHelp} from "../../contexts/HelpContext";
import {useButtonTooltips} from "../../hooks/settings/useButtonTooltips";
import {useI18n} from "../../hooks/ui/useI18n";

interface Props {
    glossaryKey: string;
    /** Icon size in px. Default 14 (inline next to headings).
     *  Use 18 for standalone usage (next to labels in forms). */
    size?: number;
    /** Override the aria-label. Defaults to the
     *  ``ui.help.open_help`` translation. */
    label?: string;
    /** Override the button's tab order. Pass ``-1`` to drop the
     *  icon out of the keyboard tab flow (still clickable) when it
     *  would otherwise intercept focus between two form fields —
     *  e.g. on the onboarding form, where the help icon sits in the
     *  DOM between the Name and Topic inputs. Default (undefined)
     *  keeps the native, focusable tab order. */
    tabIndex?: number;
}

export default function HelpLink({
    glossaryKey,
    size = 14,
    label,
    tabIndex,
}: Props) {
    const {openHelp} = useHelp();
    const {t} = useI18n();
    const tooltipsOn = useButtonTooltips();
    const ariaLabel = label ?? t("ui.help.open_help", "Open help");

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                openHelp(glossaryKey);
            }}
            aria-label={ariaLabel}
            title={tooltipsOn ? ariaLabel : undefined}
            tabIndex={tabIndex}
            data-testid={`help-link-${glossaryKey}`}
            // Inline next to headings — keep the bounding box
            // (p-1) close to the icon size so the line-height
            // stays clean. Mobile touch target is handled by a
            // global CSS rule (``.help-link``, !important) that
            // bumps the padding to 12px on viewports <= 768px.
            className="help-link ml-1 inline-flex items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent p-1 align-middle text-[var(--fg-muted)] opacity-50"
            onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.5";
            }}
        >
            <HelpCircle size={size} />
        </button>
    );
}
