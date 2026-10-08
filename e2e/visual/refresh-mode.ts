/**
 * Baseline refresh mode (#3215).
 *
 * A refresh run writes every baseline whose render differs in at least one
 * pixel past the per-pixel colour threshold, instead of only those whose
 * compare fails the count budget (maxDiffPixels / maxDiffPixelRatio).
 * Measured on 166 baselines rendered twice: run-to-run raster noise is 0
 * pixels past the threshold, the smallest real change 249 pixels, so a
 * count budget of 0 writes exactly the changed images. The compare path
 * keeps its budget as a noise filter.
 *
 * The refresh workflows set ``VISUAL_BASELINE_REFRESH=1``.
 *
 * @example
 * maxDiffPixels: BASELINE_REFRESH ? 0 : 2_500
 */
export const BASELINE_REFRESH = process.env.VISUAL_BASELINE_REFRESH === "1";
