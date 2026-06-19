import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { FeatureProvider } from "@astrapi69/feature-strategy-react";

import { featureRegistry, type FeatureContext } from "./features/featureConfig";
import { useApiKeyStatus } from "./hooks/settings/useApiKeyStatus";
import { resolveStorageMode } from "./storage";
import { lazyWithReload } from "./lib/lazyWithReload";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/toast-theme.css";

import type { ApiError } from "./api/client";
import ErrorBoundary from "./components/ErrorBoundary";
import MilestoneHost from "./components/feedback/MilestoneHost";
import GlobalShortcuts from "./components/GlobalShortcuts";
import UpdatePromptHost from "./components/UpdatePromptHost";
import HelpDrawer from "./components/help/HelpDrawer";
import InstallPrompt from "./components/InstallPrompt";
import ReminderScheduler from "./components/ReminderScheduler";
import Navigation from "./components/Navigation";
import OfflineIndicator from "./components/OfflineIndicator";
import { HelpProvider } from "./contexts/HelpContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { I18nProvider } from "./hooks/ui/useI18n";
import { useTheme } from "./hooks/ui/useTheme";
import { useContentRepoAutoSync } from "./hooks/content/useContentRepoAutoSync";
import Landing from "./pages/onboarding/Landing";
import SkipToContent from "./components/SkipToContent";

// Route-level code-splitting. Landing stays in the main bundle as
// the entry route; everything else loads on first navigation. See
// BUNDLE-SIZE-DYNAMIC-IMPORT-01.
const AnkiPage = lazyWithReload(() => import("./pages/content/Anki"));
const Assessment = lazyWithReload(() => import("./pages/onboarding/Assessment"));
const ContentPage = lazyWithReload(() => import("./pages/content/Content"));
const DiscoverPage = lazyWithReload(() => import("./pages/content/Discover"));
const AddRepo = lazyWithReload(() => import("./pages/content/AddRepo"));
const CreateLesson = lazyWithReload(() => import("./pages/lesson/CreateLesson"));
const LearningPath = lazyWithReload(() => import("./pages/learning-path/LearningPathPersonal"));
const Curriculum = lazyWithReload(() => import("./pages/content/Curriculum"));
const Dashboard = lazyWithReload(() => import("./pages/dashboard/Dashboard"));
const LessonPage = lazyWithReload(() => import("./pages/lesson/Lesson"));
const ReviewPage = lazyWithReload(() => import("./pages/lesson/Review"));
const AdaptiveLessonPage = lazyWithReload(() => import("./pages/lesson/AdaptiveLesson"));
const ErrorReplayLessonPage = lazyWithReload(() => import("./pages/lesson/ErrorReplayLesson"));
const Import = lazyWithReload(() => import("./pages/content/Import"));
const ImportDetail = lazyWithReload(() => import("./pages/content/ImportDetail"));
const LearningRepoPage = lazyWithReload(() => import("./pages/content/LearningRepo"));
const NotFound = lazyWithReload(() => import("./pages/system/NotFound"));
const Onboarding = lazyWithReload(() => import("./pages/onboarding/Onboarding"));
const Progress = lazyWithReload(() => import("./pages/dashboard/Progress"));
const LearningStatistics = lazyWithReload(() => import("./pages/dashboard/LearningStatistics"));
const Pronunciation = lazyWithReload(() => import("./pages/lesson/Pronunciation"));
const Session = lazyWithReload(() => import("./pages/lesson/Session"));
const Settings = lazyWithReload(() => import("./pages/system/Settings"));

// Lazy-loaded so ``eventRecorder`` (statically imported inside both
// components) lands in its own chunk instead of the main bundle.
// See BUNDLE-SIZE-DYNAMIC-IMPORT-01.
const EventRecorderSetup = lazyWithReload(() => import("./components/EventRecorderSetup"));
const ErrorReportDialog = lazyWithReload(() => import("./components/ErrorReportDialog"));

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
  // EXP-023 Phase A — background-sync a connected user content repo on
  // app start when its cache is older than 24h.
  useContentRepoAutoSync();

  // Feature-strategy context: the storage mode is fixed for the session,
  // the AI-key status resolves asynchronously. Memoised so consuming
  // components re-evaluate only when one of the two actually changes.
  const [storageMode] = useState(() => resolveStorageMode());
  const apiKeyStatus = useApiKeyStatus();
  const featureContext = useMemo<FeatureContext>(
    () => ({
      mode: storageMode,
      hasAiKey: apiKeyStatus.ready && apiKeyStatus.hasKey,
    }),
    [storageMode, apiKeyStatus.ready, apiKeyStatus.hasKey],
  );

  // Phase 37 — error-report dialog state, opened via custom
  // event dispatched from the "Report Issue" button inside the
  // error toast (``utils/notify.ts``).
  const [errorReport, setErrorReport] = useState<{
    open: boolean;
    message: string;
    apiError?: ApiError;
    proactive?: boolean;
  }>({ open: false, message: "" });

  const handleOpenReport = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as {
      message: string;
      apiError?: ApiError;
      proactive?: boolean;
    };
    setErrorReport({
      open: true,
      message: detail.message,
      apiError: detail.apiError,
      proactive: detail.proactive,
    });
  }, []);

  useEffect(() => {
    window.addEventListener("adaptive-learner:open-error-report", handleOpenReport);
    return () => window.removeEventListener("adaptive-learner:open-error-report", handleOpenReport);
  }, [handleOpenReport]);

  return (
    <ErrorBoundary>
      <I18nProvider>
        <FeatureProvider registry={featureRegistry} context={featureContext}>
          <HelpProvider>
            <ConfirmProvider>
            <SkipToContent />
            <UpdatePromptHost />
            <Navigation />
            <OfflineIndicator />
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/assessment" element={<Assessment />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/session" element={<Session />} />
                <Route path="/curriculum" element={<Curriculum />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/statistics" element={<LearningStatistics />} />
                <Route path="/import" element={<Import />} />
                <Route path="/import/:conversationId" element={<ImportDetail />} />
                <Route path="/anki" element={<AnkiPage />} />
                <Route path="/content" element={<ContentPage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/add-repo" element={<AddRepo />} />
                <Route path="/learning-path" element={<LearningPath />} />
                <Route path="/create-lesson" element={<CreateLesson />} />
                <Route path="/lesson/:setSlug/:setId/:filename" element={<LessonPage />} />
                <Route path="/review/:setId" element={<ReviewPage />} />
                <Route path="/adaptive-lesson/:setId" element={<AdaptiveLessonPage />} />
                <Route
                  path="/error-replay/:setSlug/:setId/:filename"
                  element={<ErrorReplayLessonPage />}
                />
                <Route path="/projects/:projectId/learning-repo" element={<LearningRepoPage />} />
                <Route path="/pronunciation" element={<Pronunciation />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <InstallPrompt />
            <MilestoneHost />
            <ReminderScheduler />
            <Suspense fallback={null}>
              <EventRecorderSetup />
            </Suspense>
            <HelpDrawer />
            <GlobalShortcuts />
            {errorReport.open && (
              <Suspense fallback={null}>
                <ErrorReportDialog
                  open={errorReport.open}
                  onClose={() => setErrorReport({ open: false, message: "" })}
                  errorMessage={errorReport.message}
                  apiError={errorReport.apiError}
                  proactive={errorReport.proactive}
                />
              </Suspense>
            )}
            <ToastContainer
              position="bottom-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick={false}
              draggable={false}
              pauseOnHover
              theme="colored"
            />
            </ConfirmProvider>
          </HelpProvider>
        </FeatureProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
