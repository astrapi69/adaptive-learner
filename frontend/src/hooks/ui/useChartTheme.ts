import {useEffect, useState} from "react";

import {readChartTheme, type ChartTheme} from "../../lib/chartTheme";

/**
 * Phase 58F — resolved chart colors that track the active theme.
 *
 * Reads the computed CSS chart tokens on mount and re-reads whenever
 * the document's ``data-theme`` attribute changes (theme switch in
 * Settings), so Recharts recolors instantly without a reload.
 */
export function useChartTheme(): ChartTheme {
    const [theme, setTheme] = useState<ChartTheme>(readChartTheme);

    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(readChartTheme()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => observer.disconnect();
    }, []);

    return theme;
}
