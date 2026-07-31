/**
 * Modal exit coverage (#2266) — the dialog treated as a COVERAGE question,
 * not a single fix.
 *
 * Requirement: every modal has at least one exit reachable independent of
 * content height. The canonical way to get that is a shell that provides a
 * scrollable body plus an always-visible close, Escape, and a backdrop click
 * ({@link ModalShell}, the Radix/shadcn `ui/dialog`, or {@link ConfirmDialog}) —
 * each of those frames pins its own dismiss paths in its own test. The
 * remaining hand-rolled `.modal-overlay` dialogs are the risk class that
 * produced the #937 and #2266 bugs; they are tracked here as a shrink-only
 * ratchet toward a shell.
 *
 * This test enumerates EVERY modal-bearing component under `src/` and fails
 * when:
 *   1. a modal appears that is not in {@link MODAL_REGISTRY} (a new modal must
 *      be enumerated — "Muster wie bei den Elementmengen");
 *   2. the auto-detected raw `.modal-overlay` set drifts from the entries
 *      classified `raw` (no silent mis-labelling);
 *   3. the raw set grows past {@link RAW_BASELINE} (it may only shrink).
 *
 * It reports the size of the set it scanned, so an empty scan can never read
 * as a clean one (gate contract #2083 point 4).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", ".."); // shared/feedback -> src

/** How a modal obtains its height-independent exits. */
type ExitKind =
  | "shell-frame" // reusable dialog frame in shared/, own dismiss-path test
  | "modalshell" // renders <ModalShell> (exits inherited)
  | "radix" // shadcn / Radix Dialog or Sheet (exits inherited)
  | "confirm" // renders <ConfirmDialog> (exits inherited)
  | "custom" // hand-rolled overlay that itself wires Escape + backdrop
  | "raw"; // hand-rolled `.modal-overlay` — the ratchet / risk class

/**
 * Every modal-bearing component, keyed by its path relative to `src/`.
 * A new modal MUST be added here or the completeness assertion fails.
 * Only `raw` is non-compliant-by-construction; it is the shrink-only set.
 */
const MODAL_REGISTRY: Record<string, ExitKind> = {
  // Reusable frames — each pins X + Escape + backdrop in its own test.
  "shared/feedback/ModalShell.tsx": "shell-frame",
  "shared/feedback/ConfirmDialog.tsx": "shell-frame",
  "shared/feedback/ShortcutHelpDialog.tsx": "shell-frame",
  "shared/feedback/QrCodeModal.tsx": "shell-frame",
  "shared/media/AvatarPreviewDialog.tsx": "shell-frame",
  "shared/media/ImageCropDialog.tsx": "shell-frame",

  // ModalShell consumers.
  "components/content/quality/AiValidationDialog.tsx": "modalshell",
  "components/content/quality/QualityCheckDialog.tsx": "modalshell",
  "components/content/share/ShareAsRepoButton.tsx": "modalshell",
  "components/onboarding/MigrationWelcomeDialog.tsx": "modalshell",
  "components/pwa/DesktopUpdateHost.tsx": "modalshell", // #2266 fix

  // Radix / shadcn Dialog + Sheet consumers.
  "components/badges/BadgeGallery.tsx": "radix",
  "components/content/share/ShareWizard.tsx": "radix",
  "components/help/HelpDrawer.tsx": "radix",
  "components/lesson/dialogs/LessonExitDialog.tsx": "radix",

  // ConfirmDialog consumers (rendered directly or via the provider).
  "components/create-lesson/book/BookFileUpload.tsx": "confirm",
  "components/settings/data/OrphanedDataSection.tsx": "confirm",
  "components/settings/integrations/RemoveRepoDialog.tsx": "confirm",
  "contexts/ConfirmContext.tsx": "confirm",
  "pages/content/Content.tsx": "confirm",

  // Other shell consumers (ShortcutHelpDialog / AvatarPreviewDialog).
  "components/a11y/GlobalShortcuts.tsx": "confirm",
  "shared/media/AvatarUpload.tsx": "confirm",

  // Custom overlays that already wire their own Escape + backdrop/outside
  // click (not the `.modal-overlay` pattern).
  "components/sync/QRScannerModal.tsx": "custom",
  "components/sync/SyncConflictDialog.tsx": "custom",
  "components/nav/NavXpBadge.tsx": "custom",

  // Hand-rolled `.modal-overlay` — the ratchet. Each is tracked for
  // migration to a shell (#2266 follow-up); DesktopUpdateHost left it.
  "components/content/browser/delete/BulkDeleteSetsModal.tsx": "raw",
  "components/content/browser/delete/DeleteSetModal.tsx": "raw",
  "components/content/lessons/CombineLessonsDialog.tsx": "raw",
  "components/content/lessons/DeleteLessonFromSetModal.tsx": "raw",
  "components/content/lessons/DeleteLessonModal.tsx": "raw",
  "components/content/lessons/ImportLessonModal.tsx": "raw",
  "components/content/lessons/SaveOfflineLessonModal.tsx": "raw",
  "components/create-lesson/CardEditor.tsx": "raw",
  "components/create-lesson/CreateLessonDialogs.tsx": "raw",
  "components/import/RegenerateFeedbackDialog.tsx": "raw",
  "components/lesson/dialogs/LessonResumeDialog.tsx": "raw",
  "components/session/RatingDialog.tsx": "raw",
  "components/settings/data/DangerZoneSection.tsx": "raw",
  "components/topic/AddTopicDialog.tsx": "raw",
};

/**
 * The raw `.modal-overlay` set may only shrink. It stood at 15 when #2266
 * fixed the DesktopUpdateHost instance; migrating it to ModalShell drops it
 * to 14. Lower this when the next raw dialog moves to a shell — never raise
 * it: a new modal uses a shell, not the raw pattern.
 */
const RAW_BASELINE = 14;

/** Strip line + block comments so prose mentions never trip detection. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
      acc.push(full);
    }
  }
  return acc;
}

/** The `.modal-overlay` className usage (raw hand-rolled pattern). */
const RAW_CLASS = /className=\{?["'`][^"'`]*\bmodal-overlay\b/;

/** Any marker that makes a file a modal surface. */
const MODAL_MARKERS: RegExp[] = [
  RAW_CLASS,
  /aria-modal/,
  /role="(?:dialog|alertdialog)"/,
  /<(?:ModalShell|ConfirmDialog|AvatarPreviewDialog|ImageCropDialog|ShortcutHelpDialog)\b/,
  /<(?:DialogContent|SheetContent)\b/,
];

interface Scan {
  modals: string[]; // rel paths of every modal-bearing file
  raw: string[]; // rel paths using the `.modal-overlay` class
}

function scan(): Scan {
  const modals: string[] = [];
  const raw: string[] = [];
  for (const file of walk(SRC)) {
    // ModalShell itself only mentions `.modal-overlay` in its docstring.
    const code = stripComments(readFileSync(file, "utf8"));
    if (MODAL_MARKERS.some((rx) => rx.test(code))) {
      const rel = relative(SRC, file).split("\\").join("/");
      modals.push(rel);
      if (RAW_CLASS.test(code)) raw.push(rel);
    }
  }
  return { modals: modals.sort(), raw: raw.sort() };
}

describe("modal exit coverage (#2266)", () => {
  const { modals, raw } = scan();

  it("scanned a non-empty modal set", () => {
    // Fail closed: an empty scan is a broken gate, not a clean tree.
    expect(modals.length).toBeGreaterThanOrEqual(Object.keys(MODAL_REGISTRY).length);
  });

  it("enumerates every modal-bearing component (a new modal must be listed)", () => {
    const registered = new Set(Object.keys(MODAL_REGISTRY));
    const unlisted = modals.filter((m) => !registered.has(m));
    const stale = [...registered].filter((m) => !modals.includes(m));
    expect(
      unlisted,
      `New modal(s) not in MODAL_REGISTRY — add each with its exit kind ` +
        `(build it on ModalShell, not raw .modal-overlay): ${unlisted.join(", ")}`,
    ).toEqual([]);
    expect(
      stale,
      `MODAL_REGISTRY lists file(s) that are no longer modal surfaces: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("labels the raw .modal-overlay set exactly (no silent mislabelling)", () => {
    const declaredRaw = Object.entries(MODAL_REGISTRY)
      .filter(([, kind]) => kind === "raw")
      .map(([file]) => file)
      .sort();
    expect(
      raw,
      `Files using the raw .modal-overlay class must be classified "raw" ` +
        `in MODAL_REGISTRY, and no other entry may be.`,
    ).toEqual(declaredRaw);
  });

  it("ratchets the raw .modal-overlay set down only", () => {
    expect(
      raw.length,
      `Hand-rolled .modal-overlay modals (${raw.length}) exceed the baseline ` +
        `(${RAW_BASELINE}). New modals must use ModalShell / Radix / ConfirmDialog. ` +
        `Migrating a raw modal to a shell lowers the baseline.`,
    ).toBeLessThanOrEqual(RAW_BASELINE);
  });
});
