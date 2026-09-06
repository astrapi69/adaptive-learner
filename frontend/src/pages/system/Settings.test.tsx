// The Dexie-mode regression test (issue #51) drives the storage-row-count
// effect down the Dexie branch, which opens IndexedDB. Provide an
// in-memory implementation so it resolves instead of throwing.
import "fake-indexeddb/auto";

import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "./Settings";
import { TestFeatureProvider } from "../../features/testFeatureProvider";
import { AiKeyVaultProvider } from "../../components/settings/ai/AiKeyVaultProvider";
import type { UserSettings } from "../../types";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => mockNavigate };
});

const apiGet = vi.fn();
const apiUpdate = vi.fn();
const apiUsersGet = vi.fn();
const apiUsersUpdate = vi.fn();
const apiSetKey = vi.fn();
const apiDeleteKey = vi.fn();
const apiTestKey = vi.fn();
const apiBackupKey = vi.fn();
const apiGetBackup = vi.fn();
const apiRestoreBackup = vi.fn();
const apiAvailableModels = vi.fn(async (..._args: unknown[]) => [] as unknown[]);
vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../api/client")>("../../api/client");
  return {
    ...actual,
    api: {
      ...actual.api,
      users: {
        ...actual.api.users,
        get: (...args: unknown[]) => apiUsersGet(...args),
        update: (...args: unknown[]) => apiUsersUpdate(...args),
      },
      settings: {
        ...actual.api.settings,
        get: (...args: unknown[]) => apiGet(...args),
        update: (...args: unknown[]) => apiUpdate(...args),
        setApiKey: (...args: unknown[]) => apiSetKey(...args),
        deleteApiKey: (...args: unknown[]) => apiDeleteKey(...args),
        // ModelPicker fetches the provider model list on mount; mock it so the
        // settings page makes no real network connection in the unit run.
        getAvailableModels: (...args: unknown[]) => apiAvailableModels(...args),
        testApiKey: (...args: unknown[]) => apiTestKey(...args),
        backupApiKey: (...args: unknown[]) => apiBackupKey(...args),
        getApiKeyBackup: (...args: unknown[]) => apiGetBackup(...args),
        restoreApiKeyBackup: (...args: unknown[]) => apiRestoreBackup(...args),
      },
    },
  };
});

// Issue #51 — drive resolveStorageMode() without touching the real
// storage factory (so the page still loads via the mocked api client).
// Mutated per-test; defaults to "api" so every existing test is
// unaffected.
const storageState = vi.hoisted(() => ({ mode: "api" as "api" | "dexie" }));
vi.mock("../../storage", async () => {
  const actual = await vi.importActual<typeof import("../../storage")>("../../storage");
  return { ...actual, resolveStorageMode: () => storageState.mode };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../../utils/notify", () => ({
  notify: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const BASE: UserSettings = {
  id: "us-1",
  user_id: "u-1",
  language: "de",
  active_provider: "anthropic",
  has_anthropic_key: false,
  has_openai_key: false,
  has_gemini_key: false,
  has_perplexity_key: false,
  model_override_anthropic: null,
  model_override_openai: null,
  model_override_gemini: null,
  model_override_perplexity: null,
          avatar: null,
  key_source_anthropic: "none",
  key_source_openai: "none",
  key_source_gemini: "none",
  key_source_perplexity: "none",
  created_at: "2026-05-18T00:00:00Z",
  updated_at: "2026-05-18T00:00:00Z",
};

function renderSettings(initialEntry = "/settings") {
  return render(
    <TestFeatureProvider context={{ mode: storageState.mode }}>
      <AiKeyVaultProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Settings />
        </MemoryRouter>
      </AiKeyVaultProvider>
    </TestFeatureProvider>,
  );
}

/**
 * The section-root testids of ``ids`` that are present inside ``panel``,
 * in DOM order, de-duplicated (a section root's own testid, not the
 * nested ones it contains). Shared by the tab-order pins (#1451, #1459,
 * #2955) so every pin measures the order the same way.
 */
function sectionRootsInDomOrder(panel: HTMLElement, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return Array.from(panel.querySelectorAll("[data-testid]"))
    .map((el) => el.getAttribute("data-testid"))
    .filter((id): id is string => id !== null && ids.includes(id))
    .filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
}

/**
 * happy-dom exposes neither Web Speech API side, so the Voice card (and
 * since #2956 its whole cluster) is absent by default. Define a minimal
 * ``window.speechSynthesis`` so ``isSpeechSynthesisSupported()`` reports
 * true; ``getVoices`` returns one voice so ``loadVoices()`` resolves at
 * once instead of arming its 2 s ``voiceschanged`` timeout. Paired with
 * {@link unstubSpeechSynthesis} in ``afterEach``.
 */
function stubSpeechSynthesis(): void {
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    writable: true,
    value: {
      getVoices: () => [{ name: "Test Voice", lang: "de-DE" }],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      speak: () => undefined,
      cancel: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      speaking: false,
      pending: false,
    },
  });
}

function unstubSpeechSynthesis(): void {
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
}

describe("Settings page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    apiGet.mockReset();
    apiUpdate.mockReset();
    apiUsersGet.mockReset();
    apiUsersUpdate.mockReset();
    // #579 — the active learner the profile section edits.
    apiUsersGet.mockResolvedValue({ id: "u-1", name: "Ada Lovelace", language: "de" });
    apiUsersUpdate.mockImplementation((_id: string, body: { name?: string }) =>
      Promise.resolve({ id: "u-1", name: body.name ?? "Ada Lovelace", language: "de" }),
    );
    apiSetKey.mockReset();
    apiDeleteKey.mockReset();
    apiTestKey.mockReset();
    apiBackupKey.mockReset();
    apiGetBackup.mockReset();
    apiRestoreBackup.mockReset();
    // C4 defaults: a key tests OK and a backup roundtrips. Tests that
    // exercise the failure path override apiTestKey per-test.
    apiTestKey.mockResolvedValue({ success: true, kind: "ok" });
    apiBackupKey.mockResolvedValue(BASE);
    apiGetBackup.mockResolvedValue({ has: false, tested_at: null });
    apiRestoreBackup.mockResolvedValue(BASE);
    toastSuccess.mockReset();
    toastError.mockReset();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u-1");
    storageState.mode = "api";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    unstubSpeechSynthesis();
  });

  // #335 (supersedes #51) — Sync needs a reachable backend; in Dexie
  // mode (GitHub Pages / PWA-only, no backend) the controls are
  // replaced by a visible desktop-only notice, never hidden.
  it("renders the Sync section in the Data tab when a backend is available (API mode)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-sync")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-sync-desktop-only")).not.toBeInTheDocument();
  });

  it("replaces the Sync controls with a desktop-only notice in Dexie mode", async () => {
    storageState.mode = "dexie";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    // The Data panel still renders (Backup stays available)...
    expect(screen.getByTestId("settings-panel-data")).toBeVisible();
    expect(screen.getByTestId("settings-backup")).toBeInTheDocument();
    // ...the Sync controls are gone, but the section header stays
    // visible with the desktop-only notice (#335: disabled, not hidden).
    expect(screen.queryByTestId("settings-sync")).not.toBeInTheDocument();
    const notice = screen.getByTestId("settings-sync-desktop-only");
    expect(notice).toBeVisible();
    expect(notice).toHaveTextContent("Sync");
  });

  // #1451 — the Data tab sections follow a FIXED causal order:
  // source (content repos) -> sync -> what results (cache, and the
  // max lesson size that shapes the offline lessons landing in it,
  // #2955) -> securing (backup/export) -> retention policy + reversible
  // cleanup (paused retention, orphaned data, #2955) -> irreversible
  // danger zone LAST. Pinned by relative DOM order so a future edit
  // cannot silently regress it (e.g. put the danger zone above Sync).
  // "Install app" moved to the General tab in #1455 (it configures HOW
  // the app runs, not WHAT it stores).
  it("orders the Data-tab sections causally (content repos first, danger zone last) (#1451)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    const panel = screen.getByTestId("settings-panel-data");
    // Section-root testids in their intended causal order.
    const CAUSAL_ORDER = [
      "content-repo-section",
      "settings-sync",
      "settings-section-cache",
      "settings-section-max-lesson-size",
      "settings-backup",
      "key-vault-section",
      "export-section",
      "settings-section-paused-retention",
      "settings-section-orphaned",
      "settings-danger-zone",
    ];
    const domOrder = sectionRootsInDomOrder(panel, CAUSAL_ORDER);
    const expected = CAUSAL_ORDER.filter((id) => domOrder.includes(id));
    expect(domOrder).toEqual(expected);
    // Headline invariants (causality + safety).
    expect(domOrder[0]).toBe("content-repo-section");
    expect(domOrder[domOrder.length - 1]).toBe("settings-danger-zone");
    expect(domOrder.indexOf("content-repo-section")).toBeLessThan(
      domOrder.indexOf("settings-sync"),
    );
  });

  // #2955 — the two rare-housekeeping cards moved from the Learning tab
  // to the Data tab (the move #1459 parked). Max lesson size governs how
  // a saved chat analysis is split into offline lessons (its only reader
  // is SaveOfflineLessonModal), so it sits DIRECTLY after the offline
  // cache (slot 3b); paused-lesson retention is a retention policy, so it
  // sits DIRECTLY before the orphaned-data cleanup (slot 5a). Both are
  // gone from the Learning tab.
  it("hosts max lesson size after the cache and paused retention before orphaned data (#2955)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    const panel = screen.getByTestId("settings-panel-data");
    const SECTION_ROOTS = [
      "content-repo-section",
      "settings-sync",
      "settings-section-cache",
      "settings-section-max-lesson-size",
      "settings-backup",
      "key-vault-section",
      "export-section",
      "settings-section-paused-retention",
      "settings-section-orphaned",
      "settings-danger-zone",
    ];
    const domOrder = sectionRootsInDomOrder(panel, SECTION_ROOTS);
    expect(domOrder).toContain("settings-section-max-lesson-size");
    expect(domOrder).toContain("settings-section-paused-retention");
    expect(domOrder.indexOf("settings-section-max-lesson-size")).toBe(
      domOrder.indexOf("settings-section-cache") + 1,
    );
    // The orphaned card only mounts when there IS orphaned data (none in
    // this fixture), so pin the slot rather than the neighbour: after the
    // last securing card, and nothing but the cleanup card (when present)
    // and the danger zone may follow paused retention.
    const pausedIdx = domOrder.indexOf("settings-section-paused-retention");
    expect(pausedIdx).toBeGreaterThan(domOrder.indexOf("export-section"));
    expect(domOrder.slice(pausedIdx + 1)).toEqual(
      ["settings-section-orphaned", "settings-danger-zone"].filter((id) =>
        domOrder.includes(id),
      ),
    );
    const learning = screen.getByTestId("settings-panel-learning");
    expect(
      learning.querySelector('[data-testid="settings-section-max-lesson-size"]'),
    ).toBeNull();
    expect(
      learning.querySelector('[data-testid="settings-section-paused-retention"]'),
    ).toBeNull();
  });

  // #1459 — the Learning tab sections follow a FIXED causal order
  // (same principle as the #1451 Data-tab pin): foundation (profile,
  // source languages) -> in-lesson flow (mode, hints, interaction
  // toggles, direction, matching effect, voice) -> practice &
  // follow-up (review with the SRS schedule inside it, summary, retry
  // scope) -> motivation (game mode, feedback, missions) -> reminders,
  // and since #2962 the gamification card LAST (moved in from the
  // Plugins tab, behind a separator because it holds Reset progress).
  // #2956 grouped these into five clusters and made ONE relative
  // change: hints + interaction now precede direction + matching. The
  // rare-housekeeping pair #1459 parked at the end (paused retention,
  // max lesson size) lives on the Data tab since #2955. Pinned by
  // relative DOM order so a future edit cannot silently regress it.
  it("orders the Learning-tab sections causally (profile first, gamification last) (#1459)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    const panel = screen.getByTestId("settings-panel-learning");
    // Section-root testids in their intended causal order.
    const CAUSAL_ORDER = [
      "settings-section-learning-profile",
      "settings-section-source-languages",
      "settings-section-lesson-mode",
      "settings-section-hints",
      "settings-section-interaction",
      "settings-section-direction-strategy",
      "settings-section-matching-resolve",
      "settings-section-voice",
      "settings-section-review",
      "settings-section-srs",
      "settings-section-summary-sections",
      "settings-section-error-replay-scope",
      "settings-section-playful",
      "settings-section-feedback",
      "settings-section-missions",
      "settings-section-reminders",
      "settings-section-gamification",
    ];
    const domOrder = sectionRootsInDomOrder(panel, CAUSAL_ORDER);
    // Voice hides itself when the environment supports neither TTS nor
    // STT (happy-dom does not), so compare against the present subset —
    // but require every other section explicitly, so a silently dropped
    // section cannot make the relative-order assertion vacuously pass.
    const ALWAYS_PRESENT = CAUSAL_ORDER.filter((id) => id !== "settings-section-voice");
    ALWAYS_PRESENT.forEach((id) => expect(domOrder).toContain(id));
    expect(domOrder).toEqual(CAUSAL_ORDER.filter((id) => domOrder.includes(id)));
    // Headline invariants: the in-lesson interaction toggles sit with
    // the lesson-flow block (before Review), review and SRS are
    // adjacent, reminders close the routine block (#2955) and the
    // gamification card is the last card of the tab (#2962).
    expect(domOrder.indexOf("settings-section-interaction")).toBeLessThan(
      domOrder.indexOf("settings-section-review"),
    );
    expect(domOrder.indexOf("settings-section-srs")).toBe(
      domOrder.indexOf("settings-section-review") + 1,
    );
    expect(domOrder[domOrder.length - 2]).toBe("settings-section-reminders");
    expect(domOrder[domOrder.length - 1]).toBe("settings-section-gamification");
  });

  // #2956 — the Learning tab groups its 16 cards into five labelled
  // clusters (basics / lessons / voice / review / motivation), each a
  // ``<section aria-labelledby>`` landmark with a ``settings-cluster-<id>``
  // testid. Membership AND in-cluster order are pinned per cluster, and
  // the cluster roots themselves follow the tab order. The single
  // relative reorder vs #1459 lives inside the lessons cluster: hints +
  // interaction now precede direction + matching (frequency-first).
  it("places every Learning section inside its cluster (#2956)", async () => {
    stubSpeechSynthesis();
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    const panel = screen.getByTestId("settings-panel-learning");
    const CLUSTER_MEMBERSHIP: Record<string, readonly string[]> = {
      "settings-cluster-basics": [
        "settings-section-learning-profile",
        "settings-section-source-languages",
      ],
      "settings-cluster-lessons": [
        "settings-section-lesson-mode",
        "settings-section-hints",
        "settings-section-interaction",
        "settings-section-direction-strategy",
        "settings-section-matching-resolve",
      ],
      "settings-cluster-voice": ["settings-section-voice"],
      "settings-cluster-review": [
        "settings-section-review",
        "settings-section-srs",
        "settings-section-summary-sections",
        "settings-section-error-replay-scope",
      ],
      "settings-cluster-motivation": [
        "settings-section-playful",
        "settings-section-feedback",
        "settings-section-missions",
        "settings-section-reminders",
        "settings-section-gamification",
      ],
    };
    expect(Object.values(CLUSTER_MEMBERSHIP).flat()).toHaveLength(17);
    const clusterIds = Object.keys(CLUSTER_MEMBERSHIP);
    expect(sectionRootsInDomOrder(panel, clusterIds)).toEqual(clusterIds);
    for (const [clusterId, sectionIds] of Object.entries(CLUSTER_MEMBERSHIP)) {
      const cluster = within(panel).getByTestId(clusterId);
      expect(cluster.tagName).toBe("SECTION");
      // Every card inside carries its own <h2>, so resolve the cluster's
      // heading through the aria-labelledby id rather than by role.
      const headingId = cluster.getAttribute("aria-labelledby");
      expect(headingId).toBeTruthy();
      const heading = document.getElementById(headingId!);
      expect(heading?.tagName).toBe("H2");
      expect(cluster.contains(heading)).toBe(true);
      sectionIds.forEach((id) => within(cluster).getByTestId(id));
      expect(sectionRootsInDomOrder(cluster, sectionIds)).toEqual(sectionIds);
    }
  });

  // #2962 — Gamification (XP / badge toasts, weekend mode, daily goal,
  // Reset progress) leaves the Plugins tab and becomes the LAST card of
  // the motivation cluster, behind a separator because it carries the
  // destructive reset. Its testids are unchanged; the Plugins tab keeps
  // the Learning-Repository card only.
  it("hosts Gamification as the last motivation card, behind a separator, not on Plugins (#2962)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    expect(screen.getAllByTestId("settings-section-gamification")).toHaveLength(1);
    const gamification = screen.getByTestId("settings-section-gamification");
    expect(screen.getByTestId("settings-panel-plugins").contains(gamification)).toBe(false);
    const motivation = within(screen.getByTestId("settings-panel-learning")).getByTestId(
      "settings-cluster-motivation",
    );
    expect(motivation.contains(gamification)).toBe(true);
    expect(gamification).toBeVisible();
    const separator = screen.getByTestId("settings-gamification-separator");
    expect(separator).toHaveClass("mt-8", "border-t-2", "border-border", "pt-8");
    expect(separator.contains(gamification)).toBe(true);
    expect(motivation.lastElementChild).toBe(separator);
    expect(within(motivation).getByTestId("settings-section-reminders").compareDocumentPosition(gamification) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The Plugins tab still exists and still carries the Learning-Repository card.
    fireEvent.click(screen.getByTestId("settings-tab-plugins"));
    expect(screen.getByTestId("settings-panel-plugins")).toBeVisible();
    expect(screen.getByTestId("settings-section-gamification")).not.toBeVisible();
  });

  // #2956 — the read-only SRS schedule has no input of its own, so it is
  // no longer a card between two "Review" headings but the LAST block
  // inside the Review card. Its testids (``settings-section-srs``,
  // ``srs-schedule``, ``srs-methodology-link``) are unchanged.
  it("nests the SRS schedule inside the Review card (#2956)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    const review = within(screen.getByTestId("settings-panel-learning")).getByTestId(
      "settings-section-review",
    );
    const srs = within(review).getByTestId("settings-section-srs");
    within(srs).getByTestId("srs-schedule");
    within(srs).getByTestId("srs-methodology-link");
    expect(review.lastElementChild).toBe(srs);
    expect(screen.getAllByTestId("settings-section-srs")).toHaveLength(1);
  });

  // #2956 — the voice cluster is rendered only when the browser exposes
  // at least one Web Speech API side (the same guard the Voice card uses
  // inside), so an unsupported browser never shows a heading over
  // nothing. happy-dom supports neither; stubbing ``window.speechSynthesis``
  // brings the cluster (and the card inside it) back, between lessons and
  // review.
  it("omits the voice cluster without speech support and shows it with window.speechSynthesis stubbed (#2956)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    const unsupported = renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-cluster-review")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-cluster-voice")).toBeNull();
    expect(screen.queryByTestId("settings-section-voice")).toBeNull();
    unsupported.unmount();

    stubSpeechSynthesis();
    renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    const panel = screen.getByTestId("settings-panel-learning");
    const voice = within(panel).getByTestId("settings-cluster-voice");
    within(voice).getByTestId("settings-section-voice");
    expect(
      sectionRootsInDomOrder(panel, [
        "settings-cluster-lessons",
        "settings-cluster-voice",
        "settings-cluster-review",
      ]),
    ).toEqual(["settings-cluster-lessons", "settings-cluster-voice", "settings-cluster-review"]);
  });

  // #1484 — the General + AI tabs wrap their sections in a
  // .settings-tabpanel container, like every other tab. The wrapper's
  // flex gap is the ONLY source of vertical spacing between cards
  // (.settings-section deliberately has no vertical margin), so the
  // pre-#1484 fragment shape rendered the General/AI cards with no
  // spacing at all.
  it("wraps the General and AI sections in a settings-tabpanel container (#1484)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=general");
    await screen.findByTestId("settings");
    const general = screen.getByTestId("settings-panel-general");
    expect(general.classList.contains("settings-tabpanel")).toBe(true);
    expect(
      general.querySelector('[data-testid="settings-section-profile"]'),
    ).not.toBeNull();
    expect(
      general.querySelector('[data-testid="settings-install-section"]'),
    ).not.toBeNull();
    const ai = screen.getByTestId("settings-panel-ai");
    expect(ai.classList.contains("settings-tabpanel")).toBe(true);
    // The AI panel loads its settings snapshot asynchronously through the
    // package storage adapter; wait for its content before asserting.
    await screen.findByTestId("settings-provider");
    expect(
      ai.querySelector('[data-testid="settings-provider"]'),
    ).not.toBeNull();
  });

  // #1460 — settings-section-profile must stay unique to the General
  // tab's user-profile card. All panels remain mounted (inactive ones
  // hidden), so a second section with the same testid on the Learning
  // tab makes every selector using it ambiguous — the same class as the
  // "prefix testid overmatch" pitfall. The Learning tab's assessment
  // section carries its own testid instead.
  it("keeps settings-section-profile unique to the General panel (#1460)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=general");
    await screen.findByTestId("settings");
    expect(screen.getAllByTestId("settings-section-profile")).toHaveLength(1);
    const general = screen.getByTestId("settings-panel-general");
    expect(
      general.querySelector('[data-testid="settings-section-profile"]'),
    ).not.toBeNull();
    const learning = screen.getByTestId("settings-panel-learning");
    expect(
      learning.querySelector(
        '[data-testid="settings-section-learning-profile"]',
      ),
    ).not.toBeNull();
  });

  // #1455 — "Install app" lives in the GENERAL tab (it configures HOW
  // the app runs: standalone window, homescreen, starts without network),
  // not in Data (WHAT the app stores). The section stays mounted on both
  // tabs' URLs (panels are hidden, not unmounted), so the assertions
  // check containment + visibility, not existence.
  it("hosts the Install-app section in the General tab, not in Data (#1455)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=general");
    await screen.findByTestId("settings");
    const install = screen.getByTestId("settings-install-section");
    // Not a descendant of the Data panel anymore.
    expect(
      screen.getByTestId("settings-panel-data").contains(install),
    ).toBe(false);
    // Visible on the General tab...
    expect(install).toBeVisible();
    // ...hidden when another tab is active.
    fireEvent.click(screen.getByTestId("settings-tab-data"));
    expect(screen.getByTestId("settings-install-section")).not.toBeVisible();
    // The install button keeps its visible-but-disabled behavior at the
    // new mount point (no browser install offer in happy-dom -> disabled).
    fireEvent.click(screen.getByTestId("settings-tab-general"));
    const button = screen.getByTestId(
      "settings-install-button",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("redirects to /onboarding when user_id is missing", async () => {
    localStorage.removeItem("adaptive-learner.user_id");
    renderSettings();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {
        replace: true,
      });
    });
  });

  it("renders the three sections after loading", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-language")).toBeInTheDocument();
    // AI panel content loads asynchronously through the package adapter.
    await screen.findByTestId("settings-provider");
    expect(screen.getByTestId("api-key-row-anthropic")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-row-openai")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-row-gemini")).toBeInTheDocument();
  });

  it("renders the tab bar with General active by default", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-general")).toHaveAttribute("aria-current", "page");
    // General panel sections are visible; AI panel is hidden. Wait for the
    // (async-loaded) AI panel content to mount before asserting it is hidden.
    await screen.findByTestId("settings-model-overrides");
    expect(screen.getByTestId("settings-section-ui")).toBeVisible();
    expect(screen.getByTestId("settings-model-overrides")).not.toBeVisible();
  });

  it("switching tabs reveals that tab's panel", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("settings-tab-ai"));
    expect(screen.getByTestId("settings-tab-ai")).toHaveAttribute("aria-current", "page");
    // AI panel content loads asynchronously through the package adapter.
    await screen.findByTestId("settings-model-overrides");
    expect(screen.getByTestId("settings-model-overrides")).toBeVisible();
    // The General Interface section is now hidden.
    expect(screen.getByTestId("settings-section-ui")).not.toBeVisible();
    // Learning panel hosts the feedback section.
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    expect(screen.getByTestId("settings-section-feedback")).toBeVisible();
  });

  it("scopes the Help browser to the Help tab (regression for the leak)", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    // Default General tab: the help browser must NOT be visible.
    expect(screen.getByTestId("settings-help-section")).not.toBeVisible();
    // Another non-help tab keeps it hidden.
    fireEvent.click(screen.getByTestId("settings-tab-ai"));
    expect(screen.getByTestId("settings-help-section")).not.toBeVisible();
    // Only the Help tab reveals it.
    fireEvent.click(screen.getByTestId("settings-tab-help"));
    expect(screen.getByTestId("settings-help-section")).toBeVisible();
  });

  it("splits Help (glossary) and About into separate tabs", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    // Help tab: glossary visible, About panel hidden.
    fireEvent.click(screen.getByTestId("settings-tab-help"));
    expect(screen.getByTestId("settings-help-section")).toBeVisible();
    expect(screen.getByTestId("settings-panel-about")).not.toBeVisible();
    // About tab: About panel visible, glossary hidden.
    fireEvent.click(screen.getByTestId("settings-tab-about"));
    expect(screen.getByTestId("settings-panel-about")).toBeVisible();
    expect(screen.getByTestId("settings-help-section")).not.toBeVisible();
  });

  it("moves the swipe-gesture toggle to the Learning tab", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    // Not on the General tab anymore.
    expect(screen.getByTestId("settings-gestures-toggle")).not.toBeVisible();
    // Visible on the Learning tab.
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    expect(screen.getByTestId("settings-gestures-toggle")).toBeVisible();
  });

  it("opens the tab from the ?tab= URL param (deep link)", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-tab-data")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("settings-panel-data")).toBeVisible();
    // General sections are hidden when a deep link opens another tab.
    expect(screen.getByTestId("settings-section-ui")).not.toBeVisible();
  });

  it("falls back to General for an unknown ?tab= value", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=bogus");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-tab-general")).toHaveAttribute("aria-current", "page");
  });

  it("changing the language calls update + flips i18n provider", async () => {
    apiGet.mockResolvedValue(BASE);
    apiUpdate.mockResolvedValue({ ...BASE, language: "en" });
    renderSettings();
    await screen.findByTestId("settings");
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-language-trigger"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-language-option-en"));
    });
    await waitFor(() => {
      expect(apiUpdate).toHaveBeenCalledWith("u-1", { language: "en" });
    });
    expect(localStorage.getItem("adaptive-learner.language")).toBe("en");
  });


  it("renders an error state when /settings GET fails", async () => {
    const { ApiError } = await import("../../api/client");
    apiGet.mockRejectedValue(new ApiError(500, "DB down"));
    renderSettings();
    await screen.findByTestId("settings-error");
    expect(screen.getByTestId("settings-error").textContent).toContain("DB down");
  });



  it("renders the Phase 10F storage-mode section with both radios", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-storage-mode")).toBeInTheDocument();
    expect(screen.getByTestId("storage-mode-api")).toBeInTheDocument();
    expect(screen.getByTestId("storage-mode-dexie")).toBeInTheDocument();
    expect(screen.getByTestId("storage-mode-warning")).toBeInTheDocument();
  });

  it("api mode is the default selection on a fresh browser", async () => {
    localStorage.removeItem("adaptive-learner.storage_mode");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const apiRadio = screen.getByTestId("storage-mode-api") as HTMLInputElement;
    const dexieRadio = screen.getByTestId("storage-mode-dexie") as HTMLInputElement;
    expect(apiRadio.checked).toBe(true);
    expect(dexieRadio.checked).toBe(false);
  });

  it("clicking the dexie radio persists the choice + toasts a reload reminder", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const dexieRadio = screen.getByTestId("storage-mode-dexie") as HTMLInputElement;
    fireEvent.click(dexieRadio);
    expect(localStorage.getItem("adaptive-learner.storage_mode")).toBe("dexie");
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/Reload/i));
  });

  // --- #579: editable display name in Settings > Profile ----------------
  // Dexie-mode persistence of users.update({name}) is covered by
  // dexie-storage.test.ts; the Settings component uses the same
  // mode-agnostic getStorage().users.update path in both modes.
  it("shows the current display name in the username field", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
  });

  it("edits + saves the name via users.update and updates the avatar initials", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    fireEvent.change(input, { target: { value: "Grace Hopper" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-username-save"));
    });
    await waitFor(() =>
      expect(apiUsersUpdate).toHaveBeenCalledWith("u-1", { name: "Grace Hopper" }),
    );
    // No avatar set -> the InitialsAvatar fallback reflects the new name live.
    await waitFor(() =>
      expect(screen.getByTestId("avatar-preview-initials")).toHaveTextContent("GH"),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("trims whitespace and caps the saved name at 50 chars", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    fireEvent.change(input, { target: { value: "   " + "x".repeat(60) + "   " } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-username-save"));
    });
    await waitFor(() =>
      expect(apiUsersUpdate).toHaveBeenCalledWith("u-1", { name: "x".repeat(50) }),
    );
  });

  it("rejects an empty name: no save, shows an error", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    fireEvent.change(input, { target: { value: "   " } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-username-save"));
    });
    expect(screen.getByTestId("settings-username-error")).toBeInTheDocument();
    expect(apiUsersUpdate).not.toHaveBeenCalled();
  });

  it("fires the profile-updated signal on save (live NavAvatar refresh)", async () => {
    apiGet.mockResolvedValue(BASE);
    const onSignal = vi.fn();
    window.addEventListener("adaptive-learner:profile-updated", onSignal);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    fireEvent.change(input, { target: { value: "Linus" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-username-save"));
    });
    await waitFor(() => expect(onSignal).toHaveBeenCalled());
    window.removeEventListener("adaptive-learner:profile-updated", onSignal);
  });
});

describe("Settings — gesture toggle (Phase 23E)", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    apiGet.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the gesture toggle in the Learning tab", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    // The toggle lives in the Learning panel (moved from General/Interface).
    expect(screen.getByTestId("settings-gestures-toggle")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    expect(screen.getByTestId("settings-gestures-toggle")).toBeVisible();
  });

  it("flipping the toggle persists the new value", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId("settings-gestures-toggle") as HTMLInputElement;
    const initial = toggle.checked;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(!initial);
    expect(localStorage.getItem("adaptive-learner.gestures_enabled")).toBe(String(!initial));
  });

  it("initialises from the persisted value (true)", async () => {
    localStorage.setItem("adaptive-learner.gestures_enabled", "true");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId("settings-gestures-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("initialises from the persisted value (false)", async () => {
    localStorage.setItem("adaptive-learner.gestures_enabled", "false");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId("settings-gestures-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });
});

describe("Settings — Ask AI visibility toggle (#2693)", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    apiGet.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the toggle in the Learning tab, ON by default", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    const toggle = screen.getByTestId(
      "settings-ask-ai-visible-toggle",
    ) as HTMLInputElement;
    expect(toggle).toBeVisible();
    expect(toggle.checked).toBe(true);
  });

  it("flipping the toggle persists the new value", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    const toggle = screen.getByTestId(
      "settings-ask-ai-visible-toggle",
    ) as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(
      localStorage.getItem("adaptive-learner.lesson.ask_ai_visible"),
    ).toBe("false");
  });

  it("initialises from a persisted opt-out", async () => {
    localStorage.setItem("adaptive-learner.lesson.ask_ai_visible", "false");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    const toggle = screen.getByTestId(
      "settings-ask-ai-visible-toggle",
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });
});
