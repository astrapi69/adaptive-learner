import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {useI18n} from "../../hooks/useI18n";

interface ChartSummaryProps {
    /**
     * One-sentence summary of the chart's primary finding,
     * e.g. "Your strongest method: Deductive (0.8)" or
     * "Most-used method: Deductive (3 sessions, 42%)". Always
     * rendered to the screen-reader-only region; also rendered
     * visibly below the chart when ``summaryVisible`` is true
     * (default).
     */
    summary: string;
    /**
     * Optional table-alternative for the chart's data. Rendered
     * inside a collapsed ``<details><summary>`` so sighted users
     * don't see it by default; anyone can expand it. Each row
     * is a tuple of cells; the first row is rendered as headers.
     */
    tableHeaders?: readonly string[];
    tableRows?: readonly (readonly (string | number)[])[];
    /** Override the visible "Show as table" label. */
    tableToggleLabel?: string;
    /** Hide the visible summary line (sr-only region kept). */
    summaryVisible?: boolean;
    /** Testid hook for E2E + unit assertions. */
    testid?: string;
}

/**
 * WCAG 2.1 SC 1.1.1 (Non-text Content) helper for the
 * dashboard charts. Pairs an authoritative text summary with
 * an optional collapsed data table — both consumed by AT,
 * both available to sighted users on demand.
 */
export default function ChartSummary({
    summary,
    tableHeaders,
    tableRows,
    tableToggleLabel,
    summaryVisible = true,
    testid,
}: ChartSummaryProps) {
    const {t} = useI18n();
    const hasTable =
        tableHeaders && tableHeaders.length > 0 && tableRows && tableRows.length > 0;
    const toggleLabel =
        tableToggleLabel ??
        t("ui.a11y.chart_show_as_table", "Show data as table");
    return (
        <div className="chart-summary" data-testid={testid}>
            {summaryVisible ? (
                <p
                    className="chart-summary-caption"
                    data-testid={testid ? `${testid}-caption` : undefined}
                >
                    {summary}
                </p>
            ) : (
                <span className="sr-only">{summary}</span>
            )}
            {hasTable && (
                <details
                    className="chart-summary-details"
                    data-testid={testid ? `${testid}-table-toggle` : undefined}
                >
                    <summary>{toggleLabel}</summary>
                    <Table
                        className="mt-2"
                        data-testid={testid ? `${testid}-table` : undefined}
                    >
                        <TableHeader>
                            <TableRow>
                                {tableHeaders.map((h) => (
                                    <TableHead key={h}>{h}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tableRows.map((row, rIdx) => (
                                <TableRow key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                        <TableCell key={cIdx}>{cell}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </details>
            )}
        </div>
    );
}
