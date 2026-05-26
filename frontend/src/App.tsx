import {lazy, Suspense, useCallback, useEffect, useState} from "react";
import {Routes, Route} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import type {ApiError} from "./api/client";
import ErrorBoundary from "./components/ErrorBoundary";
import HelpDrawer from "./components/help/HelpDrawer";
import InstallPrompt from "./components/InstallPrompt";
import Navigation from "./components/Navigation";
import {HelpProvider} from "./contexts/HelpContext";
import {I18nProvider} from "./hooks/useI18n";
import {useTheme} from "./hooks/useTheme";
import Landing from "./pages/Landing";
import SkipToContent from "./components/SkipToContent";

// Route-level code-splitting. Landing stays in the main bundle as
// the entry route; everything else loads on first navigation. See
// BUNDLE-SIZE-DYNAMIC-IMPORT-01.
const AnkiPage = lazy(() => import("./pages/Anki"));
const Assessment = lazy(() => import("./pages/Assessment"));
const ContentPage = lazy(() => import("./pages/Content"));
const Curriculum = lazy(() => import("./pages/Curriculum"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LessonPage = lazy(() => import("./pages/Lesson"));
const Import = lazy(() => import("./pages/Import"));
const ImportDetail = lazy(() => import("./pages/ImportDetail"));
const LearningRepoPage = lazy(() => import("./pages/LearningRepo"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Progress = lazy(() => import("./pages/Progress"));
const Pronunciation = lazy(() => import("./pages/Pronunciation"));
const Session = lazy(() => import("./pages/Session"));
const Settings = lazy(() => import("./pages/Settings"));

// Lazy-loaded so ``eventRecorder`` (statically imported inside both
// components) lands in its own chunk instead of the main bundle.
// See BUNDLE-SIZE-DYNAMIC-IMPORT-01.
const EventRecorderSetup = lazy(
    () => import("./components/EventRecorderSetup"),
);
const ErrorReportDialog = lazy(
    () => import("./components/ErrorReportDialog"),
);

/**
 * Application root. Three concentric layers:
 *
 *   1. ErrorBoundary — catches anything thrown during render so
 *      a single broken component cannot blank the whole app.
 *   2. I18nProvider — async-loads /api/i18n/{lang} and exposes
 *      ``t / lang / setLang`` to every descendant.
 *   3. useTheme — owns the data-theme attribute on
 *      ``document.documentElement``, persists choice to
 *      localStorage.
 *
 * Routes match the project-reference §8 table:
 *
 *   /            -> Landing
 *   /onboarding  -> Onboarding (create user + project)
 *   /assessment  -> Assessment (12-question test)
 *   /dashboard   -> Dashboard
 *   /session     -> Session
 *   /progress    -> Progress
 *   /settings    -> Settings
 *
 * Navigation surfaces on every route EXCEPT the pre-onboarding
 * funnel (Landing / Onboarding / Assessment) so the entry flow
 * stays focused.
 */
export default function App() {
    useTheme();

    // Phase 37 — error-report dialog state, opened via custom
    // event dispatched from the "Report Issue" button inside the
    // error toast (``utils/notify.ts``).
    const [errorReport, setErrorReport] = useState<{
        open: boolean;
        message: string;
        apiError?: ApiError;
    }>({open: false, message: ""});

    const handleOpenReport = useCallback((e: Event) => {
        const detail = (e as CustomEvent).detail as {
            message: string;
            apiError?: ApiError;
        };
        setErrorReport({
            open: true,
            message: detail.message,
            apiError: detail.apiError,
        });
    }, []);

    useEffect(() => {
        window.addEventListener(
            "adaptive-learner:open-error-report",
            handleOpenReport,
        );
        return () =>
            window.removeEventListener(
                "adaptive-learner:open-error-report",
                handleOpenReport,
            );
    }, [handleOpenReport]);

    return (
        <ErrorBoundary>
            <I18nProvider>
                <HelpProvider>
                <SkipToContent />
                <Navigation />
                <Suspense fallback={null}>
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/onboarding" element={<Onboarding />} />
                        <Route path="/assessment" element={<Assessment />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/session" element={<Session />} />
                        <Route path="/curriculum" element={<Curriculum />} />
                        <Route path="/progress" element={<Progress />} />
                        <Route path="/import" element={<Import />} />
                        <Route
                            path="/import/:conversationId"
                            element={<ImportDetail />}
                        />
                        <Route path="/anki" element={<AnkiPage />} />
                        <Route path="/content" element={<ContentPage />} />
                        <Route
                            path="/lesson/:setSlug/:setId/:filename"
                            element={<LessonPage />}
                        />
                        <Route
                            path="/projects/:projectId/learning-repo"
                            element={<LearningRepoPage />}
                        />
                        <Route
                            path="/pronunciation"
                            element={<Pronunciation />}
                        />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
                <InstallPrompt />
                <Suspense fallback={null}>
                    <EventRecorderSetup />
                </Suspense>
                <HelpDrawer />
                {errorReport.open && (
                    <Suspense fallback={null}>
                        <ErrorReportDialog
                            open={errorReport.open}
                            onClose={() =>
                                setErrorReport({open: false, message: ""})
                            }
                            errorMessage={errorReport.message}
                            apiError={errorReport.apiError}
                        />
                    </Suspense>
                )}
                <ToastContainer
                    position="bottom-right"
                    autoClose={5000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    pauseOnHover
                    theme="colored"
                />
                </HelpProvider>
            </I18nProvider>
        </ErrorBoundary>
    );
}
