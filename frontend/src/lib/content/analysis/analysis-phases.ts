/**
 * Timed fake-progress phases for the conversation-analysis loading view
 * (extracted from ImportDetail for the complexity burn-down #419).
 *
 * The analysis call is a single opaque request; these phases drive a
 * reassuring staged progress bar while it runs.
 */

export const ANALYSIS_PHASES = [
  "analysis_phase_reading",
  "analysis_phase_analyzing",
  "analysis_phase_preparing",
] as const;

/** English fallbacks, parallel to ANALYSIS_PHASES (for the t() default). */
export const ANALYSIS_PHASE_FALLBACKS = [
  "Step 1/3: Reading chat…",
  "Step 2/3: Analyzing content…",
  "Step 3/3: Preparing results…",
];

export const ANALYSIS_PHASE_INTERVAL_MS = 4000;

/** Phase-driven progress-bar fill (percent), indexed by phase. */
export const ANALYSIS_PHASE_PROGRESS = [20, 60, 90];
