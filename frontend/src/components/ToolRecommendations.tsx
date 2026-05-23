import {useI18n} from "../hooks/useI18n";
import {METHOD_COLORS} from "../lib/constants";
import {bestTextOn} from "../styles/contrast";
import type {ToolRecommendation} from "../types";

interface ToolRecommendationsProps {
    tools: ToolRecommendation[];
}

/**
 * Compact list of tool recommendations from the tools plugin.
 * Each entry shows the tool name, link to its homepage, the
 * "why" explanation (already localised by the plugin via the
 * ``lang`` query param), and method-coloured chips for each
 * ``weight_keys`` entry so the user can connect the tool to
 * their dominant method visually.
 */
export default function ToolRecommendations({tools}: ToolRecommendationsProps) {
    const {t} = useI18n();
    if (tools.length === 0) {
        return (
            <div className="tile" data-testid="tool-recs-empty">
                <p className="muted">{t("dashboard.no_data")}</p>
            </div>
        );
    }
    return (
        <ul className="tool-list" data-testid="tool-recs">
            {tools.map((tool) => (
                <li key={tool.name} className="tool-card" data-testid={`tool-${tool.name}`}>
                    <a
                        href={tool.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="tool-name"
                    >
                        {tool.name}
                    </a>
                    <p className="tool-why">{tool.why}</p>
                    <div className="tool-methods">
                        {tool.weight_keys.map((method) => (
                            <span
                                key={method}
                                className="method-badge"
                                style={{
                                    background: METHOD_COLORS[method],
                                    color: bestTextOn(METHOD_COLORS[method]),
                                }}
                            >
                                {t(`methods.${method}.label`, method)}
                            </span>
                        ))}
                    </div>
                </li>
            ))}
        </ul>
    );
}
