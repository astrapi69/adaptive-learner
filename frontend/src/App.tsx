import {Routes, Route} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import ErrorBoundary from "./components/ErrorBoundary";
import Navigation from "./components/Navigation";
import {I18nProvider} from "./hooks/useI18n";
import {useTheme} from "./hooks/useTheme";
import Assessment from "./pages/Assessment";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Progress from "./pages/Progress";
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

    return (
        <ErrorBoundary>
            <I18nProvider>
                <Navigation />
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/assessment" element={<Assessment />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/session" element={<Session />} />
                    <Route path="/progress" element={<Progress />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
                <ToastContainer
                    position="bottom-right"
                    autoClose={5000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    pauseOnHover
                    theme="colored"
                />
            </I18nProvider>
        </ErrorBoundary>
    );
}
