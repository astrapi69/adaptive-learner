import {useI18n} from "../hooks/useI18n";

/**
 * Placeholder Landing page for the Phase 1A skeleton.
 *
 * Real Landing + Onboarding + Assessment + Dashboard + Session +
 * Settings pages land in Phase 4 once the backend domain (Phase 1B/C)
 * and plugins (Phase 3) are in place. See
 * docs/adaptive-learner-project-reference.md §8.
 */
export default function Landing() {
    const {t} = useI18n();
    return (
        <main
            data-testid="skeleton-placeholder"
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                padding: "2rem",
                fontFamily: "system-ui, sans-serif",
                textAlign: "center",
            }}
        >
            <h1 style={{margin: 0}}>{t("app.name", "Adaptive Learner")}</h1>
            <p style={{margin: 0, maxWidth: "40rem", opacity: 0.75}}>
                {t(
                    "app.skeleton_notice",
                    "Skeleton state. Domain models, plugins and pages land in upcoming phases — see docs/adaptive-learner-project-reference.md.",
                )}
            </p>
        </main>
    );
}
