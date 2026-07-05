/**
 * PageContainer — the shared centered page wrapper (#1380).
 *
 * ONE container for a top-level page surface: bounded width
 * (``max-w-5xl`` = 64rem), horizontally centered (``mx-auto``), and
 * uniform padding (``p-4`` = ``--space-4``) — the pattern the Content
 * Browser ("Meine Inhalte") established with the former
 * ``.content-page`` rule. All three Content-hub tabs (Entdecken /
 * Meine Inhalte / Importieren) render inside this SAME wrapper so
 * their container widths cannot drift again (#1380). On narrow
 * viewports the container simply fills the width (``w-full``), so
 * mobile keeps its full-width layout.
 *
 * Renders the page's ``<main id="main">`` landmark (the
 * skip-to-content target), so a page uses exactly one PageContainer
 * per rendered state. App-agnostic and props-driven: content, extra
 * classes, and the testid are caller-supplied.
 *
 * @example
 * <PageContainer testId="discover-page">
 *   <h1>Discover content</h1>
 * </PageContainer>
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The canonical container utilities. Exported so structure tests can
 *  assert every consumer renders the exact same wrapper (no per-page
 *  special widths). */
export const PAGE_CONTAINER_CLASSES = "mx-auto w-full max-w-5xl p-4";

export interface PageContainerProps {
  /** Page content. */
  children: ReactNode;
  /** Extra classes appended to the canonical container set (page-
   *  specific hooks, never width/padding overrides). */
  className?: string;
  /** ``data-testid`` for the root ``<main>``. */
  testId?: string;
}

export default function PageContainer({
  children,
  className,
  testId,
}: PageContainerProps) {
  return (
    <main
      id="main"
      data-slot="page-container"
      data-testid={testId}
      className={cn(PAGE_CONTAINER_CLASSES, className)}
    >
      {children}
    </main>
  );
}
