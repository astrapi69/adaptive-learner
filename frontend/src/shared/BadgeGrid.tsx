/**
 * BadgeGrid — a generic responsive grid of earned / locked badges.
 *
 * App-agnostic and props-driven: pass ``items`` carrying a rendered
 * icon, label, earned flag, optional unlock hint and highlight flag.
 * Earned badges render at full strength; locked badges are greyed and
 * expose their hint as a tooltip; a highlighted badge (e.g. the
 * newest) gets an accent ring. Optionally interactive via ``onSelect``
 * (cells become 44px buttons). Reusable for any "collection" surface.
 *
 * @example
 * <BadgeGrid
 *   items={[
 *     {id: "streak_7", label: "7-day streak", icon: <img …/>, earned: true, highlight: true},
 *     {id: "level_10", label: "Level 10", icon: <img …/>, earned: false, hint: "Reach level 10"},
 *   ]}
 *   onSelect={(id) => openGallery(id)}
 * />
 */

import type {ReactNode} from "react";

export interface BadgeGridItem {
    id: string;
    label: string;
    icon: ReactNode;
    earned: boolean;
    /** Shown as a tooltip — e.g. what unlocks a locked badge. */
    hint?: string;
    /** Accent ring (e.g. the most-recently-earned badge). */
    highlight?: boolean;
}

export interface BadgeGridProps {
    items: BadgeGridItem[];
    onSelect?: (id: string) => void;
    ariaLabel?: string;
    emptyLabel?: string;
    className?: string;
    testId?: string;
}

export default function BadgeGrid({
    items,
    onSelect,
    ariaLabel,
    emptyLabel = "No badges yet.",
    className,
    testId = "badge-grid",
}: BadgeGridProps) {
    if (items.length === 0) {
        return (
            <p className={className} data-testid={`${testId}-empty`}>
                {emptyLabel}
            </p>
        );
    }

    return (
        <ul
            className={className}
            data-testid={testId}
            aria-label={ariaLabel}
            style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
                gap: 8,
            }}
        >
            {items.map((item) => {
                const title = item.earned
                    ? item.label
                    : item.hint
                      ? `${item.label} — ${item.hint}`
                      : item.label;
                const inner = (
                    <span
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            opacity: item.earned ? 1 : 0.4,
                            filter: item.earned ? "none" : "grayscale(1)",
                        }}
                    >
                        {item.icon}
                    </span>
                );
                const frameStyle: React.CSSProperties = {
                    display: "flex",
                    minHeight: 44,
                    minWidth: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius-sm)",
                    border: item.highlight
                        ? "2px solid var(--accent)"
                        : "1px solid var(--border)",
                    background: "var(--surface)",
                    padding: 4,
                };
                return (
                    <li key={item.id} data-testid={`${testId}-item-${item.id}`}>
                        {onSelect ? (
                            <button
                                type="button"
                                onClick={() => onSelect(item.id)}
                                title={title}
                                aria-label={title}
                                data-earned={item.earned}
                                data-highlight={item.highlight ? "true" : "false"}
                                style={{...frameStyle, cursor: "pointer", width: "100%"}}
                            >
                                {inner}
                            </button>
                        ) : (
                            <div
                                title={title}
                                aria-label={title}
                                data-earned={item.earned}
                                data-highlight={item.highlight ? "true" : "false"}
                                style={frameStyle}
                            >
                                {inner}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
