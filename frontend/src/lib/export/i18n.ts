/**
 * Lightweight translation tables for the export renderers (Phase
 * 16B). DE + EN translated; other six languages fall back to EN
 * the same way the rest of the app handles its passthrough
 * languages.
 *
 * Bundling the strings here (instead of fetching from
 * ``/api/i18n/{lang}``) keeps the renderers synchronous and
 * keeps the Dexie path free of any network roundtrip.
 */

export type ExportLang = "de" | "en";

function normaliseLang(lang: string): ExportLang {
    return lang === "de" ? "de" : "en";
}

const STRINGS = {
    de: {
        progress_report_title: "Lernfortschritt",
        session_detail_title: "Sitzungs-Detail",
        curriculum_overview_title: "Lehrplan-Übersicht",
        generated_at: "Erzeugt am",
        app_version: "App-Version",
        learner: "Lernende:r",
        language: "Sprache",
        method_profile: "Methoden-Profil",
        dominant_method: "Dominante Methode",
        assessed_at: "Zuletzt bewertet",
        no_profile:
            "Noch keine Bewertung vorhanden. Schließe die Eingangs-Bewertung ab, um dein Profil zu sehen.",
        projects: "Projekte",
        no_projects: "Noch keine Lernprojekte angelegt.",
        topic: "Thema",
        goal: "Ziel",
        timeframe: "Zeitrahmen",
        daily_minutes: "Tägliche Minuten",
        current_problem: "Aktuelles Hindernis",
        status: "Status",
        active: "aktiv",
        archived: "archiviert",
        session_count: "Anzahl Sitzungen",
        total_minutes: "Gesamtdauer (Minuten)",
        mean_understanding: "Durchschnittliches Verständnis",
        mean_stress: "Durchschnittlicher Stress",
        method_distribution: "Methoden-Verteilung",
        method_switches: "Methodenwechsel",
        no_switches: "Keine Methodenwechsel in diesem Projekt.",
        switched_from_to: "Wechsel",
        reason: "Begründung",
        recent_sessions: "Letzte Sitzungen",
        no_sessions: "Noch keine Sitzungen abgeschlossen.",
        method: "Methode",
        duration: "Dauer",
        understanding: "Verständnis",
        stress: "Stress",
        method_fit: "Methoden-Passung",
        notes: "Notizen",
        step_evaluation_insights: "Schritt-Auswertung",
        no_step_insights: "Noch keine Schritt-Auswertungen verfügbar.",
        step: "Schritt",
        evaluations_count: "Auswertungen",
        advance_rate: "Fortschritts-Rate",
        mean_confidence: "Durchschnittliche Sicherheit",
        deferred: "zurückgehalten",
        repeated: "wiederholt",
        advanced: "vorangeschritten",
        extractions: "Analysierte Gespräche",
        no_extractions: "Noch keine analysierten Gespräche.",
        imported_at: "Importiert am",
        messages: "Nachrichten",
        source: "Quelle",
        analysis: "Analyse-Ergebnis",
        no_session: "Sitzung nicht gefunden.",
        session: "Sitzung",
        started_at: "Begonnen am",
        ended_at: "Beendet am",
        cycle_step: "Aktueller Zyklus-Schritt",
        transcript: "Gesprächsverlauf",
        no_messages: "Keine Nachrichten in dieser Sitzung.",
        role_user: "Lernende:r",
        role_assistant: "KI",
        role_system: "System",
        rating: "Bewertung",
        no_rating: "Sitzung wurde nicht bewertet.",
        step_evaluations: "Schritt-Auswertungen",
        from_step: "Von Schritt",
        to_step: "Zu Schritt",
        confidence: "Sicherheit",
        applied: "Angewendet",
        not_applied: "Nicht angewendet",
        fallback: "Fallback genutzt",
        evaluated_at: "Bewertet am",
        curriculum: "Lehrplan",
        description: "Beschreibung",
        topics: "Themen",
        no_topics: "Keine Themen in diesem Lehrplan.",
        lessons: "Lektionen",
        no_lessons: "Keine Lektionen in diesem Lehrplan.",
        out_of: "von",
        minutes_short: "Min.",
        scale_5: "auf einer Skala von 1 bis 5",
    },
    en: {
        progress_report_title: "Learning Progress",
        session_detail_title: "Session Detail",
        curriculum_overview_title: "Curriculum Overview",
        generated_at: "Generated at",
        app_version: "App version",
        learner: "Learner",
        language: "Language",
        method_profile: "Method profile",
        dominant_method: "Dominant method",
        assessed_at: "Last assessed",
        no_profile:
            "No assessment yet. Complete the entry assessment to see your profile.",
        projects: "Projects",
        no_projects: "No learning projects yet.",
        topic: "Topic",
        goal: "Goal",
        timeframe: "Timeframe",
        daily_minutes: "Daily minutes",
        current_problem: "Current obstacle",
        status: "Status",
        active: "active",
        archived: "archived",
        session_count: "Sessions",
        total_minutes: "Total minutes",
        mean_understanding: "Average understanding",
        mean_stress: "Average stress",
        method_distribution: "Method distribution",
        method_switches: "Method switches",
        no_switches: "No method switches in this project.",
        switched_from_to: "Switch",
        reason: "Reason",
        recent_sessions: "Recent sessions",
        no_sessions: "No sessions completed yet.",
        method: "Method",
        duration: "Duration",
        understanding: "Understanding",
        stress: "Stress",
        method_fit: "Method fit",
        notes: "Notes",
        step_evaluation_insights: "Step evaluations",
        no_step_insights: "No step evaluations available yet.",
        step: "Step",
        evaluations_count: "Evaluations",
        advance_rate: "Advance rate",
        mean_confidence: "Average confidence",
        deferred: "deferred",
        repeated: "repeated",
        advanced: "advanced",
        extractions: "Analyzed conversations",
        no_extractions: "No analyzed conversations yet.",
        imported_at: "Imported at",
        messages: "Messages",
        source: "Source",
        analysis: "Analysis",
        no_session: "Session not found.",
        session: "Session",
        started_at: "Started at",
        ended_at: "Ended at",
        cycle_step: "Current cycle step",
        transcript: "Transcript",
        no_messages: "No messages in this session.",
        role_user: "Learner",
        role_assistant: "AI",
        role_system: "System",
        rating: "Rating",
        no_rating: "Session was not rated.",
        step_evaluations: "Step evaluations",
        from_step: "From step",
        to_step: "To step",
        confidence: "Confidence",
        applied: "Applied",
        not_applied: "Not applied",
        fallback: "Fallback used",
        evaluated_at: "Evaluated at",
        curriculum: "Curriculum",
        description: "Description",
        topics: "Topics",
        no_topics: "No topics in this curriculum.",
        lessons: "Lessons",
        no_lessons: "No lessons in this curriculum.",
        out_of: "out of",
        minutes_short: "min",
        scale_5: "on a scale from 1 to 5",
    },
} as const satisfies Record<ExportLang, Record<string, string>>;

export type ExportStringKey = keyof (typeof STRINGS)["en"];

export function t(lang: string, key: ExportStringKey): string {
    const table = STRINGS[normaliseLang(lang)];
    return table[key];
}

const METHOD_LABELS = {
    de: {
        deductive: "Deduktiv",
        inductive: "Induktiv",
        error_based: "Fehlerzentriert",
        dialogic: "Dialogisch",
        contextual: "Kontextuell",
        ai_adaptive: "KI-adaptiv",
    },
    en: {
        deductive: "Deductive",
        inductive: "Inductive",
        error_based: "Error-based",
        dialogic: "Dialogic",
        contextual: "Contextual",
        ai_adaptive: "AI-adaptive",
    },
} as const;

export function methodLabel(lang: string, method: string): string {
    const table = METHOD_LABELS[normaliseLang(lang)];
    return (table as Record<string, string>)[method] ?? method;
}

const STEP_LABELS = {
    de: {
        1: "Input",
        2: "Versuch",
        3: "Fehler",
        4: "Feedback",
        5: "Anpassung",
        6: "Wiederholung",
        7: "Integration",
    },
    en: {
        1: "Input",
        2: "Attempt",
        3: "Error",
        4: "Feedback",
        5: "Adapt",
        6: "Repeat",
        7: "Integrate",
    },
} as const;

export function stepLabel(lang: string, step: number): string {
    const table = STEP_LABELS[normaliseLang(lang)];
    return (table as Record<number, string>)[step] ?? String(step);
}

const STATUS_LABELS = {
    de: {
        active: "aktiv",
        completed: "abgeschlossen",
        abandoned: "abgebrochen",
    },
    en: {
        active: "active",
        completed: "completed",
        abandoned: "abandoned",
    },
} as const;

export function statusLabel(lang: string, status: string): string {
    const table = STATUS_LABELS[normaliseLang(lang)];
    return (table as Record<string, string>)[status] ?? status;
}
