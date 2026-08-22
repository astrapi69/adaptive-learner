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
import {useGlossary} from "../../hooks/content/useGlossary";
import {useI18n} from "../../hooks/ui/useI18n";
import {getGlossaryEntry} from "../../lib/help/help-glossary";

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
    // Lazily load the active language's glossary chunk + re-render when it
    // lands (English is eager, so this is a no-op for EN).
    useGlossary(lang);
    const entry = getGlossaryEntry(glossaryKey, lang);

    if (!entry) {
        return <>{children}</>;
    }

    return (
        <HoverCard.Root openDelay={openDelay} closeDelay={closeDelay}>
            <HoverCard.Trigger asChild>
                <span
                    // Padding (px-0.5 py-0) lets the hover-tint
                    // background pill breathe a few pixels around
                    // the term without nudging line layout.
                    //
                    // The hover background-color transition is set
                    // in global.css on .help-term so it respects
                    // the page-wide prefers-reduced-motion
                    // catch-all.
                    className="help-term rounded-[4px] px-0.5 py-0"
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
                        //
                        // These longhands + ``cursor: help`` stay
                        // INLINE (not utilities): the unit test
                        // ``HelpTooltip.test.tsx`` pins them on the
                        // inline ``style`` attribute (happy-dom
                        // resolves CSS-variable borders
                        // inconsistently in computed style).
                        borderBottomWidth: "2px",
                        borderBottomStyle: "dashed",
                        // ``--accent`` is defined in
                        // ``global.css`` for every theme; no
                        // fallback needed.
                        borderBottomColor: "var(--accent)",
                        cursor: "help",
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
                    className="z-[1100] max-w-[20rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-3)] text-[0.875rem] leading-[1.4] shadow-[var(--shadow-elevated)]"
                >
                    <div className="mb-1 text-[0.9375rem] font-semibold">
                        {entry.title}
                    </div>
                    <div className="text-[var(--fg)]">{entry.short}</div>
                    <button
                        type="button"
                        data-testid={`help-learn-more-${glossaryKey}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            openHelp(glossaryKey);
                        }}
                        className="inline-block border-none bg-transparent p-0 mt-[var(--space-2)] text-[0.8125rem] font-medium text-[var(--accent)] underline"
                    >
                        {t("ui.help.learn_more", "Learn more")}
                    </button>
                </HoverCard.Content>
            </HoverCard.Portal>
        </HoverCard.Root>
    );
}
