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
 * Per-tap state (#2853): each tap record also carries ``@kbd`` (keyboard
 * shrink), ``@scale`` and ``focus=`` (the element focused BEFORE the tap)
 * AT TAP TIME — the head snapshot only shows the state after the run, which
 * left the 2026-09-01 iPhone reading (``winY=vvTop`` up to 191 while the
 * head said ``kbd=0``) ambiguous between keyboard-open reveal-scroll and a
 * zoomed-out drift. The head additionally reports ``vvW``/``innerW``/``docW``
 * so a layout wider than the viewport (the suspected trigger of Safari's
 * auto zoom-out to ``scale<1`` despite ``user-scalable=no``) is measurable.
 *
 * Raw heights + the third scroll source (#2870): each tap also carries
 * ``@vvH``/``@innerH`` (the raw values behind ``@kbd``, so a stuck
 * ``innerHeight`` — i.e. an ineffective ``interactive-widget=resizes-content``
 * — is distinguishable from a jumping ``vv.height``) and ``@rootY``
 * (``#root.scrollTop``); the head adds ``rootY``/``docH``. The 2026-09-01
 * drift capture showed ``@vvTop + @kbd`` summing exactly to the full
 * keyboard height — only these raw values can attribute which quantity
 * Safari actually moved during its focus-reveal.
 *
 * Self-answering report (#2883): the head carries the environment the
 * open diagnosis questions keep asking for — ``screenW``/``screenH``/``dpr``
 * (``innerW x scale = screenW`` proves a uniform Safari page zoom without
 * checking the aA menu), ``standalone`` (installed app vs browser tab) —
 * plus a ``ua=`` line (iOS version decides ``interactive-widget``
 * support, 17.4+). Every tap line carries ``t=`` (seconds since probe
 * mount) and the report gains an ``events`` timeline: each significant
 * viewport transition (keyboard flip, scale change, an offset-channel
 * jump of ~a line height) with the full state after it — the drift forms
 * BETWEEN taps, so the transitions themselves are the evidence.
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
const MAX_EVENTS = 12;

/** Seconds since ``start`` with 0.1 s precision — the report's relative clock. */
function relSeconds(start: number): number {
  return Math.round((Date.now() - start) / 100) / 10;
}

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
  t: number;
  y: number;
  tag: string;
  testid: string;
  rectTop: number;
  deltaY: number;
  atWinScrollY: number;
  atVvOffsetTop: number;
  atKbd: number;
  atScale: number;
  focus: string;
  atVvHeight: number;
  atInnerHeight: number;
  atRootScrollY: number;
}

/**
 * One significant viewport transition, kept in the report's own timeline
 * (#2883). The drift forms BETWEEN taps (reading 4: tap N clean, tap N+1
 * at vvTop=253), so the report needs the transitions themselves — with
 * the same relative clock the tap lines carry, and the full state after
 * the transition.
 */
interface VvEventInfo {
  t: number;
  winY: number;
  vvTop: number;
  kbd: number;
  scale: number;
  vvH: number;
  innerH: number;
  rootY: number;
}

interface Snapshot {
  winScrollY: number;
  vvOffsetTop: number;
  vvScale: number;
  vvHeight: number;
  innerHeight: number;
  keyboardShrink: number;
  vvWidth: number;
  innerWidth: number;
  docWidth: number;
  rootScrollY: number;
  docHeight: number;
  screenWidth: number;
  screenHeight: number;
  dpr: number;
  standalone: boolean;
}

/**
 * ``#root``'s scrollTop — the app shell's ONLY legitimate scroller
 * (#1415). Recorded per tap and in the head (#2870) so a focus-reveal
 * can be attributed: Safari revealing a field by scrolling ``#root`` is
 * the healthy path; revealing it by panning the visual viewport
 * (``vvTop`` > 0) is the drift the 2026-09-01 reading caught live.
 */
function rootScrollTop(): number {
  if (typeof document === "undefined") return 0;
  const root = document.getElementById("root");
  return root ? Math.round(root.scrollTop) : 0;
}

/**
 * Whether the page runs as an installed (home-screen) app rather than a
 * browser tab (#2883) — the two contexts differ in browser chrome and
 * keyboard behaviour, so the report states which one was measured.
 */
function isStandaloneDisplay(): boolean {
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      return true;
    }
    const nav = navigator as Navigator & { standalone?: boolean };
    return Boolean(nav.standalone);
  } catch {
    return false;
  }
}

function readSnapshot(): Snapshot {
  const vv = window.visualViewport;
  const innerHeight = window.innerHeight;
  const innerWidth = window.innerWidth;
  const vvHeight = vv ? vv.height : innerHeight;
  return {
    winScrollY: Math.round(window.scrollY),
    vvOffsetTop: vv ? Math.round(vv.offsetTop) : 0,
    vvScale: vv ? Math.round(vv.scale * 1000) / 1000 : 1,
    vvHeight: Math.round(vvHeight),
    innerHeight: Math.round(innerHeight),
    keyboardShrink: Math.round(innerHeight - vvHeight),
    vvWidth: Math.round(vv ? vv.width : innerWidth),
    innerWidth: Math.round(innerWidth),
    docWidth:
      typeof document === "undefined"
        ? 0
        : Math.round(document.documentElement.scrollWidth),
    rootScrollY: rootScrollTop(),
    docHeight:
      typeof document === "undefined"
        ? 0
        : Math.round(document.documentElement.scrollHeight),
    screenWidth: Math.round(window.screen?.width ?? 0),
    screenHeight: Math.round(window.screen?.height ?? 0),
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    standalone: isStandaloneDisplay(),
  };
}

/**
 * The element holding focus RIGHT NOW, as ``tag[testid]`` (``-`` when
 * nothing is focused). Read at ``pointerdown`` time this is the element
 * focused BEFORE the tap — i.e. whether a text field (and thus the
 * keyboard / Safari's focus-reveal scroll) was still active when the
 * tap landed (#2853).
 */
function describeFocused(): string {
  if (typeof document === "undefined") return "-";
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return "-";
  }
  const testid = el.getAttribute("data-testid") ?? "";
  return `${el.tagName.toLowerCase()}[${testid || "-"}]`;
}

function activeFix(): string {
  if (typeof document === "undefined") return "off";
  return document.documentElement.dataset.vvfix ?? "off";
}

/**
 * Minimum change (px) in a phantom-offset channel that counts as its own
 * transition (#2883): roughly one text line. Zero-flips alone missed the
 * reading-1 drift growing 89 -> 155 -> 191 (all non-zero).
 */
const OFFSET_STEP_PX = 24;

/**
 * Whether a viewport change is worth a persistent log entry (#2782) and
 * a row in the report's event timeline (#2883): the keyboard
 * opened/closed, the pinch-zoom scale moved, or a phantom offset
 * appeared/disappeared OR moved by at least {@link OFFSET_STEP_PX} in
 * either channel. Plain address-bar / scroll jitter stays out.
 */
function isSignificantTransition(prev: Snapshot, next: Snapshot): boolean {
  const kbdFlipped =
    prev.keyboardShrink >= 150 !== next.keyboardShrink >= 150;
  const scaleMoved = prev.vvScale !== next.vvScale;
  const vvTopFlipped = (prev.vvOffsetTop !== 0) !== (next.vvOffsetTop !== 0);
  const winYFlipped = (prev.winScrollY !== 0) !== (next.winScrollY !== 0);
  const vvTopStepped =
    Math.abs(next.vvOffsetTop - prev.vvOffsetTop) >= OFFSET_STEP_PX;
  const winYStepped =
    Math.abs(next.winScrollY - prev.winScrollY) >= OFFSET_STEP_PX;
  return (
    kbdFlipped ||
    scaleMoved ||
    vvTopFlipped ||
    winYFlipped ||
    vvTopStepped ||
    winYStepped
  );
}

function tapLine(t: TapInfo): string {
  return (
    `t=${t.t} y=${t.y} ${t.tag}[${t.testid}] top=${t.rectTop} ΔY=${t.deltaY} ` +
    `@winY=${t.atWinScrollY} @vvTop=${t.atVvOffsetTop} @kbd=${t.atKbd} ` +
    `@scale=${t.atScale} focus=${t.focus} @vvH=${t.atVvHeight} ` +
    `@innerH=${t.atInnerHeight} @rootY=${t.atRootScrollY}`
  );
}

function eventLine(e: VvEventInfo): string {
  return (
    `t=${e.t} winY=${e.winY} vvTop=${e.vvTop} kbd=${e.kbd} ` +
    `scale=${e.scale} vvH=${e.vvH} innerH=${e.innerH} rootY=${e.rootY}`
  );
}

/**
 * Which build produced this report (#2994): version + commit + branch from
 * the #1873/#1172 build defines. A pasted report must answer "does this
 * device even RUN the fix?" itself — the public site (main, releases only)
 * and the develop preview diverge for weeks, and a fresh install of the
 * wrong one reads exactly like a failed fix.
 */
function buildStamp(): string {
  const v = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "?";
  const hash = typeof __BUILD_HASH__ === "string" ? __BUILD_HASH__ : "?";
  const branch = typeof __BUILD_BRANCH__ === "string" ? __BUILD_BRANCH__ : "?";
  return `v=${v} build=${hash} branch=${branch}`;
}

/** The plain-text report the Copy button (and the selectable block) share. */
function buildReport(
  snap: Snapshot,
  taps: TapInfo[],
  events: VvEventInfo[],
): string {
  const head =
    `[vvdiag] fix=${activeFix()} winY=${snap.winScrollY} vvTop=${snap.vvOffsetTop} ` +
    `scale=${snap.vvScale} kbd=${snap.keyboardShrink} vvH=${snap.vvHeight} innerH=${snap.innerHeight} ` +
    `vvW=${snap.vvWidth} innerW=${snap.innerWidth} docW=${snap.docWidth} ` +
    `rootY=${snap.rootScrollY} docH=${snap.docHeight} ` +
    `screenW=${snap.screenWidth} screenH=${snap.screenHeight} dpr=${snap.dpr} ` +
    `standalone=${snap.standalone ? 1 : 0} ${buildStamp()}`;
  const ua = `ua=${typeof navigator === "undefined" ? "?" : navigator.userAgent}`;
  const tapBody = taps.length
    ? taps.map((t, i) => `${i + 1}. ${tapLine(t)}`).join("\n")
    : "(no taps yet)";
  const eventBody = events.length
    ? events.map((e, i) => `${i + 1}. ${eventLine(e)}`).join("\n")
    : "(no events yet)";
  return (
    `${head}\n${ua}\ntaps (newest first):\n${tapBody}\n` +
    `events (newest first):\n${eventBody}`
  );
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
  const [events, setEvents] = useState<VvEventInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Latest values kept in refs so the Copy handler reads them without re-binding.
  const snapRef = useRef<Snapshot | null>(null);
  const tapsRef = useRef<TapInfo[]>([]);
  const eventsRef = useRef<VvEventInfo[]>([]);
  // The report's relative clock starts when the probe mounts (#2883).
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const refresh = () => {
      const s = readSnapshot();
      const prev = snapRef.current;
      if (prev && isSignificantTransition(prev, s)) {
        const event: VvEventInfo = {
          t: relSeconds(startRef.current),
          winY: s.winScrollY,
          vvTop: s.vvOffsetTop,
          kbd: s.keyboardShrink,
          scale: s.vvScale,
          vvH: s.vvHeight,
          innerH: s.innerHeight,
          rootY: s.rootScrollY,
        };
        appendVvLogEntry({
          kind: "viewport",
          ts: Date.now(),
          fix: activeFix(),
          ...event,
        });
        const nextEvents = [event, ...eventsRef.current].slice(0, MAX_EVENTS);
        eventsRef.current = nextEvents;
        setEvents(nextEvents);
      }
      snapRef.current = s;
      setSnap(s);
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      // Ignore taps ON the diagnostic panel (the Copy button, the text block)
      // and on the sticky bar-toggle button (#2799) so they never pollute the
      // measured history.
      if (
        el?.closest?.(
          `[data-testid="${PANEL_TESTID}"], [data-testid="vv-panel-fab"]`,
        )
      ) {
        return;
      }
      const rect = el?.getBoundingClientRect();
      const rectTop = rect ? Math.round(rect.top) : 0;
      const vv = window.visualViewport;
      const tap: TapInfo = {
        t: relSeconds(startRef.current),
        y: Math.round(e.clientY),
        tag: el ? el.tagName.toLowerCase() : "?",
        testid: (el?.getAttribute?.("data-testid") ?? "") || "-",
        rectTop,
        deltaY: rectTop - Math.round(e.clientY),
        atWinScrollY: Math.round(window.scrollY),
        atVvOffsetTop: vv ? Math.round(vv.offsetTop) : 0,
        atKbd: Math.round(window.innerHeight - (vv ? vv.height : window.innerHeight)),
        atScale: vv ? Math.round(vv.scale * 1000) / 1000 : 1,
        focus: describeFocused(),
        atVvHeight: Math.round(vv ? vv.height : window.innerHeight),
        atInnerHeight: Math.round(window.innerHeight),
        atRootScrollY: rootScrollTop(),
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
      eventsRef.current,
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
  const report = buildReport(snap, taps, events);
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
