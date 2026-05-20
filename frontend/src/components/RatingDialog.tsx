import {useState} from "react";

import {useI18n} from "../hooks/useI18n";

interface RatingDialogProps {
    open: boolean;
    onCancel: () => void;
    onSubmit: (rating: RatingValues) => void;
    submitting?: boolean;
    /**
     * v1.4.0 — multi-cycle session summary. When the user has
     * completed more than one auto-loop cycle, the dialog prepends
     * a "cycles completed" block summarising the journey.
     */
    cycleCount?: number;
    cycleTopics?: {
        cycle: number;
        topic: string;
        summary: string;
        next_topic: string;
    }[];
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
 * stress and method-fit each as a 1..5 tap-button group, plus
 * an optional free-text notes field.
 *
 * v0.6.0 / 9C: button group replaces the slider input. Universal
 * swap (not mobile-only) — sliders for a 5-position scale are
 * imprecise on every input device. A 5-button row gives the
 * exact value with one click on desktop and one thumb-tap on
 * mobile, and stays accessible to keyboard users (each button
 * focusable, arrow keys not required for value selection).
 *
 * Returns early with ``null`` when ``open`` is false so the
 * dialog markup doesn't pollute the DOM unnecessarily.
 */
export default function RatingDialog({
    open,
    onCancel,
    onSubmit,
    submitting = false,
    cycleCount,
    cycleTopics,
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
                {cycleCount && cycleCount > 1 && (
                    <div
                        className="rating-cycles-summary"
                        data-testid="rating-cycles-summary"
                    >
                        <p>
                            <strong>
                                {t(
                                    "session.cycles_completed",
                                    "Cycles completed",
                                )}
                                :
                            </strong>{" "}
                            {cycleCount}
                        </p>
                        {cycleTopics && cycleTopics.length > 0 && (
                            <ol className="rating-cycles-list">
                                {cycleTopics.map((c) => (
                                    <li key={c.cycle}>
                                        <strong>{c.topic}</strong>
                                        {c.summary && (
                                            <span> — {c.summary}</span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                )}
                <form
                    className="rating-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSubmit({understanding, stress, method_fit: methodFit, notes: notes.trim()});
                    }}
                >
                    <RatingRow
                        labelKey="session.rating_understanding"
                        fallback="How well did you understand?"
                        testid="rating-understanding"
                        value={understanding}
                        onChange={setUnderstanding}
                        disabled={submitting}
                    />
                    <RatingRow
                        labelKey="session.rating_stress"
                        fallback="How stressful was it?"
                        testid="rating-stress"
                        value={stress}
                        onChange={setStress}
                        disabled={submitting}
                    />
                    <RatingRow
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

interface RatingRowProps {
    labelKey: string;
    fallback: string;
    testid: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
}

function RatingRow({labelKey, fallback, testid, value, onChange, disabled}: RatingRowProps) {
    const {t} = useI18n();
    return (
        <div className="rating-row" data-testid={testid}>
            <span className="form-label rating-row-label">
                {t(labelKey, fallback)}{" "}
                <span className="rating-value" data-testid={`${testid}-value`}>
                    {value} / 5
                </span>
            </span>
            <div
                className="rating-buttons"
                role="radiogroup"
                aria-label={t(labelKey, fallback)}
            >
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        type="button"
                        key={n}
                        role="radio"
                        aria-checked={value === n}
                        disabled={disabled}
                        data-testid={`${testid}-${n}`}
                        className={`rating-button${value === n ? " is-active" : ""}`}
                        onClick={() => onChange(n)}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    );
}
