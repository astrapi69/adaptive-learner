/**
 * Tests for useFeatureAvailable (#911): active features report available with
 * no tooltip; disabled features report unavailable with the localized reason.
 */

import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { useFeatureAvailable } from "./useFeatureAvailable";
import { FEATURES } from "./featureConfig";
import { TestFeatureProvider } from "./testFeatureProvider";
import { I18nProvider } from "../hooks/ui/useI18n";
import type { FeatureContext } from "./featureConfig";

function wrapper(context?: Partial<FeatureContext>) {
  return ({ children }: { children: ReactNode }) => (
    <I18nProvider>
      <TestFeatureProvider context={context}>{children}</TestFeatureProvider>
    </I18nProvider>
  );
}

describe("useFeatureAvailable", () => {
  it("reports available + no tooltip when the feature is active", () => {
    const { result } = renderHook(
      () => useFeatureAvailable(FEATURES.ANKI_EXTRACT),
      { wrapper: wrapper({ mode: "api", hasAiKey: true }) },
    );
    expect(result.current.available).toBe(true);
    expect(result.current.tooltip).toBeUndefined();
    expect(result.current.reason).toBeUndefined();
  });

  it("reports unavailable + api_key_required tooltip in Dexie mode without a key", () => {
    const { result } = renderHook(
      () => useFeatureAvailable(FEATURES.ANKI_EXTRACT),
      { wrapper: wrapper({ mode: "dexie", hasAiKey: false }) },
    );
    expect(result.current.available).toBe(false);
    expect(result.current.reason).toBe("api_key_required");
    expect(result.current.tooltip).toMatch(/API key/i);
  });

  it("reports the desktop_only reason for a desktop-only feature in Dexie mode", () => {
    const { result } = renderHook(() => useFeatureAvailable(FEATURES.SYNC), {
      wrapper: wrapper({ mode: "dexie", hasAiKey: true }),
    });
    expect(result.current.available).toBe(false);
    expect(result.current.reason).toBe("desktop_only");
    expect(result.current.tooltip).toMatch(/desktop/i);
  });
});
