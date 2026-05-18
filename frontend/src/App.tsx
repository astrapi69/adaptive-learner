import {Routes, Route} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {useTheme} from "./hooks/useTheme";
import {I18nProvider} from "./hooks/useI18n";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";

export default function App() {
    useTheme();

    return (
        <I18nProvider>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/onboarding" element={<Onboarding />} />
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
