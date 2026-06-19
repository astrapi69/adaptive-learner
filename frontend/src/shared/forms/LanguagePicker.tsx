/**
 * LanguagePicker — a searchable, keyboard-navigable combobox for
 * choosing one language out of many (EXP-027 / I18N-02 + I18N-04).
 *
 * Scales where a plain ``<select>`` of uppercase codes does not: a
 * search field filters as you type (diacritic-insensitive), each
 * option shows its native script alongside a localized name, the
 * current choice is marked, and once the list grows past
 * ``groupThreshold`` (default 12) the options group by writing system.
 *
 * Fully app-agnostic and props-driven: it imports nothing
 * app-specific and holds no app state. The caller supplies the
 * option list (already localized) and the change handler, so the same
 * component serves Settings, Landing, or any future "pick a language"
 * surface. Implements the ARIA combobox + listbox pattern with full
 * keyboard support (Arrow / Home / End / Enter / Escape).
 *
 * @example
 * <LanguagePicker
 *   languages={[
 *     {value: "de", nativeLabel: "Deutsch", localizedLabel: "German", group: "Latin"},
 *     {value: "ja", nativeLabel: "日本語", localizedLabel: "Japanese", group: "CJK"},
 *   ]}
 *   selectedValue={lang}
 *   onChange={setLang}
 *   ariaLabel="Display language"
 *   searchPlaceholder="Search languages…"
 *   noResultsLabel="No languages found"
 * />
 */

import {useEffect, useId, useMemo, useRef, useState} from "react";
import {Check, ChevronsUpDown, Search} from "lucide-react";

export interface LanguagePickerOption {
    /** The value passed to ``onChange`` when picked. */
    value: string;
    /** Endonym shown first (the language in its own script). */
    nativeLabel: string;
    /** Localized name in the current UI language (e.g. "German"). */
    localizedLabel?: string;
    /** Group heading (e.g. "Latin"); only used past ``groupThreshold``. */
    group?: string;
}

export interface LanguagePickerProps {
    languages: LanguagePickerOption[];
    selectedValue: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    /** Accessible name when there is no external visible label. */
    ariaLabel?: string;
    searchPlaceholder?: string;
    /** Accessible name for the search input. */
    searchAriaLabel?: string;
    noResultsLabel?: string;
    /** Group the list by ``option.group`` once it exceeds this many
     *  entries. Default 12. */
    groupThreshold?: number;
    /** Root ``data-testid``; sub-elements derive from it. */
    testId?: string;
}

/** Lowercase + strip diacritics for accent-insensitive matching. */
function normalize(text: string): string {
    return text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
}

function matches(option: LanguagePickerOption, needle: string): boolean {
    if (!needle) return true;
    const hay = normalize(
        `${option.nativeLabel} ${option.localizedLabel ?? ""} ${option.value}`,
    );
    return hay.includes(needle);
}

/** Ordered groups, preserving first-appearance order of ``group``. */
function groupOptions(
    options: LanguagePickerOption[],
): {group: string; options: LanguagePickerOption[]}[] {
    const order: string[] = [];
    const byGroup = new Map<string, LanguagePickerOption[]>();
    for (const opt of options) {
        const key = opt.group ?? "";
        if (!byGroup.has(key)) {
            byGroup.set(key, []);
            order.push(key);
        }
        byGroup.get(key)!.push(opt);
    }
    return order.map((group) => ({group, options: byGroup.get(group)!}));
}

export default function LanguagePicker({
    languages,
    selectedValue,
    onChange,
    disabled = false,
    ariaLabel,
    searchPlaceholder,
    searchAriaLabel,
    noResultsLabel = "No languages found",
    groupThreshold = 12,
    testId = "language-picker",
}: LanguagePickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const reactId = useId();
    const listboxId = `${reactId}-listbox`;

    const selected = languages.find((l) => l.value === selectedValue);

    const filtered = useMemo(() => {
        const needle = normalize(query.trim());
        return languages.filter((l) => matches(l, needle));
    }, [languages, query]);

    const grouped = languages.length > groupThreshold;

    // Keep the active index in range as the filtered list changes.
    useEffect(() => {
        setActiveIndex((i) => (i >= filtered.length ? 0 : i));
    }, [filtered.length]);

    // Focus the search input when the panel opens; reset query/active.
    useEffect(() => {
        if (open) {
            setQuery("");
            const idx = languages.findIndex((l) => l.value === selectedValue);
            setActiveIndex(idx >= 0 ? idx : 0);
            inputRef.current?.focus();
        }
    }, [open, languages, selectedValue]);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        const onPointer = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer);
        return () => document.removeEventListener("pointerdown", onPointer);
    }, [open]);

    const optionId = (value: string) => `${listboxId}-opt-${value}`;

    const commit = (value: string) => {
        onChange(value);
        setOpen(false);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
                break;
            case "Home":
                e.preventDefault();
                setActiveIndex(0);
                break;
            case "End":
                e.preventDefault();
                setActiveIndex(filtered.length - 1);
                break;
            case "Enter": {
                e.preventDefault();
                const active = filtered[activeIndex];
                if (active) commit(active.value);
                break;
            }
            case "Escape":
                e.preventDefault();
                setOpen(false);
                break;
            case "Tab":
                setOpen(false);
                break;
        }
    };

    const activeValue = filtered[activeIndex]?.value;

    const renderOption = (opt: LanguagePickerOption) => {
        const isSelected = opt.value === selectedValue;
        const isActive = opt.value === activeValue;
        return (
            <li
                key={opt.value}
                id={optionId(opt.value)}
                role="option"
                aria-selected={isSelected}
                data-testid={`${testId}-option-${opt.value}`}
                onClick={() => commit(opt.value)}
                onMouseEnter={() =>
                    setActiveIndex(
                        filtered.findIndex((l) => l.value === opt.value),
                    )
                }
                className={[
                    "flex min-h-[44px] cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                    isActive ? "bg-accent text-accent-fg" : "text-fg-primary",
                ].join(" ")}
            >
                <Check
                    size={16}
                    className={isSelected ? "opacity-100" : "opacity-0"}
                    aria-hidden="true"
                />
                <span className="font-medium">{opt.nativeLabel}</span>
                {opt.localizedLabel &&
                    opt.localizedLabel !== opt.nativeLabel && (
                        <span
                            className={
                                isActive
                                    ? "text-accent-fg/80"
                                    : "text-fg-muted"
                            }
                        >
                            {opt.localizedLabel}
                        </span>
                    )}
            </li>
        );
    };

    return (
        <div ref={rootRef} className="relative" data-testid={testId}>
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-label={ariaLabel}
                data-testid={`${testId}-trigger`}
                onClick={() => !disabled && setOpen((o) => !o)}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-fg-primary disabled:opacity-50"
            >
                <span className="flex items-center gap-2 truncate">
                    {selected ? (
                        <>
                            <span className="font-medium">
                                {selected.nativeLabel}
                            </span>
                            {selected.localizedLabel &&
                                selected.localizedLabel !==
                                    selected.nativeLabel && (
                                    <span className="text-fg-muted">
                                        {selected.localizedLabel}
                                    </span>
                                )}
                        </>
                    ) : (
                        <span className="text-fg-muted">{selectedValue}</span>
                    )}
                </span>
                <ChevronsUpDown
                    size={16}
                    className="shrink-0 text-fg-muted"
                    aria-hidden="true"
                />
            </button>

            {open && (
                <div
                    data-testid={`${testId}-panel`}
                    className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-bg-elevated shadow-[var(--shadow-elevated)]"
                >
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                        <Search
                            size={14}
                            className="shrink-0 text-fg-muted"
                            aria-hidden="true"
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            role="combobox"
                            aria-expanded
                            aria-controls={listboxId}
                            aria-autocomplete="list"
                            aria-activedescendant={
                                activeValue ? optionId(activeValue) : undefined
                            }
                            aria-label={searchAriaLabel ?? ariaLabel}
                            data-testid={`${testId}-search`}
                            value={query}
                            placeholder={searchPlaceholder}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setActiveIndex(0);
                            }}
                            onKeyDown={handleInputKeyDown}
                            className="w-full bg-transparent text-sm text-fg-primary outline-none"
                        />
                    </div>

                    {filtered.length === 0 ? (
                        <p
                            data-testid={`${testId}-no-results`}
                            className="px-3 py-3 text-sm text-fg-muted"
                        >
                            {noResultsLabel}
                        </p>
                    ) : (
                        <ul
                            id={listboxId}
                            role="listbox"
                            aria-label={ariaLabel}
                            data-testid={`${testId}-listbox`}
                            className="max-h-72 overflow-y-auto py-1"
                        >
                            {grouped
                                ? groupOptions(filtered).map(
                                      ({group, options}) => (
                                          <li key={group || "_"} role="none">
                                              {group && (
                                                  <p
                                                      className="px-3 pb-1 pt-2 text-xs font-semibold uppercase text-fg-muted"
                                                      aria-hidden="true"
                                                  >
                                                      {group}
                                                  </p>
                                              )}
                                              <ul
                                                  role="group"
                                                  aria-label={group || undefined}
                                              >
                                                  {options.map(renderOption)}
                                              </ul>
                                          </li>
                                      ),
                                  )
                                : filtered.map(renderOption)}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
