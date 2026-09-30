/**
 * Footer status channel (#3237): an exercise renderer publishes a short
 * running status ("2 / 5 paired") and the sticky footer shows it next to
 * the Check button, where the learner's eyes are when the tiles have
 * scrolled the top counter out of view.
 *
 * The renderer stays footer-agnostic: it calls ``useFooterStatus(text)``
 * and never knows which footer (the lesson page's ``LessonFooterNav`` or
 * the runner shell's ``RunnerFooter``) renders it. Without a provider the
 * hook is a no-op, so a renderer rendered on its own (unit tests, the
 * exercise preview) publishes into nothing.
 *
 * @example
 * // in the page shell
 * <FooterStatusProvider><Content /><Footer /></FooterStatusProvider>
 * // in a renderer
 * useFooterStatus(submitted ? null : `${matched} / ${total}`);
 * // in a footer
 * <FooterStatusLine testId="lesson-footer-status" />
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface FooterStatusValue {
  text: string | null;
  setText: (text: string | null) => void;
}

const NOOP: FooterStatusValue = { text: null, setText: () => undefined };

const FooterStatusContext = createContext<FooterStatusValue>(NOOP);

/** Holds the one status line the footer below it shows. */
export function FooterStatusProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const value = useMemo(() => ({ text, setText }), [text]);
  return <FooterStatusContext.Provider value={value}>{children}</FooterStatusContext.Provider>;
}

/** Publish ``text`` (or clear it with ``null``) while the caller is mounted. */
export function useFooterStatus(text: string | null): void {
  const { setText } = useContext(FooterStatusContext);
  useEffect(() => {
    setText(text);
    return () => setText(null);
  }, [text, setText]);
}

/** The status line currently published, or ``null``. */
function useFooterStatusText(): string | null {
  return useContext(FooterStatusContext).text;
}

/** The footer's rendering of the published status. ``null`` when nothing is
 *  published, so a footer without status keeps its markup byte-identical.
 *  Decorative: the renderer's own counter is the live region. */
export function FooterStatusLine({ testId }: { testId: string }) {
  const text = useFooterStatusText();
  if (!text) return null;
  return (
    <span
      className="shrink-0 whitespace-nowrap text-sm font-medium text-[var(--fg-muted)]"
      aria-hidden="true"
      data-testid={testId}
    >
      {text}
    </span>
  );
}
