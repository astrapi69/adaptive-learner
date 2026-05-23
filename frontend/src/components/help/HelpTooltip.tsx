/**
 * Contextual help tooltip (Phase 38).
 *
 * Wraps a term in the UI with a subtle dotted underline.
 * Hover (desktop) or tap (mobile) opens a Radix HoverCard
 * with the entry's short explanation + a "Learn more" link
 * that opens the help drawer on the full article.
 *
 * Why HoverCard (not Tooltip or Popover): Tooltip can't host
 * interactive content (the "Learn more" button); Popover is
 * click-only. HoverCard is the Radix primitive purpose-built
 * for "hover to reveal interactive content".
 *
 * Usage:
 *   <HelpTooltip glossaryKey="curriculum">Curriculum</HelpTooltip>
 *
 * Layout contract: the dotted underline is subtle (1px
 * dashed, ``var(--fg-muted)``) so the UI does not look like a
 * glossary page. Don't expand to bold/colored — that breaks
 * the "subtle escape hatch" UX rule from the Phase 38 spec.
 *
 * Missing key: renders children plainly. The
 * ``help-sync.test.ts`` pin catches missing keys at build
 * time, so production never hits this fallback path.
 */

import * as HoverCard from "@radix-ui/react-hover-card";
import {type ReactNode} from "react";

import {useHelp} from "../../contexts/HelpContext";
import {useI18n} from "../../hooks/useI18n";
import {getGlossaryEntry} from "../../lib/help-glossary";

interface Props {
    /** Stable glossary key (e.g. ``"curriculum"``,
     *  ``"method_dialogic"``). */
    glossaryKey: string;
    children: ReactNode;
    /** Open delay in ms. Default 300ms keeps hover feel
     *  snappy without firing on every mouse pass-over. */
    openDelay?: number;
    /** Close delay in ms. Default 100ms lets users move
     *  the cursor down into the popover content without
     *  losing focus. */
    closeDelay?: number;
}

export default function HelpTooltip({
    glossaryKey,
    children,
    openDelay = 300,
    closeDelay = 100,
}: Props) {
    const {t, lang} = useI18n();
    const {openHelp} = useHelp();
    const entry = getGlossaryEntry(glossaryKey, lang);

    if (!entry) {
        return <>{children}</>;
    }

    return (
        <HoverCard.Root openDelay={openDelay} closeDelay={closeDelay}>
            <HoverCard.Trigger asChild>
                <span
                    className="help-term"
                    data-testid={`help-term-${glossaryKey}`}
                    style={{
                        // Longhand (not shorthand) so happy-dom's
                        // ``border-bottom``-shorthand parser, which
                        // misroutes the CSS-variable into the
                        // width/style longhands, doesn't corrupt
                        // unit tests. Visual result is identical.
                        //
                        // 2px dashed in the accent colour
                        // (the project's primary brand colour
                        // ``var(--accent)``) makes terms
                        // discoverable without screaming.
                        // ``.help-term:hover`` in ``global.css``
                        // adds a 10% accent-tinted background
                        // pill so the hover state is unambiguous.
                        borderBottomWidth: "2px",
                        borderBottomStyle: "dashed",
                        // ``--accent`` is defined in
                        // ``global.css`` for every theme; no
                        // fallback needed.
                        borderBottomColor: "var(--accent)",
                        cursor: "help",
                        // Padding lets the hover-tint background
                        // pill breathe a few pixels around the
                        // term without nudging line layout.
                        padding: "0 2px",
                        borderRadius: "4px",
                        // The hover background-color transition
                        // is set in global.css on .help-term so
                        // it respects the page-wide
                        // prefers-reduced-motion catch-all.
                    }}
                >
                    {children}
                </span>
            </HoverCard.Trigger>
            <HoverCard.Portal>
                <HoverCard.Content
                    sideOffset={6}
                    align="start"
                    data-testid={`help-popover-${glossaryKey}`}
                    style={{
                        maxWidth: "20rem",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-elevated)",
                        padding: "var(--space-3)",
                        fontSize: "0.875rem",
                        lineHeight: 1.4,
                        zIndex: 1100,
                    }}
                >
                    <div
                        style={{
                            fontWeight: 600,
                            marginBottom: 4,
                            fontSize: "0.9375rem",
                        }}
                    >
                        {entry.title}
                    </div>
                    <div style={{color: "var(--fg)"}}>{entry.short}</div>
                    <button
                        type="button"
                        data-testid={`help-learn-more-${glossaryKey}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            openHelp(glossaryKey);
                        }}
                        style={{
                            display: "inline-block",
                            marginTop: "var(--space-2)",
                            padding: 0,
                            background: "none",
                            border: "none",
                            color: "var(--accent, #6366f1)",
                            cursor: "pointer",
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                            textDecoration: "underline",
                        }}
                    >
                        {t("ui.help.learn_more", "Learn more")}
                    </button>
                </HoverCard.Content>
            </HoverCard.Portal>
        </HoverCard.Root>
    );
}
