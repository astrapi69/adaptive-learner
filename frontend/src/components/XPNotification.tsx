/**
 * Floating "+N XP" toast (Phase 29A / v1.16.0).
 *
 * Mounted by the page that triggers an XP-earning action
 * (Session, Assessment, Imports). The notification reads the
 * award details (xp_earned, level_up) and renders a transient
 * animation; auto-dismisses after 2 seconds (configurable via
 * the ``durationMs`` prop for tests).
 *
 * Visibility is opt-in: when Settings.xp_notifications is false
 * the parent simply does not mount the component. Keeps the
 * gamification surface dismissable without prop-drilling a
 * flag through every page.
 */

import {useEffect, useState} from "react";

import {useI18n} from "../hooks/useI18n";
import type {XPAwardResult} from "../storage/types";

interface XPNotificationProps {
    award: XPAwardResult | null;
    durationMs?: number;
    onDismiss?: () => void;
}

export default function XPNotification({
    award,
    durationMs = 2000,
    onDismiss,
}: XPNotificationProps) {
    const {t} = useI18n();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!award) {
            setVisible(false);
            return;
        }
        setVisible(true);
        const id = setTimeout(() => {
            setVisible(false);
            if (onDismiss) onDismiss();
        }, durationMs);
        return () => clearTimeout(id);
    }, [award, durationMs, onDismiss]);

    if (!award || !visible) {
        return null;
    }
    return (
        <div
            className="xp-notification"
            role="status"
            aria-live="polite"
            data-testid="xp-notification"
        >
            <span
                className="xp-notification__amount"
                data-testid="xp-notification-amount"
            >
                +{award.xp_earned} {t("gamification.xp", "XP")}
            </span>
            {award.level_up && (
                <span
                    className="xp-notification__level-up"
                    data-testid="xp-notification-level-up"
                >
                    {t("gamification.level_up", "Level up!")}{" "}
                    {t("gamification.level", "Level")} {award.level}
                </span>
            )}
        </div>
    );
}
