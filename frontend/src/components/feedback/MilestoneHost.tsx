/**
 * MilestoneHost (EXP-008 / Phase 55D).
 *
 * Mounted once at the app root. Drains the celebration queue and
 * shows one MilestoneOverlay at a time: a 500ms gap separates
 * consecutive milestones, each auto-dismisses after 3s. Overlays
 * are suppressed entirely when the effective feedback intensity
 * is "subtle" (which includes prefers-reduced-motion).
 */

import {useEffect, useState} from "react";
import {useNavigate} from "react-router";

import {
    dequeueMilestone,
    setMilestoneListener,
} from "../../lib/feedback/celebrationQueue";
import {
    allowsMilestones,
    effectiveIntensity,
} from "../../lib/feedback/feedbackPref";
import type {Milestone} from "../../lib/feedback/milestones";
import MilestoneOverlay from "./MilestoneOverlay";

const GAP_MS = 500;
const DISMISS_MS = 3000;

export default function MilestoneHost() {
    const navigate = useNavigate();
    const [pending, setPending] = useState<Milestone[]>([]);
    const [current, setCurrent] = useState<Milestone | null>(null);

    // Drain the module-level queue into local state on notify.
    useEffect(() => {
        const drain = () => {
            const drained: Milestone[] = [];
            let next: Milestone | undefined;
            while ((next = dequeueMilestone()) !== undefined) {
                drained.push(next);
            }
            if (drained.length > 0) {
                setPending((prev) => [...prev, ...drained]);
            }
        };
        drain(); // pick up anything enqueued before mount
        return setMilestoneListener(drain);
    }, []);

    // Show the next milestone when idle (with the inter-item gap).
    useEffect(() => {
        if (current !== null || pending.length === 0) return;
        if (!allowsMilestones(effectiveIntensity())) {
            setPending([]); // subtle / reduced-motion: no overlays
            return;
        }
        const [next, ...rest] = pending;
        const timer = window.setTimeout(() => {
            setCurrent(next);
            setPending(rest);
        }, GAP_MS);
        return () => window.clearTimeout(timer);
    }, [current, pending]);

    // Auto-dismiss the current milestone.
    useEffect(() => {
        if (current === null) return;
        const timer = window.setTimeout(() => setCurrent(null), DISMISS_MS);
        return () => window.clearTimeout(timer);
    }, [current]);

    if (current === null) return null;

    return (
        <MilestoneOverlay
            milestone={current}
            onDismiss={() => setCurrent(null)}
            onViewBadges={() => {
                setCurrent(null);
                navigate("/dashboard");
            }}
        />
    );
}
