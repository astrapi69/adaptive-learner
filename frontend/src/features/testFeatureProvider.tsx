/**
 * Test-only wrapper that mounts the real {@link featureRegistry} inside a
 * ``FeatureProvider`` so components consuming ``useFeature`` / ``<Feature>``
 * can be rendered in isolation (``useFeature`` throws outside a provider).
 *
 * The context defaults to ``{mode: "api", hasAiKey: true}`` — i.e. every
 * feature resolves to ``active`` — so existing render-only tests need no
 * gating-specific setup. Tests that exercise a gated state pass an explicit
 * context, e.g. ``<TestFeatureProvider context={{mode: "dexie", hasAiKey:
 * false}}>`` to drive AI features ``disabled`` and desktop features
 * ``hidden``.
 */

import { FeatureProvider } from "@astrapi69/feature-strategy-react";
import { useMemo, type ReactNode } from "react";

import { featureRegistry, type FeatureContext } from "./featureConfig";
import { useApiKeyStatus } from "../hooks/settings/useApiKeyStatus";
import { resolveStorageMode } from "../storage";

interface TestFeatureProviderProps {
  /** Subtree under test. */
  children: ReactNode;
  /** Partial override of the evaluation context (merged over the active default). */
  context?: Partial<FeatureContext>;
}

/** Default context: API mode with a key — every feature is ``active``. */
const DEFAULT_CONTEXT: FeatureContext = { mode: "api", hasAiKey: true };

export function TestFeatureProvider({ children, context }: TestFeatureProviderProps) {
  const merged: FeatureContext = { ...DEFAULT_CONTEXT, ...context };
  return (
    <FeatureProvider registry={featureRegistry} context={merged}>
      {children}
    </FeatureProvider>
  );
}

/**
 * Provider that derives its context from the real ``useApiKeyStatus`` +
 * ``resolveStorageMode`` exactly like the production ``App`` root. Use this
 * for tests that drive key state through seeded storage / mocked settings
 * (e.g. the dexie-mode page tests) so the gate reacts to the same async
 * key-readiness signal the app uses.
 */
export function DerivedFeatureProvider({ children }: { children: ReactNode }) {
  const apiKeyStatus = useApiKeyStatus();
  const mode = resolveStorageMode();
  const context = useMemo<FeatureContext>(
    () => ({ mode, hasAiKey: apiKeyStatus.ready && apiKeyStatus.hasKey }),
    [mode, apiKeyStatus.ready, apiKeyStatus.hasKey],
  );
  return (
    <FeatureProvider registry={featureRegistry} context={context}>
      {children}
    </FeatureProvider>
  );
}
