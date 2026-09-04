/**
 * FlashRoundCard (#2888) - the set overview's entry to the per-set
 * flash round: a generated round from the set's most error-prone
 * elements, unlocked by finishing the set (every lesson with at least
 * one star). Self-gating on the game mode + special-rounds switch;
 * while locked it stays visible with the unlock condition as tooltip
 * (feature-state policy #335). Starting the round collects the
 * exercises through the storage abstraction and opens the existing
 * error-replay player with the flash-round countdown.
 */

import {Zap} from "lucide-react";
import {useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router";

import {Button} from "@/components/ui/button";

import {useI18n} from "../../hooks/ui/useI18n";
import {baseLessons} from "../../lib/content/browse/bonus-lessons";
import {
    collectFlashRoundExercises,
    isFlashRoundUnlocked,
    selectFlashRoundErrors,
} from "../../lib/flash-round/flash-round";
import {readLearnerState} from "../../lib/learning/learnerState";
import {
    PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT,
    playfulSpecialRoundsActive,
    readFlashRoundCards,
} from "../../lib/learning/playful/playfulSpecialRoundsPref";
import {PLAYFUL_MODE_CHANGE_EVENT} from "../../lib/learning/playful/playfulModePref";
import {readPlayfulCountdownSeconds} from "../../lib/learning/playful/playfulTensionPref";
import {getStorage} from "../../storage";
import type {ContentLesson, ElementError} from "../../storage/types";
import {notify} from "../../utils/notify";

export interface FlashRoundCardProps {
    source: string;
    setId: string;
    /** Route slug of the set (``--``-encoded source). */
    slug: string;
    setTitle: string;
}

export default function FlashRoundCard({
    source,
    setId,
    slug,
    setTitle,
}: FlashRoundCardProps) {
    const {t} = useI18n();
    const navigate = useNavigate();
    const location = useLocation();
    const [active, setActive] = useState<boolean>(() =>
        playfulSpecialRoundsActive(),
    );
    const [unlocked, setUnlocked] = useState(false);
    const [errors, setErrors] = useState<ElementError[]>([]);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        const refresh = () => setActive(playfulSpecialRoundsActive());
        window.addEventListener(PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT, refresh);
        window.addEventListener(PLAYFUL_MODE_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);
        refresh();
        return () => {
            window.removeEventListener(
                PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT,
                refresh,
            );
            window.removeEventListener(PLAYFUL_MODE_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);

    useEffect(() => {
        if (!active) return;
        const userId = readLearnerState().userId;
        if (!userId) return;
        let cancelled = false;
        void (async () => {
            try {
                const storage = getStorage();
                const [listing, progress, errorRows] = await Promise.all([
                    storage.contentLoader.listLessons(source, setId),
                    storage.lessonProgress.list(userId),
                    storage.elementErrors.list(userId, {
                        setId,
                        includeMastered: true,
                    }),
                ]);
                if (cancelled) return;
                // #2890 - a still-locked bonus lesson must never block
                // the flash round: the finish condition counts the
                // REGULAR lessons only.
                setUnlocked(
                    isFlashRoundUnlocked(
                        baseLessons(listing.lessons),
                        progress,
                        setId,
                    ),
                );
                setErrors(errorRows);
            } catch {
                /* decoration - a failed read just keeps the card locked */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [active, source, setId]);

    if (!active) return null;

    const startRound = async () => {
        if (starting) return;
        setStarting(true);
        try {
            const storage = getStorage();
            const picked = selectFlashRoundErrors(
                errors,
                readFlashRoundCards(),
            );
            const lessonIds = [...new Set(picked.map((e) => e.lesson_id))];
            const lessons = new Map<string, ContentLesson>();
            for (const lessonId of lessonIds) {
                try {
                    lessons.set(
                        lessonId,
                        await storage.contentLoader.getLesson(
                            source,
                            setId,
                            lessonId,
                        ),
                    );
                } catch {
                    // Evicted lesson - its errors are skipped below.
                }
            }
            const round = collectFlashRoundExercises(picked, lessons);
            if (round.exercises.length === 0) {
                notify.warning(
                    t(
                        "lesson.flash_round.no_content",
                        "No playable error cards found for this set.",
                    ),
                );
                return;
            }
            navigate(
                `/error-replay/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/flash-round`,
                {
                    state: {
                        exercises: round.exercises,
                        cards: round.cards,
                        lessonTitle: setTitle,
                        flashRound: {
                            seconds: readPlayfulCountdownSeconds(),
                            backTo: location.pathname,
                        },
                    },
                },
            );
        } finally {
            setStarting(false);
        }
    };

    const perfect = unlocked && errors.length === 0;

    return (
        <section
            className="mt-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            data-testid="flash-round-card"
        >
            <Zap
                size={18}
                aria-hidden="true"
                className="shrink-0 text-[var(--method-contextual)]"
            />
            <span className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
                <span className="text-[0.95rem] font-medium">
                    {t("lesson.flash_round.card_title", "Flash round")}
                </span>
                <span className="text-sm text-[var(--fg-muted)]">
                    {t(
                        "lesson.flash_round.card_description",
                        "A quick round of this set's trickiest cards, with the countdown ring.",
                    )}
                </span>
            </span>
            <Button
                type="button"
                size="sm"
                disabled={!unlocked || perfect || starting}
                title={
                    !unlocked
                        ? t(
                              "lesson.flash_round.locked_tooltip",
                              "Finish every lesson of this set with at least one star to unlock.",
                          )
                        : perfect
                          ? t(
                                "lesson.flash_round.perfect_tooltip",
                                "No error cards - this set is already perfect!",
                            )
                          : undefined
                }
                onClick={() => {
                    void startRound();
                }}
                data-testid="flash-round-start"
            >
                {t("lesson.flash_round.start", "Start flash round")}
            </Button>
        </section>
    );
}
