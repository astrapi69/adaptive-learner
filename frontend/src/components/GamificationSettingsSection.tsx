/**
 * Settings > Gamification section (Phase 29D / v1.16.0).
 *
 * Five controls:
 *   - XP notifications toggle (localStorage, presentation-only)
 *   - Badge notifications toggle (localStorage)
 *   - Weekend mode toggle (persisted in ``user_streaks``)
 *   - Daily session goal (1..10, localStorage)
 *   - Reset XP/badges/streak (destructive, double confirm)
 *
 * The weekend-mode toggle is the only control that round-trips
 * to the backend; everything else is client-local because the
 * preferences only gate which toasts render + which goal-line
 * the dashboard draws.
 */

import {useEffect, useState} from "react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../hooks/ui/useI18n";
import {
    readGamificationPrefs,
    setBadgeNotifications,
    setDailySessionGoal,
    setXpNotifications,
} from "../lib/gamificationPref";
import {readLearnerState} from "../lib/learnerState";
import {getStorage} from "../storage";
import type {BadgeWithProgress} from "../storage/types";
import {notify} from "../utils/notify";
import BadgeGallery from "./badges/BadgeGallery";

export default function GamificationSettingsSection() {
    const {t} = useI18n();
    const [prefs, setPrefs] = useState(() => readGamificationPrefs());
    const [weekendMode, setWeekendMode] = useState(false);
    const [loadingStreak, setLoadingStreak] = useState(true);
    const [confirmCount, setConfirmCount] = useState(0);
    const [resetting, setResetting] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [badges, setBadges] = useState<BadgeWithProgress[] | null>(null);
    const userId = readLearnerState().userId;

    const handleOpenGallery = async () => {
        setGalleryOpen(true);
        if (badges === null && userId) {
            try {
                setBadges(await getStorage().gamification.listBadges(userId));
            } catch {
                /* non-fatal; the gallery shows an empty grid */
                setBadges([]);
            }
        }
    };

    useEffect(() => {
        let cancelled = false;
        if (!userId) {
            setLoadingStreak(false);
            return;
        }
        getStorage()
            .gamification.getStreak(userId)
            .then((s) => {
                if (cancelled) return;
                setWeekendMode(s.weekend_mode);
            })
            .catch(() => {
                /* non-fatal; default OFF */
            })
            .finally(() => {
                if (!cancelled) setLoadingStreak(false);
            });
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const handleXpToggle = (enabled: boolean) => {
        setPrefs((p) => ({...p, xpNotifications: enabled}));
        setXpNotifications(enabled);
    };
    const handleBadgeToggle = (enabled: boolean) => {
        setPrefs((p) => ({...p, badgeNotifications: enabled}));
        setBadgeNotifications(enabled);
    };
    const handleGoalChange = (value: number) => {
        setPrefs((p) => ({...p, dailySessionGoal: value}));
        setDailySessionGoal(value);
    };
    const handleWeekendToggle = async (enabled: boolean) => {
        if (!userId) return;
        try {
            const next = await getStorage().gamification.setWeekendMode(
                userId,
                enabled,
            );
            setWeekendMode(next.weekend_mode);
        } catch {
            notify.error(
                t(
                    "gamification.weekend_mode_save_failed",
                    "Could not save the weekend-mode setting.",
                ),
            );
        }
    };

    const handleResetClick = async () => {
        if (!userId) return;
        if (confirmCount < 2) {
            setConfirmCount(confirmCount + 1);
            return;
        }
        setResetting(true);
        try {
            const counts = await getStorage().gamification.resetProgress(userId);
            notify.success(
                t(
                    "gamification.reset_done",
                    "Progress reset: {xp} XP, {badges} badges, {streak} streaks.",
                )
                    .replace("{xp}", String(counts.xp_deleted))
                    .replace("{badges}", String(counts.badges_deleted))
                    .replace("{streak}", String(counts.streak_deleted)),
            );
            setConfirmCount(0);
        } catch {
            notify.error(
                t(
                    "gamification.reset_failed",
                    "Could not reset progress.",
                ),
            );
        } finally {
            setResetting(false);
        }
    };

    return (
        <section
            className="settings-section"
            data-testid="settings-section-gamification"
        >
            <h2 className="settings-section-title">
                {t("settings.section_gamification", "Gamification")}
            </h2>

            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t(
                            "settings.xp_notifications",
                            "Show XP notifications",
                        )}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.xp_notifications_help",
                            "Floating ‘+50 XP’ animation when you earn XP.",
                        )}
                    </span>
                </span>
                <input
                    type="checkbox"
                    data-testid="settings-xp-notifications-toggle"
                    checked={prefs.xpNotifications}
                    onChange={(e) => handleXpToggle(e.target.checked)}
                />
            </label>

            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t(
                            "settings.badge_notifications",
                            "Show badge notifications",
                        )}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.badge_notifications_help",
                            "Toast when a new badge is earned.",
                        )}
                    </span>
                </span>
                <input
                    type="checkbox"
                    data-testid="settings-badge-notifications-toggle"
                    checked={prefs.badgeNotifications}
                    onChange={(e) => handleBadgeToggle(e.target.checked)}
                />
            </label>

            <div className="form-row">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t("gamification.gallery.title", "Badges")}
                    </span>
                </span>
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="settings-view-all-badges"
                    onClick={handleOpenGallery}
                >
                    {t("gamification.gallery.view_all", "View all badges")}
                </Button>
            </div>

            <BadgeGallery
                open={galleryOpen}
                onClose={() => setGalleryOpen(false)}
                badges={badges}
            />

            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t("gamification.weekend_mode", "Weekend mode")}
                    </span>
                    <span className="form-hint">
                        {t(
                            "gamification.weekend_mode_help",
                            "Weekends don't count toward streak gaps.",
                        )}
                    </span>
                </span>
                <input
                    type="checkbox"
                    data-testid="settings-weekend-mode-toggle"
                    checked={weekendMode}
                    disabled={loadingStreak || !userId}
                    onChange={(e) => handleWeekendToggle(e.target.checked)}
                />
            </label>

            <label className="form-row">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t(
                            "settings.daily_session_goal",
                            "Daily session goal",
                        )}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.daily_session_goal_help",
                            "Sessions per day shown as a progress hint.",
                        )}
                    </span>
                </span>
                <input
                    type="number"
                    min={1}
                    max={10}
                    data-testid="settings-daily-goal-input"
                    value={prefs.dailySessionGoal}
                    onChange={(e) =>
                        handleGoalChange(Number.parseInt(e.target.value, 10))
                    }
                />
            </label>

            <div className="form-row form-row-stack">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t("settings.reset_progress", "Reset progress")}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.reset_progress_help",
                            "Permanently delete XP, badges, and streak. Cannot be undone.",
                        )}
                    </span>
                </span>
                <Button
                    type="button"
                    variant={confirmCount === 0 ? "secondary" : "destructive"}
                    data-testid="settings-reset-progress-button"
                    data-confirm-count={confirmCount}
                    disabled={resetting || !userId}
                    onClick={handleResetClick}
                >
                    {confirmCount === 0
                        ? t("settings.reset_progress", "Reset progress")
                        : confirmCount === 1
                          ? t(
                                "settings.reset_confirm_first",
                                "Click again to confirm",
                            )
                          : t(
                                "settings.reset_confirm_second",
                                "Click once more to delete forever",
                            )}
                </Button>
            </div>
        </section>
    );
}
