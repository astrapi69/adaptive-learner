import {Routes, Route} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {useTheme} from "./hooks/useTheme";
import {I18nProvider} from "./hooks/useI18n";
import Assessment from "./pages/Assessment";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Progress from "./pages/Progress";
import Session from "./pages/Session";
import Settings from "./pages/Settings";

export default function App() {
    useTheme();

    return (
        <I18nProvider>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/assessment" element={<Assessment />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/session" element={<Session />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/settings" element={<Settings />} />
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
    );
}
