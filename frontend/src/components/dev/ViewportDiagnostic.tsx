/**
 * ViewportDiagnostic (#1569) — an opt-in, on-device probe for the tap-offset.
 *
 * The tap-offset bug (a touch landing ~1-2 lines below its visible target) only
 * appears on a real device with a real on-screen keyboard, so it can only be
 * measured by hand. This overlay surfaces, live on the phone, the two things the
 * fix decision hinges on:
 *
 *   1. WHERE the phantom offset lives — ``window.scrollY`` (which
 *      {@link useVisualViewportRealign} can reset) vs ``visualViewport.offsetTop``
 *      (which it cannot) — plus ``scale`` (pinch-zoom) and the keyboard shrink.
 *   2. HOW BIG the hit-test desync is, per tap: on every ``pointerdown`` it
 *      records the element that actually received the event and ``ΔY`` (its
 *      rendered top minus the finger's Y).
 *
 * Made phone-friendly (#1569 follow-up): a readable card, a running tap HISTORY,
 * and a **Copy** button that puts the whole report on the clipboard so the values
 * can be pasted straight back — no Mac / Web-Inspector needed. A selectable text
 * block is the fallback if the clipboard API is blocked. Taps ON the panel are
 * ignored, so copying never pollutes the measurement.
 *
 * Collapsed by default (#2779): the fallback textarea sat as a full-width
 * ``pointer-events: auto`` surface over the page and swallowed scroll gestures,
 * so the page could not be scrolled up past the panel on the phone. The report
 * block now lives behind an explicit Details toggle; collapsed, only the two
 * small buttons accept touches.
 *
 * Strictly opt-in and inert for normal users: renders only with ``?vvdiag=1``
 * (persisted; ``?vvdiag=0`` clears), the ``adaptive-learner.vv_diag`` flag, or
 * the Settings toggle (Settings > General > Diagnostics, #2782) — all three
 * share one flag via {@link useViewportDiagnostic}, and the toggle takes
 * effect live (no reload). Fails open — a missing ``visualViewport`` degrades
 * to a no-op.
 *
 * Ghost-bug recorder (#2782): while enabled, every tap record and every
 * significant viewport transition is ALSO appended to the persistent
 * ring-buffer log (``lib/diagnostics/vv-log``), exportable from the same
 * Settings section — so a mis-tap that happened before the overlay's 8-tap
 * history rolled over is still recoverable.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { appendVvLogEntry } from "../../lib/diagnostics/vv-log";
import {
  useViewportDiagnostic,
  useVvPanelVisible,
} from "../../hooks/settings/useViewportDiagnostic";

const FLAG_KEY = "adaptive-learner.vv_diag";
const PANEL_TESTID = "viewport-diagnostic";
const MAX_TAPS = 8;

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
}

function readSnapshot(): Snapshot {
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
  };
}

function activeFix(): string {
  if (typeof document === "undefined") return "off";
  return document.documentElement.dataset.vvfix ?? "off";
}

/**
 * Whether a viewport change is worth a persistent log entry (#2782):
 * the keyboard opened/closed, the pinch-zoom scale moved, or a phantom
 * offset appeared/disappeared in either channel. Plain address-bar /
 * scroll jitter stays out of the log.
 */
function isSignificantTransition(prev: Snapshot, next: Snapshot): boolean {
  const kbdFlipped =
    prev.keyboardShrink >= 150 !== next.keyboardShrink >= 150;
  const scaleMoved = prev.vvScale !== next.vvScale;
  const vvTopFlipped = (prev.vvOffsetTop !== 0) !== (next.vvOffsetTop !== 0);
  const winYFlipped = (prev.winScrollY !== 0) !== (next.winScrollY !== 0);
  return kbdFlipped || scaleMoved || vvTopFlipped || winYFlipped;
}

function tapLine(t: TapInfo): string {
  return `y=${t.y} ${t.tag}[${t.testid}] top=${t.rectTop} ΔY=${t.deltaY} @winY=${t.atWinScrollY} @vvTop=${t.atVvOffsetTop}`;
}

/** The plain-text report the Copy button (and the selectable block) share. */
function buildReport(snap: Snapshot, taps: TapInfo[]): string {
  const head =
    `[vvdiag] fix=${activeFix()} winY=${snap.winScrollY} vvTop=${snap.vvOffsetTop} ` +
    `scale=${snap.vvScale} kbd=${snap.keyboardShrink} vvH=${snap.vvHeight} innerH=${snap.innerHeight}`;
  const body = taps.length
    ? taps.map((t, i) => `${i + 1}. ${tapLine(t)}`).join("\n")
    : "(no taps yet)";
  return `${head}\ntaps (newest first):\n${body}`;
}

export default function ViewportDiagnostic() {
  // Process the ?vvdiag URL parameter ONCE, before the preference hook's
  // initial read — the URL path persists into the same flag the hook (and
  // the Settings toggle, #2782) reads, so both stay a single source.
  useState(() => {
    viewportDiagnosticEnabled();
    return true;
  });
  const enabled = useViewportDiagnostic();
  const panelVisible = useVvPanelVisible();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [taps, setTaps] = useState<TapInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Latest values kept in refs so the Copy handler reads them without re-binding.
  const snapRef = useRef<Snapshot | null>(null);
  const tapsRef = useRef<TapInfo[]>([]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const refresh = () => {
      const s = readSnapshot();
      const prev = snapRef.current;
      if (prev && isSignificantTransition(prev, s)) {
        appendVvLogEntry({
          kind: "viewport",
          ts: Date.now(),
          fix: activeFix(),
          winY: s.winScrollY,
          vvTop: s.vvOffsetTop,
          scale: s.vvScale,
          kbd: s.keyboardShrink,
        });
      }
      snapRef.current = s;
      setSnap(s);
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      // Ignore taps ON the diagnostic panel (the Copy button, the text block) so
      // they never pollute the measured history.
      if (el?.closest?.(`[data-testid="${PANEL_TESTID}"]`)) return;
      const rect = el?.getBoundingClientRect();
      const rectTop = rect ? Math.round(rect.top) : 0;
      const vv = window.visualViewport;
      const tap: TapInfo = {
        y: Math.round(e.clientY),
        tag: el ? el.tagName.toLowerCase() : "?",
        testid: (el?.getAttribute?.("data-testid") ?? "") || "-",
        rectTop,
        deltaY: rectTop - Math.round(e.clientY),
        atWinScrollY: Math.round(window.scrollY),
        atVvOffsetTop: vv ? Math.round(vv.offsetTop) : 0,
      };
      // eslint-disable-next-line no-console
      console.log("[vvdiag]", JSON.stringify(tap));
      appendVvLogEntry({kind: "tap", ts: Date.now(), fix: activeFix(), ...tap});
      const next = [tap, ...tapsRef.current].slice(0, MAX_TAPS);
      tapsRef.current = next;
      setTaps(next);
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

  const handleCopy = useCallback(() => {
    const report = buildReport(
      snapRef.current ?? readSnapshot(),
      tapsRef.current,
    );
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    };
    try {
      void navigator.clipboard?.writeText(report).then(done, done);
    } catch {
      done();
    }
  }, []);

  // Recording is bound to ``enabled`` alone (the effect above): with the
  // panel hidden (#2785) the probe keeps appending to the persistent
  // protocol while rendering nothing — the header/menu stay reachable.
  if (!enabled || !panelVisible || !snap) return null;
  const report = buildReport(snap, taps);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] border-b border-border bg-card/95 px-2 py-1.5 font-mono text-[12px] leading-snug text-fg-primary"
      data-testid={PANEL_TESTID}
    >
      <div className="font-semibold" data-testid="viewport-diagnostic-values">
        fix={activeFix()} winY={snap.winScrollY} vvTop={snap.vvOffsetTop} scale=
        {snap.vvScale} kbd={snap.keyboardShrink}
      </div>
      <div data-testid="viewport-diagnostic-tap">
        {taps[0]
          ? `letzter Tipp: ${tapLine(taps[0])}`
          : "letzter Tipp: (tippe irgendwo)"}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="pointer-events-auto min-h-9 rounded-app border border-accent bg-accent px-3 text-[13px] font-semibold text-accent-foreground"
          data-testid="viewport-diagnostic-copy"
        >
          {copied ? "Kopiert!" : "Werte kopieren"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="pointer-events-auto min-h-9 rounded-app border border-border bg-[var(--bg-elevated)] px-3 text-[13px] text-fg-primary"
          data-testid="viewport-diagnostic-toggle"
        >
          {expanded ? "Details zu" : "Details"}
        </button>
        <span className="text-fg-muted">{taps.length} Tipps</span>
      </div>
      {/* Fallback if the clipboard API is blocked: a selectable block to
          long-press-copy or screenshot. Behind the toggle (#2779) so no
          full-width touch-accepting surface blocks page scrolling. */}
      {expanded && (
        <textarea
          readOnly
          value={report}
          onFocus={(e) => e.currentTarget.select()}
          className="pointer-events-auto mt-1 h-16 w-full resize-none rounded-app border border-border bg-[var(--bg-elevated)] p-1 text-[11px] text-fg-primary"
          data-testid="viewport-diagnostic-report"
        />
      )}
    </div>
  );
}
