import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {toast} from "react-toastify";

import {Button} from "@/components/ui/button";
import {ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {UI_LANGUAGES} from "../lib/languages";
import {
    clearLearnerState,
    readLearnerState,
    setLanguage,
    setProjectId,
    setUserId,
} from "../lib/learnerState";
import {getStorage, resolveStorageMode} from "../storage";

/**
 * Landing page (project-reference §8 row ``/``).
 *
 * Three affordances: language picker, Start CTA, and a
 * post-browser-wipe recovery flow (Phase 41B) that runs before
 * either UI paints.
 *
 * Recovery flow:
 *
 *   1. localStorage userId present → verify via
 *      ``storage.users.get`` and redirect to Dashboard. Existing
 *      behaviour (4 releases of muscle memory). 404 clears the
 *      stale ids and falls through to step 2.
 *   2. localStorage empty → ask the storage layer for the most
 *      recent locally-known identity via
 *      ``storage.users.findMostRecent``:
 *        - ApiStorage reads ~/.config/adaptive_learner/identity.yaml
 *          via GET /api/identity (returns null on 404).
 *        - DexieStorage queries the most recent users row + its
 *          active project (returns null when tables are empty).
 *   3. If a recovery hint comes back, verify the user still
 *      exists via ``storage.users.get`` and re-seed localStorage
 *      (userId, projectId, language). Show a friendly toast iff
 *      we recovered from Dexie (the user spec keeps API-mode
 *      recovery silent to honour the "Recovery is invisible"
 *      rule; the Dexie-mode toast signals "your IndexedDB was
 *      still there"). Then redirect to Dashboard.
 *   4. No hint or verification fails → show the landing UI so a
 *      genuine first-time visitor sees the onboarding CTA.
 *
 * The language picker writes both to the i18n provider (live
 * string swap) and to localStorage (persists for the next cold
 * start). The Start button routes to ``/onboarding``.
 */
export default function Landing() {
    const {t, lang, setLang} = useI18n();
    const navigate = useNavigate();
    // v0.4.0 — returning-user check; v1.25.0 extends "checking"
    // to also cover the recovery-from-disk path so the spinner
    // shows during the identity.yaml round-trip even when
    // localStorage is empty. The flag flips to false only when
    // recovery is fully exhausted and we need the landing UI.
    const [checking, setChecking] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        const storage = getStorage();
        const storageMode = resolveStorageMode();

        async function tryRecovery() {
            const hint = await storage.users.findMostRecent();
            if (cancelled || hint === null) return false;
            try {
                await storage.users.get(hint.userId);
            } catch {
                // Stale hint (user deleted out from under us, or
                // a different mode wrote a non-resolvable id).
                // Treat as no recovery; show landing.
                return false;
            }
            if (cancelled) return false;
            setUserId(hint.userId);
            if (hint.projectId) setProjectId(hint.projectId);
            if (hint.language) setLanguage(hint.language);
            // API-mode recovery is invisible (identity.yaml is
            // expected on every desktop install). Dexie-mode
            // recovery is the meaningful one - the user wiped
            // their localStorage and we re-seeded from their
            // existing IndexedDB tables; surface it so they know
            // their data survived.
            if (storageMode === "dexie") {
                toast.success(
                    t(
                        "landing.recovered_toast",
                        "Welcome back! Your learning data is still here.",
                    ),
                );
            }
            navigate("/dashboard", {replace: true});
            return true;
        }

        async function run() {
            const {userId} = readLearnerState();
            if (userId) {
                try {
                    await storage.users.get(userId);
                    if (cancelled) return;
                    // The persisted user still exists; jump straight
                    // to the Dashboard. ``replace`` so the browser
                    // back-button doesn't bounce the user back here.
                    navigate("/dashboard", {replace: true});
                    return;
                } catch (err) {
                    if (cancelled) return;
                    // 404 → user was deleted out from under us.
                    // Wipe the stale ids and FALL THROUGH to the
                    // recovery path - a fresh identity.yaml (or a
                    // remaining Dexie row) may still rescue us.
                    // Anything else (5xx, network down) leaves the
                    // ids alone and shows the landing so the user
                    // can retry.
                    if (err instanceof ApiError && err.status === 404) {
                        clearLearnerState();
                    } else {
                        setChecking(false);
                        return;
                    }
                }
            }
            const recovered = await tryRecovery();
            if (cancelled) return;
            if (!recovered) {
                setChecking(false);
            }
        }

        run().catch(() => {
            // Defensive: any unexpected throw from the recovery
            // path falls back to the landing UI rather than
            // wedging the user on a permanent spinner.
            if (!cancelled) setChecking(false);
        });

        return () => {
            cancelled = true;
        };
    }, [navigate, t]);

    const handleLangChange = (newLang: string) => {
        setLang(newLang);
        setLanguage(newLang);
    };

    if (checking) {
        return (
            <main
                id="main"
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
        <main id="main" data-testid="landing" className="landing-page">
            <header className="landing-brand">
                <img
                    src={`${import.meta.env.BASE_URL}icon-512.png`}
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
                    {UI_LANGUAGES.map(({code, nativeName}) => (
                        <button
                            type="button"
                            key={code}
                            role="radio"
                            aria-checked={lang === code}
                            data-testid={`landing-lang-${code}`}
                            className={`landing-lang-btn${lang === code ? " is-active" : ""}`}
                            onClick={() => handleLangChange(code)}
                        >
                            {nativeName}
                        </button>
                    ))}
                </div>
            </section>

            <Button
                type="button"
                data-testid="landing-start"
                variant="default"
                className="landing-cta"
                onClick={() => navigate("/onboarding")}
            >
                {t("landing.start_button", "Start your learning journey")}
            </Button>

            <p className="landing-secondary">
                <a
                    href={`${import.meta.env.BASE_URL}docs/`}
                    data-testid="landing-docs-link"
                    className="landing-secondary-link"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {t("landing.docs_link", "Read the documentation")}
                </a>
            </p>
        </main>
    );
}
