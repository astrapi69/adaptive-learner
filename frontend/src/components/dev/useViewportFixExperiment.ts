/**
 * useViewportFixExperiment (#1569) — try a tap-offset fix candidate at runtime.
 *
 * The offset is a cross-platform (iOS + Android) visual-viewport ↔ layout desync
 * that only appears on a real device with a real on-screen keyboard, so it
 * cannot be reproduced in CI. Two blind fixes already shipped-and-reverted
 * (#1570) or shipped-without-effect (#1832). Instead of a third guess, this hook
 * lets the DEVICE be the test bench: each candidate remedy is a ``?vvfix=<id>``
 * toggle, applied at runtime, so the user can cycle candidates on their phone
 * (watching ``ΔY`` on the ``?vvdiag=1`` probe) and report which one zeroes the
 * offset — then that one becomes the real, device-proven fix.
 *
 * Strictly opt-in (``?vvfix=<id>``, persisted; ``?vvfix=off`` clears) and inert
 * otherwise. Candidates:
 *
 *   novhd     shell height 100dvh -> 100vh. Under interactive-widget=resizes-content
 *             the keyboard resizes the layout viewport (ICB), which 100vh tracks
 *             but 100dvh (by spec) does NOT — so #root stays full-height while the
 *             visible area shrank. Tests that mismatch.
 *   vpheight  while the keyboard is open (and not pinch-zoomed), pin the shell to
 *             visualViewport.height. The corrected #1570 (guarded on scale<=1 so
 *             it can't amplify a zoom, the flaw that got #1570 reverted).
 *   nolock    remove overflow:hidden from html/body and let the document scroll
 *             naturally (drop the inner-100dvh-scroller). The "bigger fix".
 *   hardreset on EVERY visualViewport change, reset window + documentElement +
 *             body scroll to 0 (more aggressive, and un-gated, vs the #1832 hook).
 *
 * @example
 * // App():
 * useViewportFixExperiment();
 * // On the phone: open ...?vvdiag=1&vvfix=novhd, tap around, read ΔY.
 */

import { useEffect } from "react";

const FLAG_KEY = "adaptive-learner.vv_fix";
const CANDIDATES = ["novhd", "vpheight", "nolock", "hardreset"] as const;
type Candidate = (typeof CANDIDATES)[number];

/** Minimum visual-viewport shrink (px) counted as "keyboard open". */
const KEYBOARD_OPEN_MIN_PX = 150;

/** Resolve the active candidate from the URL (persisted) or the flag. */
function resolveCandidate(): Candidate | null {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search).get("vvfix");
    if (q === "off") {
      localStorage.removeItem(FLAG_KEY);
      return null;
    }
    if (q && (CANDIDATES as readonly string[]).includes(q)) {
      localStorage.setItem(FLAG_KEY, q);
      return q as Candidate;
    }
    const stored = localStorage.getItem(FLAG_KEY);
    return stored && (CANDIDATES as readonly string[]).includes(stored)
      ? (stored as Candidate)
      : null;
  } catch {
    return null;
  }
}

/** The CSS a candidate injects (keyed on the html data attribute). Empty for
 *  JS-only candidates. ``!important`` + the attribute selector win over the
 *  unlayered 01-base.css shell rules. */
function candidateCss(candidate: Candidate): string {
  const root = 'html[data-vvfix="' + candidate + '"]';
  switch (candidate) {
    case "novhd":
      return `${root}, ${root} body, ${root} #root { height: 100vh !important; }`;
    case "nolock":
      return (
        `${root}, ${root} body { overflow: auto !important; height: auto !important; min-height: 100dvh; }` +
        `${root} #root { overflow: visible !important; height: auto !important; min-height: 100dvh; }`
      );
    case "vpheight":
      // Height override applies only while the keyboard is open (data-vvkbd),
      // set by the JS listener below; otherwise the shell falls back to 100dvh.
      return `${root}[data-vvkbd="open"], ${root}[data-vvkbd="open"] body, ${root}[data-vvkbd="open"] #root { height: var(--vv-height) !important; }`;
    case "hardreset":
      return "";
  }
}

export function useViewportFixExperiment(): void {
  useEffect(() => {
    const candidate = resolveCandidate();
    if (!candidate || typeof document === "undefined") return;
    const html = document.documentElement;
    html.dataset.vvfix = candidate;

    const style = document.createElement("style");
    style.dataset.vvfix = candidate;
    style.textContent = candidateCss(candidate);
    document.head.appendChild(style);

    const vv = window.visualViewport;
    let onVv: (() => void) | null = null;
    if ((candidate === "vpheight" || candidate === "hardreset") && vv) {
      onVv = () => {
        if (candidate === "vpheight") {
          const keyboardOpen =
            vv.scale <= 1.001 &&
            window.innerHeight - vv.height >= KEYBOARD_OPEN_MIN_PX;
          if (keyboardOpen) {
            html.style.setProperty("--vv-height", `${Math.round(vv.height)}px`);
            html.dataset.vvkbd = "open";
          } else {
            html.removeAttribute("data-vvkbd");
            html.style.removeProperty("--vv-height");
          }
        } else {
          // hardreset: force every scroll origin back to 0 on any vv change.
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          if (document.body) document.body.scrollTop = 0;
        }
      };
      onVv();
      vv.addEventListener("resize", onVv);
      vv.addEventListener("scroll", onVv);
    }

    return () => {
      style.remove();
      delete html.dataset.vvfix;
      html.removeAttribute("data-vvkbd");
      html.style.removeProperty("--vv-height");
      if (onVv && vv) {
        vv.removeEventListener("resize", onVv);
        vv.removeEventListener("scroll", onVv);
      }
    };
  }, []);
}
