import {useMemo, useState} from "react";

import {Button} from "@/components/ui/button";
import {Progress} from "@/components/ui/progress";
import {useI18n} from "../../hooks/useI18n";

/** The profile fields the wizard collects, ready for projects.update. */
export interface WizardValues {
    goal: string;
    timeframe: string;
    dailyMinutes: number;
    currentProblem: string;
}

interface OnboardingWizardProps {
    /** Pre-selected defaults (the values the project was created with). */
    defaults: WizardValues;
    /** Persist the collected values, then route. ``startAssessment``
        true -> /assessment, false -> /dashboard. */
    onFinish: (values: WizardValues, startAssessment: boolean) => void;
    /** Step 1 "Back" returns to the invitation. */
    onExit: () => void;
    /** Disable the controls while the parent persists + navigates. */
    busy?: boolean;
}

const TOTAL_STEPS = 5;
const MIN_MINUTES = 5;
const MAX_MINUTES = 60;

/**
 * Optional step-by-step profile setup (#94). One question per screen,
 * each pre-filled with a sensible default so "Next" always works
 * without input. Progress indicator + a Back button on every step;
 * the final step offers the assessment or jumping straight to the
 * dashboard. shadcn primitives, 44px targets, Tailwind-only, and it
 * lays out identically on mobile and desktop (single column,
 * full-width controls).
 */
export default function OnboardingWizard({
    defaults,
    onFinish,
    onExit,
    busy = false,
}: OnboardingWizardProps) {
    const {t} = useI18n();
    const [step, setStep] = useState(0);
    const [goal, setGoal] = useState(defaults.goal);
    const [timeframe, setTimeframe] = useState(defaults.timeframe);
    const [dailyMinutes, setDailyMinutes] = useState(defaults.dailyMinutes);
    const [currentProblem, setCurrentProblem] = useState(defaults.currentProblem);

    const timeframeOptions = useMemo(
        () => [
            {key: "4w", label: t("onboarding.wizard.timeframe_4w", "4 weeks")},
            {key: "3m", label: t("onboarding.wizard.timeframe_3m", "3 months")},
            {
                key: "semester",
                label: t("onboarding.wizard.timeframe_semester", "1 semester"),
            },
            {
                key: "flexible",
                label: t("onboarding.wizard.timeframe_flexible", "Flexible"),
            },
        ],
        [t],
    );

    const values: WizardValues = {goal, timeframe, dailyMinutes, currentProblem};

    function goNext() {
        setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    }
    function goBack() {
        if (step === 0) {
            onExit();
            return;
        }
        setStep((s) => Math.max(s - 1, 0));
    }

    const progressValue = ((step + 1) / TOTAL_STEPS) * 100;

    return (
        <section
            className="onboarding-wizard mx-auto flex w-full max-w-xl flex-col gap-6"
            data-testid="onboarding-wizard"
            aria-label={t("onboarding.wizard.step_label", "Step {current} of {total}")
                .replace("{current}", String(step + 1))
                .replace("{total}", String(TOTAL_STEPS))}
        >
            <div className="flex flex-col gap-2">
                <p
                    className="text-sm font-medium text-muted-foreground"
                    data-testid="onboarding-wizard-step-label"
                >
                    {t("onboarding.wizard.step_label", "Step {current} of {total}")
                        .replace("{current}", String(step + 1))
                        .replace("{total}", String(TOTAL_STEPS))}
                </p>
                <Progress value={progressValue} />
            </div>

            {/* One question per screen, inside a min-height floor sized
                for the tallest step so stepping forward/back never shifts
                the layout (#169). The floor is taller on mobile, where the
                timeframe options stack into one column, and shorter from
                ``sm`` up, where they sit in a 2-column grid. */}
            <div className="flex min-h-[240px] flex-col sm:min-h-[190px]">
            {step === 0 && (
                <div className="flex flex-col gap-3">
                    <label className="form-label" htmlFor="wizard-goal">
                        {t("onboarding.wizard.goal_title", "What's your learning goal?")}
                    </label>
                    <textarea
                        id="wizard-goal"
                        data-testid="onboarding-wizard-goal"
                        rows={3}
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder={t("onboarding.field_goal_hint", "")}
                        disabled={busy}
                    />
                </div>
            )}

            {step === 1 && (
                <div className="flex flex-col gap-3">
                    <span className="form-label">
                        {t("onboarding.wizard.timeframe_title", "How much time do you have?")}
                    </span>
                    <div
                        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                        role="radiogroup"
                        aria-label={t(
                            "onboarding.wizard.timeframe_title",
                            "How much time do you have?",
                        )}
                    >
                        {timeframeOptions.map((opt) => {
                            const selected = timeframe === opt.label;
                            return (
                                <Button
                                    key={opt.key}
                                    type="button"
                                    variant={selected ? "default" : "outline"}
                                    role="radio"
                                    aria-checked={selected}
                                    data-testid={`onboarding-wizard-timeframe-${opt.key}`}
                                    onClick={() => setTimeframe(opt.label)}
                                    disabled={busy}
                                    className="w-full justify-center"
                                >
                                    {opt.label}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="flex flex-col gap-3">
                    <label className="form-label" htmlFor="wizard-minutes">
                        {t("onboarding.wizard.minutes_title", "How many minutes per day?")}
                    </label>
                    <input
                        id="wizard-minutes"
                        data-testid="onboarding-wizard-minutes"
                        type="range"
                        min={MIN_MINUTES}
                        max={MAX_MINUTES}
                        step={5}
                        value={dailyMinutes}
                        onChange={(e) => setDailyMinutes(Number(e.target.value))}
                        disabled={busy}
                        className="h-11 w-full cursor-pointer"
                        aria-valuetext={t(
                            "onboarding.wizard.minutes_value",
                            "{n} min/day",
                        ).replace("{n}", String(dailyMinutes))}
                    />
                    <p
                        className="text-center text-lg font-semibold"
                        data-testid="onboarding-wizard-minutes-value"
                    >
                        {t("onboarding.wizard.minutes_value", "{n} min/day").replace(
                            "{n}",
                            String(dailyMinutes),
                        )}
                    </p>
                </div>
            )}

            {step === 3 && (
                <div className="flex flex-col gap-3">
                    <label className="form-label" htmlFor="wizard-problem">
                        {t("onboarding.wizard.problem_title", "What's holding you back right now?")}
                    </label>
                    <textarea
                        id="wizard-problem"
                        data-testid="onboarding-wizard-problem"
                        rows={3}
                        value={currentProblem}
                        onChange={(e) => setCurrentProblem(e.target.value)}
                        placeholder={t("onboarding.field_current_problem_hint", "")}
                        disabled={busy}
                    />
                </div>
            )}

            {step === 4 && (
                <div className="flex flex-col gap-3">
                    <h2 className="text-xl font-semibold">
                        {t("onboarding.wizard.done_title", "All set! Start the assessment?")}
                    </h2>
                    <p className="text-muted-foreground">
                        {t(
                            "onboarding.wizard.done_subtitle",
                            "The 12-question assessment builds your learning profile.",
                        )}
                    </p>
                </div>
            )}
            </div>

            {/* Navigation. Back is always present; the final step swaps
                "Next" for the two terminal actions. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={goBack}
                    disabled={busy}
                    data-testid="onboarding-wizard-back"
                >
                    {t("onboarding.wizard.back", "Back")}
                </Button>

                {step < TOTAL_STEPS - 1 ? (
                    <Button
                        type="button"
                        variant="default"
                        onClick={goNext}
                        disabled={busy}
                        data-testid="onboarding-wizard-next"
                    >
                        {t("onboarding.wizard.next", "Next")}
                    </Button>
                ) : (
                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => onFinish(values, false)}
                            disabled={busy}
                            data-testid="onboarding-wizard-later"
                        >
                            {t("onboarding.wizard.later", "Later")}
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            onClick={() => onFinish(values, true)}
                            disabled={busy}
                            data-testid="onboarding-wizard-start-assessment"
                        >
                            {t("onboarding.wizard.start_assessment", "Yes, start")}
                        </Button>
                    </div>
                )}
            </div>
        </section>
    );
}
