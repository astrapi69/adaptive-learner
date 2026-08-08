/**
 * Provider model picker (v1.11.0 / Phase 24C).
 *
 * Replaces the v0.4.0 ``<datalist>``-based input on the Settings
 * page. Fetches the actually-available models from the provider's
 * own ``/models`` endpoint via ``settings.getAvailableModels``
 * and shows a searchable dropdown. Falls back to a plain text
 * input + static suggestions when the fetch fails or the user
 * has no API key configured.
 *
 * The fetch is deferred until the user focuses the input or
 * actively opens the dropdown — no API call on initial render.
 *
 * Props:
 *   - userId / provider: which key to use for the lookup.
 *   - value: the persisted ``model_override_<provider>`` string
 *     ("" when no override is set).
 *   - draft + onDraftChange: controlled input state held by the
 *     parent Settings page.
 *   - defaultModel: the provider's hardcoded default; rendered as
 *     hint text when the picker has no value.
 *   - staticSuggestions: fallback list when the API fetch fails;
 *     mirrors ``MODEL_SUGGESTIONS`` so the user never sees an
 *     empty picker.
 *   - disabled: whether the picker should refuse interaction (a
 *     parent Save is in-flight).
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {Button} from "@/components/ui/button";
import {ApiError} from "../../../api/client";
import {useI18n} from "../../../hooks/ui/useI18n";
import type {AIProvider} from "../../../lib/constants";
import {partitionModels} from "@astrapi69/ai-key-vault";

import {APP_PROVIDER_REGISTRY} from "../../../lib/ai/provider-registry";
import {getStorage} from "../../../storage";
import type {AvailableModel} from "../../../storage/types";

interface ModelPickerProps {
    userId: string;
    provider: AIProvider;
    value: string;
    draft: string;
    onDraftChange: (next: string) => void;
    defaultModel: string;
    staticSuggestions: readonly string[];
    disabled?: boolean;
    hasApiKey: boolean;
}

type FetchState =
    | {kind: "idle"}
    | {kind: "loading"}
    | {kind: "loaded"; models: AvailableModel[]}
    | {kind: "error"; detail: string};

export function ModelPicker({
    userId,
    provider,
    value,
    draft,
    onDraftChange,
    defaultModel,
    staticSuggestions,
    disabled,
    hasApiKey,
}: ModelPickerProps) {
    const {t} = useI18n();
    const [fetchState, setFetchState] = useState<FetchState>({kind: "idle"});
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const fetchedOnceRef = useRef<{provider: AIProvider; hadKey: boolean} | null>(null);

    const performFetch = useCallback(async () => {
        if (!hasApiKey) return;
        setFetchState({kind: "loading"});
        try {
            const models = await getStorage().settings.getAvailableModels(
                userId,
                provider,
            );
            setFetchState({kind: "loaded", models});
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : String(err);
            setFetchState({kind: "error", detail});
        }
    }, [hasApiKey, provider, userId]);

    // Reset the fetch state when the active provider changes or
    // the user wires up a key for a provider that had none before.
    useEffect(() => {
        const last = fetchedOnceRef.current;
        if (last && last.provider === provider && last.hadKey === hasApiKey) {
            return;
        }
        fetchedOnceRef.current = {provider, hadKey: hasApiKey};
        setFetchState({kind: "idle"});
    }, [provider, hasApiKey]);

    // Close the dropdown on outside click.
    useEffect(() => {
        if (!open) return;
        const handler = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const openPicker = useCallback(() => {
        setOpen(true);
        if (fetchState.kind === "idle" && hasApiKey) {
            void performFetch();
        }
    }, [fetchState.kind, hasApiKey, performFetch]);

    const handleSelect = (modelId: string) => {
        onDraftChange(modelId);
        setOpen(false);
    };

    const filtered = useMemo(() => {
        if (fetchState.kind !== "loaded") return [];
        const needle = draft.trim().toLowerCase();
        if (!needle) return fetchState.models;
        return fetchState.models.filter(
            (m) =>
                m.id.toLowerCase().includes(needle) ||
                m.name.toLowerCase().includes(needle),
        );
    }, [draft, fetchState]);

    // Curated grouping shared by all three providers (#917): pull the
    // recommended families to the top instead of the provider's raw order.
    const {recommended, rest} = partitionModels(
        APP_PROVIDER_REGISTRY.get(provider).recommendedModels ?? [],
        filtered,
    );

    const showStaticFallback =
        fetchState.kind === "error" || (fetchState.kind === "loaded" && filtered.length === 0);

    const selectedModel =
        fetchState.kind === "loaded"
            ? fetchState.models.find((m) => m.id === value) ?? null
            : null;

    return (
        <div
            className="model-picker"
            data-testid={`model-picker-${provider}`}
            ref={containerRef}
        >
            <div className="model-picker-input-row">
                <input
                    type="text"
                    className="model-picker-input"
                    data-testid={`model-picker-input-${provider}`}
                    value={draft}
                    placeholder={t(
                        "settings.model_picker_placeholder",
                        "Select or type a model id",
                    )}
                    aria-label={t(
                        "settings.model_picker_placeholder",
                        "Select or type a model id",
                    )}
                    onChange={(e) => {
                        onDraftChange(e.target.value);
                        if (!open) openPicker();
                    }}
                    onFocus={openPicker}
                    autoComplete="off"
                    disabled={disabled}
                    aria-expanded={open}
                />
                <Button
                    type="button"
                    variant="secondary"
                    className="model-picker-toggle"
                    data-testid={`model-picker-toggle-${provider}`}
                    onClick={() => (open ? setOpen(false) : openPicker())}
                    disabled={disabled}
                    aria-label={t("settings.model_picker_open", "Open model list")}
                >
                    {open ? "▲" : "▼"}
                </Button>
            </div>

            {selectedModel && (
                <div
                    className="model-picker-chip"
                    data-testid={`model-picker-chip-${provider}`}
                >
                    <strong>{selectedModel.name}</strong>
                    <span className="muted">{selectedModel.id}</span>
                    {selectedModel.context_window != null && (
                        <span className="model-picker-context">
                            {formatContextWindow(selectedModel.context_window)}
                        </span>
                    )}
                </div>
            )}

            {!value && (
                <p
                    className="muted model-picker-default-hint"
                    data-testid={`model-picker-default-hint-${provider}`}
                >
                    {t("settings.model_picker_default_hint", "Uses default:")}{" "}
                    <code>{defaultModel}</code>
                </p>
            )}

            {open && (
                <div
                    className="model-picker-dropdown"
                    role="listbox"
                    data-testid={`model-picker-dropdown-${provider}`}
                >
                    {!hasApiKey && (
                        <div
                            className="model-picker-empty"
                            data-testid={`model-picker-no-key-${provider}`}
                        >
                            {t(
                                "settings.model_picker_no_key",
                                "Save an API key for this provider to load the available models.",
                            )}
                        </div>
                    )}
                    {fetchState.kind === "loading" && (
                        <div
                            className="model-picker-loading"
                            data-testid={`model-picker-loading-${provider}`}
                        >
                            {t("settings.model_picker_loading", "Loading models...")}
                        </div>
                    )}
                    {fetchState.kind === "error" && (
                        <div
                            className="model-picker-error"
                            data-testid={`model-picker-error-${provider}`}
                        >
                            <p>
                                {t(
                                    "settings.model_picker_error",
                                    "Could not load models. Check your API key.",
                                )}
                            </p>
                            <p className="muted">{fetchState.detail}</p>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => void performFetch()}
                                data-testid={`model-picker-retry-${provider}`}
                            >
                                {t("settings.model_picker_retry", "Retry")}
                            </Button>
                        </div>
                    )}
                    {fetchState.kind === "loaded" && recommended.length > 0 && (
                        <>
                            <div className="model-picker-group-title">
                                {t("settings.model_picker_recommended", "Recommended")}
                            </div>
                            {recommended.map((m) => (
                                <ModelRow
                                    key={m.id}
                                    model={m}
                                    selected={m.id === value}
                                    onSelect={() => handleSelect(m.id)}
                                    provider={provider}
                                />
                            ))}
                            {rest.length > 0 && (
                                <>
                                    <div className="model-picker-group-title">
                                        {t("settings.model_picker_all", "All models")}
                                    </div>
                                    {rest.map((m) => (
                                        <ModelRow
                                            key={m.id}
                                            model={m}
                                            selected={m.id === value}
                                            onSelect={() => handleSelect(m.id)}
                                            provider={provider}
                                        />
                                    ))}
                                </>
                            )}
                        </>
                    )}
                    {showStaticFallback && (
                        <div
                            className="model-picker-static"
                            data-testid={`model-picker-static-${provider}`}
                        >
                            <div className="model-picker-group-title">
                                {t(
                                    "settings.model_picker_suggestions",
                                    "Suggested (offline)",
                                )}
                            </div>
                            {staticSuggestions.map((id) => (
                                <Button
                                    type="button"
                                    key={id}
                                    variant="ghost"
                                    className="model-picker-row w-full justify-start"
                                    onClick={() => handleSelect(id)}
                                    data-testid={`model-picker-suggestion-${provider}-${id}`}
                                >
                                    <span className="model-picker-row-name">{id}</span>
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ModelRow({
    model,
    selected,
    onSelect,
    provider,
}: {
    model: AvailableModel;
    selected: boolean;
    onSelect: () => void;
    provider: AIProvider;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            className={`model-picker-row w-full justify-start${selected ? " is-selected" : ""}`}
            onClick={onSelect}
            data-testid={`model-picker-option-${provider}-${model.id}`}
            role="option"
            aria-selected={selected}
        >
            <span className="model-picker-row-name">{model.name}</span>
            <span className="model-picker-row-id muted">{model.id}</span>
            {model.context_window != null && (
                <span className="model-picker-row-context">
                    {formatContextWindow(model.context_window)}
                </span>
            )}
        </Button>
    );
}

function formatContextWindow(tokens: number): string {
    if (tokens >= 1_000_000) {
        const millions = tokens / 1_000_000;
        // Round to one decimal, then trim a trailing ".0" so common
        // values like 1.048576M render as "1M" instead of "1.0M".
        const text = millions.toFixed(1);
        return `${text.endsWith(".0") ? text.slice(0, -2) : text}M`;
    }
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
    return String(tokens);
}

export const __test__ = {formatContextWindow};
