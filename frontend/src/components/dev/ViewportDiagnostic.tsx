/**
 * ViewportDiagnostic (#1569) — an opt-in, on-device probe for the iOS tap-offset.
 *
 * The tap-offset bug (a touch/caret landing ~1-2 lines below its visible target)
 * does NOT reproduce in Chromium/headless, so it can only be measured on real
 * iOS hardware. This overlay surfaces, live on the device, the two things the
 * fix decision hinges on:
 *
 *   1. WHERE the phantom offset lives — ``window.scrollY`` (which
 *      {@link useVisualViewportRealign} can reset) vs ``visualViewport.offsetTop``
 *      (which it cannot) — plus ``scale`` (pinch-zoom) and the keyboard shrink.
 *   2. HOW BIG the hit-test desync is, per tap: on every ``pointerdown`` it
 *      records the element that ACTUALLY received the event and the vertical
 *      gap between the finger's Y and that element's rendered top
 *      (``deltaY``). A large positive ``deltaY`` with the finger over empty
 *      space is the bug, quantified; correlating it with ``winScrollY`` vs
 *      ``vvOffsetTop`` tells us which lever is the real fix.
 *
 * Strictly opt-in and inert for normal users: it renders only when enabled via
 * ``?vvdiag=1`` (persisted, cleared with ``?vvdiag=0``) or the
 * ``adaptive-learner.vv_diag`` flag. The overlay is ``pointer-events: none`` so
 * it can never alter the hit-testing it measures. Diagnostic, so it fails open:
 * a missing ``visualViewport`` degrades to a no-op, never a crash.
 *
 * @example
 * // Enable on the device: open the site with ?vvdiag=1 appended to the URL.
 * // App() renders <ViewportDiagnostic /> unconditionally; it self-gates.
 */

import { useEffect, useState } from "react";

const FLAG_KEY = "adaptive-learner.vv_diag";

/** Whether the probe is enabled (URL param wins and persists; else the flag). */
export function viewportDiagnosticEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("vvdiag");
    if (q === "1") {
      localStorage.setItem(FLAG_KEY, "1");
      return true;
    }
    if (q === "0") {
      localStorage.removeItem(FLAG_KEY);
      return false;
    }
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

interface TapInfo {
  x: number;
  y: number;
  tag: string;
  testid: string;
  rectTop: number;
  deltaY: number;
  atWinScrollY: number;
  atVvOffsetTop: number;
}

interface Snapshot {
  winScrollY: number;
  vvOffsetTop: number;
  vvScale: number;
  vvHeight: number;
  innerHeight: number;
  keyboardShrink: number;
  tap: TapInfo | null;
}

function readSnapshot(prevTap: TapInfo | null): Snapshot {
  const vv = window.visualViewport;
  const innerHeight = window.innerHeight;
  const vvHeight = vv ? vv.height : innerHeight;
  return {
    winScrollY: Math.round(window.scrollY),
    vvOffsetTop: vv ? Math.round(vv.offsetTop) : 0,
    vvScale: vv ? Math.round(vv.scale * 1000) / 1000 : 1,
    vvHeight: Math.round(vvHeight),
    innerHeight: Math.round(innerHeight),
    keyboardShrink: Math.round(innerHeight - vvHeight),
    tap: prevTap,
  };
}

export default function ViewportDiagnostic() {
  const [enabled] = useState(viewportDiagnosticEnabled);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let tap: TapInfo | null = null;
    const refresh = () => setSnap(readSnapshot(tap));

    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      const rect = el?.getBoundingClientRect();
      const rectTop = rect ? Math.round(rect.top) : 0;
      const vv = window.visualViewport;
      tap = {
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        tag: el ? el.tagName.toLowerCase() : "?",
        testid: (el?.getAttribute?.("data-testid") ?? "") || "-",
        rectTop,
        deltaY: rectTop - Math.round(e.clientY),
        atWinScrollY: Math.round(window.scrollY),
        atVvOffsetTop: vv ? Math.round(vv.offsetTop) : 0,
      };
      // Also log each tap so a remote-debugging console (Android chrome://inspect,
      // Safari Web Inspector) captures a copyable history — a small overlay on a
      // phone is hard to transcribe. Guarded by `enabled`, so silent otherwise.
      // eslint-disable-next-line no-console
      console.log("[vvdiag]", JSON.stringify(tap));
      refresh();
    };

    refresh();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", refresh);
    vv?.addEventListener("scroll", refresh);
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      vv?.removeEventListener("resize", refresh);
      vv?.removeEventListener("scroll", refresh);
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    };
  }, [enabled]);

  if (!enabled || !snap) return null;
  const t = snap.tap;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] select-none border-b border-border bg-card/95 px-2 py-1 font-mono text-[11px] leading-tight text-fg-primary"
      data-testid="viewport-diagnostic"
    >
      <div>
        winY={snap.winScrollY} vvTop={snap.vvOffsetTop} scale={snap.vvScale} kbd=
        {snap.keyboardShrink} (vvH={snap.vvHeight}/innerH={snap.innerHeight}) fix=
        {typeof document !== "undefined"
          ? (document.documentElement.dataset.vvfix ?? "off")
          : "off"}
      </div>
      <div data-testid="viewport-diagnostic-tap">
        {t
          ? `tap y=${t.y} → ${t.tag}[${t.testid}] top=${t.rectTop} ΔY=${t.deltaY} @winY=${t.atWinScrollY} @vvTop=${t.atVvOffsetTop}`
          : "tap: (waiting for a tap…)"}
      </div>
    </div>
  );
}
