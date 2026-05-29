/**
 * DailyMissionsCard (EXP-010 / Phase 56F).
 *
 * Dashboard widget showing today's missions with live progress.
 * Reads via ``getStorage().missions.getDaily`` (assigns on first
 * visit of the day), respects the mission preferences (on/off,
 * count, difficulty mix), and renders completion + all-done
 * states. Real-time progress refresh on lesson completion is
 * wired in 56H; celebration on completion in 56J.
 */

import {
    Award,
    BookOpen,
    Calendar,
    CheckCircle2,
    Clock,
    Compass,
    Flame,
    ListChecks,
    Repeat,
    ShieldCheck,
    Star,
    Target,
    type LucideIcon,
} from "lucide-react";
import {useEffect, useState} from "react";

import {useI18n} from "../hooks/useI18n";
import {
    MISSION_PREF_CHANGE_EVENT,
    readMissionPrefs,
} from "../lib/missionPref";
import {localTodayIso} from "../lib/missions/schedule";
import type {DailyMission} from "../lib/missions/types";
import {getStorage} from "../storage";

const ICONS: Record<string, LucideIcon> = {
    "book-open": BookOpen,
    star: Star,
    compass: Compass,
    repeat: Repeat,
    "list-checks": ListChecks,
    award: Award,
    "shield-check": ShieldCheck,
    clock: Clock,
    flame: Flame,
    calendar: Calendar,
};

export interface DailyMissionsCardProps {
    userId: string;
}

export default function DailyMissionsCard({userId}: DailyMissionsCardProps) {
    const {t, lang} = useI18n();
    const [missions, setMissions] = useState<DailyMission[] | null>(null);
    const [enabled, setEnabled] = useState<boolean>(
        () => readMissionPrefs().enabled,
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const prefs = readMissionPrefs();
            setEnabled(prefs.enabled);
            if (!prefs.enabled || !userId) {
                setMissions([]);
                return;
            }
            try {
                const result = await getStorage().missions.getDaily(userId, {
                    count: prefs.count,
                    difficultyMix: prefs.difficultyMix,
                    todayIso: localTodayIso(lang),
                });
                if (!cancelled) setMissions(result.missions);
            } catch {
                if (!cancelled) setMissions([]);
            }
        };
        void load();
        window.addEventListener(MISSION_PREF_CHANGE_EVENT, load);
        return () => {
            cancelled = true;
            window.removeEventListener(MISSION_PREF_CHANGE_EVENT, load);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, lang]);

    if (!enabled) return null;

    const allDone =
        missions !== null &&
        missions.length > 0 &&
        missions.every((m) => m.completed);

    return (
        <div className="daily-missions" data-testid="daily-missions">
            <h2 className="dashboard-card-title">
                {t("missions.card_title", "Today's missions")}
            </h2>

            {missions === null ? (
                <p className="muted" role="status">
                    {t("common.loading", "Loading…")}
                </p>
            ) : missions.length === 0 ? (
                <p className="muted" data-testid="daily-missions-empty">
                    {t("missions.card_empty", "No missions today.")}
                </p>
            ) : (
                <ul className="mission-list">
                    {missions.map((m) => {
                        const Icon = ICONS[m.template.icon] ?? Target;
                        const pct =
                            m.target > 0
                                ? Math.round((m.progress / m.target) * 100)
                                : 0;
                        return (
                            <li
                                key={m.id}
                                className="mission-row"
                                data-completed={m.completed ? "true" : "false"}
                                data-testid={`mission-${m.template_id}`}
                            >
                                <span className="mission-icon" aria-hidden="true">
                                    <Icon size={20} />
                                </span>
                                <div className="mission-body">
                                    <span className="mission-title">
                                        {t(m.template.title_key, m.template_id)}
                                    </span>
                                    <div
                                        className="mission-progressbar"
                                        role="progressbar"
                                        aria-valuenow={m.progress}
                                        aria-valuemin={0}
                                        aria-valuemax={m.target}
                                    >
                                        <div
                                            className="mission-progressfill"
                                            style={{width: `${pct}%`}}
                                        />
                                        <span
                                            className="mission-progresslabel"
                                            data-testid={`mission-progress-${m.template_id}`}
                                        >
                                            {m.progress} / {m.target}
                                        </span>
                                    </div>
                                </div>
                                <span className="mission-xp">
                                    +{m.template.xp_reward} XP
                                </span>
                                {m.completed && (
                                    <CheckCircle2
                                        className="mission-done-icon"
                                        size={18}
                                        aria-hidden="true"
                                    />
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {allDone && (
                <p
                    className="daily-missions-alldone"
                    data-testid="daily-missions-alldone"
                >
                    {t("missions.card_all_done", "All missions done!")}
                </p>
            )}

            {missions !== null && missions.length > 0 && (
                <p className="daily-missions-tomorrow muted">
                    {t("missions.card_tomorrow", "New missions tomorrow.")}
                </p>
            )}
        </div>
    );
}
