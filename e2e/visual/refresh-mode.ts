/**
 * Baseline refresh mode (#3215).
 *
 * A refresh run writes every baseline whose render differs in at least one
 * pixel past a noise floor, instead of only those whose compare fails the
 * count budget (maxDiffPixels / maxDiffPixelRatio): the budget drops to 0
 * and the per-pixel threshold to 0.05 (a grey delta of about 13).
 * Measured on 166 baselines rendered twice: raster noise differs by at most
 * 2 per channel; the faintest real change (text dimmed behind the shortcut
 * overlay) by up to 52, which the compare threshold of 0.2 (about 53) did
 * not count at all. The compare path keeps its budget and threshold.
 *
 * The refresh workflows set ``VISUAL_BASELINE_REFRESH=1``.
 *
 * @example
 * maxDiffPixels: BASELINE_REFRESH ? 0 : 2_500
 */
export const BASELINE_REFRESH = process.env.VISUAL_BASELINE_REFRESH === "1";
