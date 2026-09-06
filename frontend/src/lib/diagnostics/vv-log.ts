/**
 * Persistent viewport/tap diagnostics log (#2782) — the ghost-bug recorder.
 *
 * The #1569 tap-offset does not reproduce on demand, so the in-memory
 * 8-tap history of the ``ViewportDiagnostic`` overlay is not enough: a
 * mis-tap noticed hours later — or before the overlay's history rolled
 * over — must still be exportable. While the probe is enabled, every tap
 * record and every significant ``visualViewport`` transition is appended
 * here: a localStorage-backed ring buffer (capped, oldest dropped) that
 * survives reloads and navigation.
 *
 * Storage: ``adaptive-learner.vv_diag_log`` — a JSON array of
 * {@link VvLogEntry}. Every read/write is wrapped in try/catch and fails
 * open (an unavailable or full localStorage degrades to a no-op; the
 * probe itself keeps working).
 *
 * @example
 * appendVvLogEntry({kind: "tap", ts: Date.now(), fix: "off", ...});
 * const text = vvLogAsText(); // paste-ready protocol for an issue/chat
 */

const LOG_KEY = "adaptive-learner.vv_diag_log";

/** Same flag the ``?vvdiag=1`` probe persists (#2782). */
const DIAG_FLAG_KEY = "adaptive-learner.vv_diag";

/**
 * Whether the diagnostics probe is enabled — instrumented actors (the
 * realign hook #2995, the pre-reveal #3002) log only then; normal users
 * pay nothing.
 */
export function vvDiagEnabled(): boolean {
  try {
    return localStorage.getItem(DIAG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Ring-buffer cap: old entries are dropped once the log is full. */
export const VV_LOG_MAX_ENTRIES = 500;

/** One recorded diagnostics event. */
export interface VvLogEntry {
  /** ``tap`` = a pointerdown record; ``viewport`` = a vv state
   *  transition; ``hook`` = a realign-hook decision (#2995). */
  kind: "tap" | "viewport" | "hook";
  /** ``Date.now()`` at record time. */
  ts: number;
  /** The active ``?vvfix`` candidate (``"off"`` when none). */
  fix: string;
  /** Free-form measurement payload (ΔY, winY, vvTop, ... — kept flat). */
  [key: string]: string | number;
}

function readRaw(): VvLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VvLogEntry[]) : [];
  } catch {
    return [];
  }
}

/** All recorded entries, oldest first. Empty when storage is unavailable. */
export function readVvLog(): VvLogEntry[] {
  return readRaw();
}

/** Number of recorded entries. */
export function vvLogCount(): number {
  return readRaw().length;
}

/**
 * Append one entry, dropping the oldest beyond {@link VV_LOG_MAX_ENTRIES}.
 * Fails open: storage errors are swallowed (the probe must never break
 * the page it is measuring).
 */
export function appendVvLogEntry(entry: VvLogEntry): void {
  try {
    const next = [...readRaw(), entry].slice(-VV_LOG_MAX_ENTRIES);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    /* fail open */
  }
}

/** Remove every recorded entry. */
export function clearVvLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* fail open */
  }
}

/**
 * The whole log as a paste-ready plain-text protocol: a header with the
 * user agent + entry count, then one ISO-timestamped line per entry.
 */
export function vvLogAsText(): string {
  const entries = readRaw();
  const ua = typeof navigator === "undefined" ? "?" : navigator.userAgent;
  const head = `[vvdiag-log] entries=${entries.length} ua=${ua}`;
  const lines = entries.map((entry) => {
    const {kind, ts, ...rest} = entry;
    const fields = Object.entries(rest)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    return `${new Date(ts).toISOString()} ${kind} ${fields}`;
  });
  return [head, ...lines].join("\n");
}
