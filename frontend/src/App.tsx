import {useCallback, useEffect, useState} from "react";
import {Routes, Route} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import type {ApiError} from "./api/client";
import ErrorBoundary from "./components/ErrorBoundary";
import ErrorReportDialog from "./components/ErrorReportDialog";
import EventRecorderSetup from "./components/EventRecorderSetup";
import HelpDrawer from "./components/help/HelpDrawer";
import InstallPrompt from "./components/InstallPrompt";
import Navigation from "./components/Navigation";
import {HelpProvider} from "./contexts/HelpContext";
import {I18nProvider} from "./hooks/useI18n";
import {useTheme} from "./hooks/useTheme";
import AnkiPage from "./pages/Anki";
import Assessment from "./pages/Assessment";
import Curriculum from "./pages/Curriculum";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import ImportDetail from "./pages/ImportDetail";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Progress from "./pages/Progress";
import Pronunciation from "./pages/Pronunciation";
import Session from "./pages/Session";
import Settings from "./pages/Settings";

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
                <Navigation />
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
                    <Route path="/pronunciation" element={<Pronunciation />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
                <InstallPrompt />
                <EventRecorderSetup />
                <HelpDrawer />
                <ErrorReportDialog
                    open={errorReport.open}
                    onClose={() =>
                        setErrorReport({open: false, message: ""})
                    }
                    errorMessage={errorReport.message}
                    apiError={errorReport.apiError}
                />
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
