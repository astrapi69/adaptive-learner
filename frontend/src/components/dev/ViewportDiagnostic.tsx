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
 *
 * Intent and outcome (#3043): eight device readings later the report
 * still could not say which taps were WRONG (guessed from ΔY's sign),
 * what a tap actually ACTIVATED (the click/focus follow the pointerdown
 * and can land elsewhere during a reveal pan), or what the tester MEANT
 * (the element 1-2 lines above the finger). Each tap therefore also
 * records the layout hit-test at the finger (``hit=``, disagreeing with
 * the event target only on a real desync), the two candidates above it
 * (``above1``/``above2``), raw ``pageY``/``screenY``, the fixed chrome's
 * rendered position (``hdrTop`` of ``app-nav``, ``ftrBot`` of the lesson
 * footer — the WebKit fixed-position regression made measurable), the
 * scroller's reserve (``room``, the #3019 "no space" fact) and the
 * focused field's rectangle against the visual viewport (``focusTop`` /
 * ``focusBot`` / ``focusVis``). ``click`` and ``focus`` arrivals become
 * protocol entries of their own, and a **Daneben!** button lets the
 * tester mark the tap that just mis-landed; the report renders all three
 * as an ``actions`` section next to the hook decisions.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { appendVvLogEntry, readVvLog } from "../../lib/diagnostics/vv-log";
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
  /** #3043 — the layout hit-test at the finger (``elementFromPoint``);
   *  differs from the event target only on a real hit-test desync. */
  hit: string;
  /** #3043 — what sits one / two text lines ABOVE the finger: the
   *  candidates the tester most likely aimed at ("lands 1-2 lines low"). */
  above1: string;
  above2: string;
  /** #3043 — raw coordinates beside ``clientY``: page and screen space. */
  pageY: number;
  screenY: number;
  /** #3043 — where the fixed chrome renders: ``app-nav`` top (expected 0)
   *  and the ``lesson-footer`` bottom relative to ``innerHeight``
   *  (expected 0 when docked); ``-1`` when the element is absent. */
  hdrTop: number;
  ftrBot: number;
  /** #3043 — scroll reserve of the app scroller below the current
   *  position (``scrollHeight - clientHeight - scrollTop``). */
  room: number;
  /** #3043 — the pre-tap focused field's rectangle and whether it lies
   *  inside the visual viewport (``-1`` / ``0`` when nothing is focused). */
  focusTop: number;
  focusBot: number;
  focusVis: number;
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
  /** #3043 — scroll reserve of the app scroller after the transition. */
  room: number;
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

/** ``tag[testid]`` for any element, ``-`` for none (#3043). */
function describeElement(el: Element | null | undefined): string {
  if (!el) return "-";
  const testid = el.getAttribute?.("data-testid") ?? "";
  return `${el.tagName.toLowerCase()}[${testid || "-"}]`;
}

/** Roughly one text line — the step for the "aimed 1-2 lines higher" probe. */
const LINE_PX = 24;

/**
 * The layout hit-test at a client point, as ``tag[testid]`` (#3043).
 * ``elementFromPoint`` answers from the LAYOUT grid; the event target comes
 * from the browser's own hit-testing. On a healthy page both agree at the
 * finger; a disagreement is the compositor-vs-hit-test desync measured
 * directly, not inferred.
 */
function elementAt(x: number, y: number): string {
  if (typeof document === "undefined" || typeof document.elementFromPoint !== "function") {
    return "-";
  }
  try {
    return describeElement(document.elementFromPoint(x, y));
  } catch {
    return "-";
  }
}

/** Where the fixed top chrome (``app-nav``) renders; ``-1`` when absent. */
function chromeTop(): number {
  if (typeof document === "undefined") return -1;
  const nav = document.querySelector('[data-testid="app-nav"]') ?? document.querySelector("nav");
  return nav ? Math.round(nav.getBoundingClientRect().top) : -1;
}

/**
 * The lesson footer's bottom edge relative to ``innerHeight`` (#3043):
 * 0 when the docked bar renders where the layout says, non-zero when the
 * WebKit fixed-position regression (#1569 dossier, layer B) displaced it.
 * ``-1`` when no footer is mounted.
 */
function chromeBottom(): number {
  if (typeof document === "undefined") return -1;
  const footer = document.querySelector('[data-testid="lesson-footer"]');
  if (!footer) return -1;
  return Math.round(window.innerHeight - footer.getBoundingClientRect().bottom);
}

/** Scroll reserve of ``#root`` below its current position; 0 without a root. */
function scrollerRoom(): number {
  if (typeof document === "undefined") return 0;
  const root = document.getElementById("root");
  if (!root) return 0;
  return Math.round(root.scrollHeight - root.clientHeight - root.scrollTop);
}

/**
 * The focused field's rectangle and whether it lies inside the visual
 * viewport (#3043) — the fact that decides whether Safari has any reason
 * to pan. ``[-1, -1, 0]`` when nothing keyboard-relevant is focused.
 */
function focusedRect(): [number, number, number] {
  if (typeof document === "undefined") return [-1, -1, 0];
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return [-1, -1, 0];
  }
  const rect = el.getBoundingClientRect();
  const vv = window.visualViewport;
  const top = vv ? vv.offsetTop : 0;
  const bottom = top + (vv ? vv.height : window.innerHeight);
  const visible = rect.top >= top && rect.bottom <= bottom ? 1 : 0;
  return [Math.round(rect.top), Math.round(rect.bottom), visible];
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
    `@innerH=${t.atInnerHeight} @rootY=${t.atRootScrollY} ` +
    `hit=${t.hit} above1=${t.above1} above2=${t.above2} ` +
    `pageY=${t.pageY} screenY=${t.screenY} hdrTop=${t.hdrTop} ftrBot=${t.ftrBot} ` +
    `room=${t.room} focusTop=${t.focusTop} focusBot=${t.focusBot} focusVis=${t.focusVis}`
  );
}

function eventLine(e: VvEventInfo): string {
  return (
    `t=${e.t} winY=${e.winY} vvTop=${e.vvTop} kbd=${e.kbd} ` +
    `scale=${e.scale} vvH=${e.vvH} innerH=${e.innerH} rootY=${e.rootY} room=${e.room}`
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

/** How many actor-decision lines the report renders at most (#3003). */
const MAX_HOOK_LINES = 12;

/**
 * The instrumented actors' decisions since probe mount (#3003), rendered
 * from the persistent protocol at copy time — the realign hook's
 * reset/hold verdicts (#2995) and the pre-reveal's applied scrolls
 * (#3002) were previously only in the Settings export, not in the report
 * the tester actually pastes.
 */
function hookBody(mountTs: number): string {
  const lines = readVvLog()
    .filter((entry) => entry.kind === "hook" && entry.ts >= mountTs)
    .slice(-MAX_HOOK_LINES)
    .reverse()
    .map((entry, i) => {
      const { kind: _kind, ts, fix: _fix, ...rest } = entry;
      const fields = Object.entries(rest)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      const rel = Math.round((ts - mountTs) / 100) / 10;
      return `${i + 1}. t=${rel} ${fields}`;
    });
  return lines.length ? lines.join("\n") : "(no hook decisions yet)";
}

/** How many click / focus / mark lines the report renders at most (#3043). */
const MAX_ACTION_LINES = 16;

/**
 * What the taps actually DID since probe mount (#3043), rendered from the
 * persistent protocol at copy time like the hook section: the ``click``
 * that followed a ``pointerdown`` (and whether it landed on a different
 * element), each ``focus`` arrival with the field's geometry, and the
 * tester's ``mark`` entries naming the taps that mis-landed. The
 * ``pointerdown`` record alone never answered "which taps were wrong and
 * what did they hit" — every reading had to guess that from ΔY's sign.
 */
function actionsBody(mountTs: number): string {
  const lines = readVvLog()
    .filter(
      (entry) =>
        (entry.kind === "click" || entry.kind === "focus" || entry.kind === "mark") &&
        entry.ts >= mountTs,
    )
    .slice(-MAX_ACTION_LINES)
    .reverse()
    .map((entry, i) => {
      const { kind, ts, fix: _fix, ...rest } = entry;
      const fields = Object.entries(rest)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      const rel = Math.round((ts - mountTs) / 100) / 10;
      return `${i + 1}. ${kind} t=${rel} ${fields}`;
    });
  return lines.length ? lines.join("\n") : "(no actions yet)";
}

/** The plain-text report the Copy button (and the selectable block) share. */
function buildReport(
  snap: Snapshot,
  taps: TapInfo[],
  events: VvEventInfo[],
  mountTs: number,
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
    `events (newest first):\n${eventBody}\n` +
    `hook (newest first):\n${hookBody(mountTs)}\n` +
    `actions (newest first):\n${actionsBody(mountTs)}`
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
  // The most recent tap: the mis-tap mark and the click record refer to it
  // (#3043). Kept in a ref so the listeners never re-bind.
  const lastTapRef = useRef<TapInfo | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const isProbeChrome = (el: Element | null): boolean =>
      Boolean(
        el?.closest?.(
          `[data-testid="${PANEL_TESTID}"], [data-testid="vv-panel-fab"]`,
        ),
      );
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
          room: scrollerRoom(),
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
      if (isProbeChrome(el)) {
        return;
      }
      const rect = el?.getBoundingClientRect();
      const rectTop = rect ? Math.round(rect.top) : 0;
      const vv = window.visualViewport;
      const x = Math.round(e.clientX);
      const y = Math.round(e.clientY);
      const [focusTop, focusBot, focusVis] = focusedRect();
      const tap: TapInfo = {
        t: relSeconds(startRef.current),
        y,
        tag: el ? el.tagName.toLowerCase() : "?",
        testid: (el?.getAttribute?.("data-testid") ?? "") || "-",
        rectTop,
        deltaY: rectTop - y,
        atWinScrollY: Math.round(window.scrollY),
        atVvOffsetTop: vv ? Math.round(vv.offsetTop) : 0,
        atKbd: Math.round(window.innerHeight - (vv ? vv.height : window.innerHeight)),
        atScale: vv ? Math.round(vv.scale * 1000) / 1000 : 1,
        focus: describeFocused(),
        atVvHeight: Math.round(vv ? vv.height : window.innerHeight),
        atInnerHeight: Math.round(window.innerHeight),
        atRootScrollY: rootScrollTop(),
        // #3043 — intent candidates + the layout hit-test at the finger.
        hit: elementAt(x, y),
        above1: elementAt(x, y - LINE_PX),
        above2: elementAt(x, y - 2 * LINE_PX),
        pageY: Math.round(e.pageY),
        screenY: Math.round(e.screenY),
        hdrTop: chromeTop(),
        ftrBot: chromeBottom(),
        room: scrollerRoom(),
        focusTop,
        focusBot,
        focusVis,
      };
      // eslint-disable-next-line no-console
      console.log("[vvdiag]", JSON.stringify(tap));
      appendVvLogEntry({kind: "tap", ts: Date.now(), fix: activeFix(), ...tap});
      lastTapRef.current = tap;
      const next = [tap, ...tapsRef.current].slice(0, MAX_TAPS);
      tapsRef.current = next;
      setTaps(next);
      refresh();
    };

    // #3043 — what the tap actually activated. A ``click`` dispatched to a
    // different element than the ``pointerdown`` is the MC/SC "selection
    // registers at the wrong spot" symptom, measured instead of described.
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (isProbeChrome(el)) return;
      const down = lastTapRef.current;
      const downTarget = down ? `${down.tag}[${down.testid}]` : "-";
      const target = describeElement(el);
      appendVvLogEntry({
        kind: "click",
        ts: Date.now(),
        fix: activeFix(),
        t: relSeconds(startRef.current),
        y: Math.round(e.clientY),
        target,
        downTarget,
        mismatch: down && target !== downTarget ? 1 : 0,
        winY: Math.round(window.scrollY),
        vvTop: window.visualViewport ? Math.round(window.visualViewport.offsetTop) : 0,
      });
    };

    // #3043 — every focus arrival with the field's geometry: whether it
    // sits inside the visual viewport decides whether Safari must pan.
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (!el || isProbeChrome(el)) return;
      const vv = window.visualViewport;
      const [top, bottom, vis] = focusedRect();
      appendVvLogEntry({
        kind: "focus",
        ts: Date.now(),
        fix: activeFix(),
        t: relSeconds(startRef.current),
        target: describeElement(el),
        top,
        bottom,
        vis,
        rootY: rootScrollTop(),
        vvTop: vv ? Math.round(vv.offsetTop) : 0,
        kbd: Math.round(window.innerHeight - (vv ? vv.height : window.innerHeight)),
        room: scrollerRoom(),
      });
    };

    refresh();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", refresh);
    vv?.addEventListener("scroll", refresh);
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener("focusin", onFocusIn, { capture: true });
    return () => {
      vv?.removeEventListener("resize", refresh);
      vv?.removeEventListener("scroll", refresh);
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("focusin", onFocusIn, { capture: true });
    };
  }, [enabled]);

  // #3043 — the tester flags the tap that just mis-landed. The report never
  // knew WHICH taps were wrong; every reading had to guess it from ΔY's sign.
  const handleMark = useCallback(() => {
    const tap = lastTapRef.current;
    appendVvLogEntry({
      kind: "mark",
      ts: Date.now(),
      fix: activeFix(),
      t: relSeconds(startRef.current),
      lastTap: tap ? tap.t : -1,
      target: tap ? `${tap.tag}[${tap.testid}]` : "-",
      note: "mis-tap",
    });
  }, []);

  const handleCopy = useCallback(() => {
    const report = buildReport(
      snapRef.current ?? readSnapshot(),
      tapsRef.current,
      eventsRef.current,
      startRef.current,
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
  const report = buildReport(snap, taps, events, startRef.current);
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
        <button
          type="button"
          onClick={handleMark}
          className="pointer-events-auto min-h-9 rounded-app border border-[var(--danger)] bg-[var(--bg-elevated)] px-3 text-[13px] font-semibold text-fg-primary"
          data-testid="viewport-diagnostic-mark"
          title="Den letzten Tipp als Fehltipp markieren"
        >
          Daneben!
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
