import {useNavigate} from "react-router-dom";

import {useI18n} from "../hooks/useI18n";
import {SUPPORTED_LANGUAGES, type SupportedLanguage} from "../lib/constants";
import {setLanguage} from "../lib/learnerState";

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

    const handleLangChange = (newLang: SupportedLanguage) => {
        setLang(newLang);
        setLanguage(newLang);
    };

    return (
        <main data-testid="landing" className="landing-page">
            <header className="landing-brand">
                <img
                    src="/icon-192.svg"
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
        </main>
    );
}
