import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import {ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {SUPPORTED_LANGUAGES, type SupportedLanguage} from "../lib/constants";
import {clearLearnerState, readLearnerState, setLanguage} from "../lib/learnerState";
import {getStorage} from "../storage";

/**
 * Landing page (project-reference §8 row ``/``).
 *
 * Two affordances: pick the UI language and start the onboarding
 * flow. The language picker writes both to the i18n provider
 * (live string swap) and to localStorage (persists for the next
 * cold start). The Start button routes to ``/onboarding``.
 *
 * The page has no API roundtrip — it's a fully static, fast-to-
 * paint entry point that works even when the backend is offline,
 * which lets the user reach Settings to (re-)enter an API key
 * once we wire the route.
 */
export default function Landing() {
    const {t, lang, setLang} = useI18n();
    const navigate = useNavigate();
    // v0.4.0 — returning-user check. While ``true`` the page
    // shows a minimal "Welcome back…" spinner; when the user
    // id is missing or stale (404), the regular Landing UI
    // renders so first-time visitors aren't blocked behind a
    // network request that doesn't apply to them.
    const [checking, setChecking] = useState<boolean>(
        () => readLearnerState().userId !== null,
    );

    useEffect(() => {
        const {userId} = readLearnerState();
        if (!userId) {
            // First-time visitor — nothing to verify; show the
            // language picker + CTA below.
            return;
        }
        let cancelled = false;
        getStorage()
            .users.get(userId)
            .then(() => {
                if (cancelled) return;
                // The persisted user still exists; jump straight
                // to the Dashboard. ``replace`` so the browser
                // back-button doesn't bounce the user back here.
                navigate("/dashboard", {replace: true});
            })
            .catch((err) => {
                if (cancelled) return;
                // 404 → the user was deleted out from under us
                // (test fixtures, manual DB cleanup, account
                // removal). Wipe the stale ids and show the
                // landing UI so the visitor can onboard fresh.
                // Anything else (5xx, network down) leaves the
                // ids in place — the user can retry by reloading.
                if (err instanceof ApiError && err.status === 404) {
                    clearLearnerState();
                }
                setChecking(false);
            });
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    const handleLangChange = (newLang: SupportedLanguage) => {
        setLang(newLang);
        setLanguage(newLang);
    };

    if (checking) {
        return (
            <main
                data-testid="landing-checking"
                className="landing-page landing-checking"
            >
                <p className="muted">
                    {t("landing.checking_session", "Welcome back…")}
                </p>
            </main>
        );
    }

    return (
        <main data-testid="landing" className="landing-page">
            <header className="landing-brand">
                <img
                    src={`${import.meta.env.BASE_URL}icon-192.svg`}
                    alt=""
                    aria-hidden="true"
                    className="landing-logo"
                    width={96}
                    height={96}
                />
                <h1 className="landing-title">{t("landing.title", "Adaptive Learner")}</h1>
                <p className="landing-subtitle">
                    {t("landing.subtitle", "Learning that adapts to you.")}
                </p>
            </header>

            <section className="landing-intro">
                <p>{t("landing.intro")}</p>
            </section>

            <section className="landing-lang" aria-labelledby="lang-label">
                <p id="lang-label" className="landing-lang-label">
                    {t("landing.choose_language", "Choose your language")}
                </p>
                <div role="radiogroup" aria-labelledby="lang-label" className="landing-lang-options">
                    {SUPPORTED_LANGUAGES.map((code) => (
                        <button
                            type="button"
                            key={code}
                            role="radio"
                            aria-checked={lang === code}
                            data-testid={`landing-lang-${code}`}
                            className={`landing-lang-btn${lang === code ? " is-active" : ""}`}
                            onClick={() => handleLangChange(code)}
                        >
                            {code.toUpperCase()}
                        </button>
                    ))}
                </div>
            </section>

            <button
                type="button"
                data-testid="landing-start"
                className="landing-cta"
                onClick={() => navigate("/onboarding")}
            >
                {t("landing.start_button", "Start your learning journey")}
            </button>

            <p className="landing-secondary">
                <a
                    href={`${import.meta.env.BASE_URL}docs/`}
                    data-testid="landing-docs-link"
                    className="landing-secondary-link"
                >
                    {t("landing.docs_link", "Read the documentation")}
                </a>
            </p>
        </main>
    );
}
