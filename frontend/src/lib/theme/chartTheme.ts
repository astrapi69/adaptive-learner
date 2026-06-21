/**
 * Phase 58F — resolved chart colors for Recharts.
 *
 * Recharts writes its ``stroke`` / ``fill`` props to SVG presentation
 * attributes, which do NOT resolve ``var(--x)``. So instead of passing
 * CSS variables, we read their COMPUTED values off the document root
 * and hand Recharts concrete color strings. ``useChartTheme`` (see the
 * hook) re-reads these whenever ``data-theme`` changes so charts
 * recolor on a theme switch with no reload.
 *
 * Fallbacks mirror the light theme so SSR / tests / a blocked
 * getComputedStyle still produce sane colors.
 */

export interface ChartTheme {
    /** Categorical series palette (--chart-1..6). */
    series: string[];
    /** Axis lines + tick labels (--fg-muted). */
    axis: string;
    /** Gridlines (--border-subtle). */
    grid: string;
    /** Tooltip surface / border / text. */
    tooltipBg: string;
    tooltipBorder: string;
    tooltipText: string;
    /** Common semantic lines. */
    success: string;
    error: string;
    accent: string;
}

const FALLBACK: ChartTheme = {
    series: ["#3b82f6", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b", "#6366f1"],
    axis: "#64748b",
    grid: "#eef2f7",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    tooltipText: "#1a1a1a",
    success: "#15803d",
    error: "#dc2626",
    accent: "#4f46e5",
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
}

/** Read the current theme's chart colors from the document root. */
export function readChartTheme(): ChartTheme {
    if (typeof window === "undefined" || typeof getComputedStyle !== "function") {
        return FALLBACK;
    }
    const styles = getComputedStyle(document.documentElement);
    return {
        series: FALLBACK.series.map((fb, i) => readVar(styles, `--chart-${i + 1}`, fb)),
        axis: readVar(styles, "--fg-muted", FALLBACK.axis),
        grid: readVar(styles, "--border-subtle", FALLBACK.grid),
        tooltipBg: readVar(styles, "--bg-surface", FALLBACK.tooltipBg),
        tooltipBorder: readVar(styles, "--border-primary", FALLBACK.tooltipBorder),
        tooltipText: readVar(styles, "--fg-primary", FALLBACK.tooltipText),
        success: readVar(styles, "--success", FALLBACK.success),
        error: readVar(styles, "--error", FALLBACK.error),
        accent: readVar(styles, "--accent", FALLBACK.accent),
    };
}

/** Recharts ``Tooltip`` contentStyle built from a resolved theme. */
export function tooltipContentStyle(theme: ChartTheme): React.CSSProperties {
    return {
        background: theme.tooltipBg,
        border: `1px solid ${theme.tooltipBorder}`,
        borderRadius: 8,
        color: theme.tooltipText,
    };
}
