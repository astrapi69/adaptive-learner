import {useState} from "react";

import {useI18n} from "../hooks/useI18n";

interface RatingDialogProps {
    open: boolean;
    onCancel: () => void;
    onSubmit: (rating: RatingValues) => void;
    submitting?: boolean;
}

export interface RatingValues {
    understanding: number;
    stress: number;
    method_fit: number;
    notes: string;
}

/**
 * Modal dialog (rendered inline, no portal — keeps the SR DOM
 * minimal) for collecting end-of-session ratings: understanding,
 * stress and method-fit each as a 1..5 slider, plus an optional
 * free-text notes field.
 *
 * Returns early with ``null`` when ``open`` is false so the
 * dialog markup doesn't pollute the DOM unnecessarily.
 */
export default function RatingDialog({
    open,
    onCancel,
    onSubmit,
    submitting = false,
}: RatingDialogProps) {
    const {t} = useI18n();
    const [understanding, setUnderstanding] = useState(3);
    const [stress, setStress] = useState(3);
    const [methodFit, setMethodFit] = useState(3);
    const [notes, setNotes] = useState("");

    if (!open) return null;

    return (
        <div className="modal-overlay" data-testid="rating-dialog">
            <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="rating-title">
                <h2 id="rating-title" className="modal-title">
                    {t("session.rating_title", "How did the session go?")}
                </h2>
                <form
                    className="rating-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSubmit({understanding, stress, method_fit: methodFit, notes: notes.trim()});
                    }}
                >
                    <SliderRow
                        labelKey="session.rating_understanding"
                        fallback="How well did you understand?"
                        testid="rating-understanding"
                        value={understanding}
                        onChange={setUnderstanding}
                        disabled={submitting}
                    />
                    <SliderRow
                        labelKey="session.rating_stress"
                        fallback="How stressful was it?"
                        testid="rating-stress"
                        value={stress}
                        onChange={setStress}
                        disabled={submitting}
                    />
                    <SliderRow
                        labelKey="session.rating_method_fit"
                        fallback="How well did the method fit?"
                        testid="rating-method-fit"
                        value={methodFit}
                        onChange={setMethodFit}
                        disabled={submitting}
                    />
                    <label className="form-row">
                        <span className="form-label">
                            {t("session.rating_notes", "Notes (optional)")}
                        </span>
                        <textarea
                            data-testid="rating-notes"
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={submitting}
                        />
                    </label>
                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            data-testid="rating-cancel"
                            onClick={onCancel}
                            disabled={submitting}
                        >
                            {t("common.cancel", "Cancel")}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            data-testid="rating-submit"
                            disabled={submitting}
                        >
                            {t("session.rating_submit", "Submit rating")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface SliderRowProps {
    labelKey: string;
    fallback: string;
    testid: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
}

function SliderRow({labelKey, fallback, testid, value, onChange, disabled}: SliderRowProps) {
    const {t} = useI18n();
    return (
        <label className="form-row">
            <span className="form-label">
                {t(labelKey, fallback)}{" "}
                <span className="rating-value" data-testid={`${testid}-value`}>
                    {value} / 5
                </span>
            </span>
            <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                data-testid={testid}
            />
        </label>
    );
}
