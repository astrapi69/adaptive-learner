/**
 * SummaryTicketReward (#2889) - the ticket-economy banner on the
 * lesson summary: banks the tickets this run earned (full first-pass
 * score, a run survived with all hearts, newly reached streak
 * milestones) into the arcade ticket store and offers the jump into
 * the arcade. Self-gating on the game mode + ticket switch; the
 * already-completed guard keeps a revisited summary from re-awarding
 * (a "Practice again" restart resets the row and earns fresh).
 *
 * The award uses the frozen first-pass score, so the correction
 * round can never turn a run perfect after the fact; the error
 * replay and flash rounds run in their own player and never mount
 * this component.
 */

import {useEffect, useRef, useState} from "react";
import {Ticket} from "lucide-react";
import {useNavigate} from "react-router";

import {Button} from "@/components/ui/button";

import {useI18n} from "../../../hooks/ui/useI18n";
import {
    awardStreakMilestoneTickets,
    awardTickets,
} from "../../../lib/arcade/ticket-store";
import {ticketsForRun} from "../../../lib/arcade/ticket-rules";
import {
    playfulTicketsActive,
    readTicketCap,
} from "../../../lib/learning/playful/playfulTicketsPref";

export interface SummaryTicketRewardProps {
    userId: string;
    /** Frozen first-pass score of the run. */
    scoreCorrect: number;
    scoreTotal: number;
    /** The hearts system ran and no heart was lost (#2878). */
    fullHeartsRun: boolean;
    /** The lesson row was already completed before this summary -
     *  a revisit, which must never re-award. */
    alreadyCompleted: boolean;
    /** Current streak (refines async; 0 until fetched). */
    streakDays: number;
}

export default function SummaryTicketReward({
    userId,
    scoreCorrect,
    scoreTotal,
    fullHeartsRun,
    alreadyCompleted,
    streakDays,
}: SummaryTicketRewardProps) {
    const {t} = useI18n();
    const navigate = useNavigate();
    const active = playfulTicketsActive() && userId !== "";
    const [granted, setGranted] = useState(0);

    // The run award fires ONCE per summary mount (the ref guards the
    // dev-mode double effect); milestones ride the streak effect below
    // and dedupe inside the store.
    const runAwarded = useRef(false);
    useEffect(() => {
        if (!active || alreadyCompleted || runAwarded.current) return;
        runAwarded.current = true;
        const earned = ticketsForRun({
            scoreCorrect,
            scoreTotal,
            fullHeartsRun,
        });
        const banked = awardTickets(userId, earned, readTicketCap());
        if (banked > 0) setGranted((prev) => prev + banked);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, alreadyCompleted]);

    useEffect(() => {
        if (!active || alreadyCompleted || streakDays <= 0) return;
        const banked = awardStreakMilestoneTickets(
            userId,
            streakDays,
            readTicketCap(),
        );
        if (banked > 0) setGranted((prev) => prev + banked);
    }, [active, alreadyCompleted, streakDays, userId]);

    if (!active || granted === 0) return null;

    const message =
        granted === 1
            ? t(
                  "lesson.summary.ticket_earned_one",
                  "Reward unlocked: one game ticket!",
              )
            : t(
                  "lesson.summary.ticket_earned_many",
                  "Reward unlocked: {n} game tickets!",
              ).replace("{n}", String(granted));

    return (
        <div
            className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--accent-subtle)] px-4 py-3"
            data-testid="summary-ticket-reward"
        >
            <Ticket size={18} aria-hidden="true" />
            <span className="text-sm font-medium">{message}</span>
            <Button
                type="button"
                size="sm"
                onClick={() => navigate("/arcade")}
                data-testid="summary-ticket-play"
            >
                {t("lesson.summary.ticket_play_now", "Play now")}
            </Button>
        </div>
    );
}
