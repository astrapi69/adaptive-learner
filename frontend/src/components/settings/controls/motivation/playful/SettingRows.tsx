/**
 * Row primitives for the game-mode settings (#2959): a switch row
 * (label + hint + checkbox) and a number row (label + bounded number
 * input). Purely presentational - the calling block owns the state,
 * the clamping and the persistence; these only lay out the row the
 * way every Settings > Learning control does.
 *
 * @example
 * <SettingSwitchRow
 *   label={t("settings.playful_hearts", "Hearts (lives)")}
 *   hint={t("settings.playful_hearts_description", "...")}
 *   checked={hearts}
 *   disabled={disabled}
 *   onChange={handleHeartsToggle}
 *   testid="settings-playful-hearts-toggle"
 * />
 * <SettingNumberRow
 *   label={t("settings.playful_hearts_count", "Hearts per lesson")}
 *   value={heartsCount}
 *   min={MIN_HEARTS_COUNT}
 *   max={MAX_HEARTS_COUNT}
 *   disabled={disabled || !hearts}
 *   onChange={handleHeartsCount}
 *   testid="settings-playful-hearts-count"
 * />
 */

import type {ReactNode} from "react";

import FormHint from "@/shared/forms/FormHint";

export interface SettingSwitchRowProps {
    /** Row label (already translated). */
    label: ReactNode;
    /** Optional muted description under the label. */
    hint?: ReactNode;
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
    /** ``data-testid`` of the checkbox. */
    testid: string;
}

/** A labelled checkbox row with an optional hint line. */
export function SettingSwitchRow({
    label,
    hint,
    checked,
    disabled = false,
    onChange,
    testid,
}: SettingSwitchRowProps) {
    return (
        <label className="flex items-center justify-between gap-2">
            <span className="flex flex-col gap-0.5">
                <span className="text-[0.95rem] font-medium">{label}</span>
                {hint !== undefined && <FormHint as="span">{hint}</FormHint>}
            </span>
            <input
                type="checkbox"
                className="m-0 size-4 flex-none p-0"
                data-testid={testid}
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
        </label>
    );
}

export interface SettingNumberRowProps {
    /** Row label (already translated). */
    label: ReactNode;
    value: number;
    min: number;
    max: number;
    disabled?: boolean;
    /** Receives the raw input string; the caller clamps + persists. */
    onChange: (raw: string) => void;
    /** ``data-testid`` of the number input. */
    testid: string;
}

/** A labelled, bounded number-input row. */
export function SettingNumberRow({
    label,
    value,
    min,
    max,
    disabled = false,
    onChange,
    testid,
}: SettingNumberRowProps) {
    return (
        <label className="flex items-center justify-between gap-2">
            <span className="text-sm">{label}</span>
            <input
                type="number"
                className="w-20"
                min={min}
                max={max}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                data-testid={testid}
            />
        </label>
    );
}
