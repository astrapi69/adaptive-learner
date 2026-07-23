/**
 * Dexie-mode Learning-Repository namespace (#1786 — extracted from
 * dexie-storage.ts).
 *
 * Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
 * Learning Repository render + ZIP in Dexie mode.
 * ``render`` calls the TS renderer (Phase 49B-D) against
 * a context built from the IndexedDB tables; ``exportZip``
 * packs the same rendered tree into a Blob via JSZip
 * (dynamic-imported so the ~190 kB JSZip chunk isn't paid
 * on cold load — same pattern as ``lib/anki/apkg-builder.ts``).
 *
 * The git-persist endpoint is intentionally absent: it
 * needs a server-side filesystem + git binary. The
 * LearningRepo page gates the "Persist to git" button on
 * storage mode and shows a tooltip in Dexie.
 */

import { nowIso } from "../dexie/db";
import type { IStorageService } from "../types";

export const dexieLearningRepo: IStorageService["learningRepo"] = {
  render: async (projectId: string, language?: string) => {
    const renderedAt = nowIso();
    const lang = language ?? "en";
    const { loadDexieContext } =
      await import("../../lib/learning-repo/load-context-dexie");
    const { renderRepository } =
      await import("../../lib/learning-repo/renderer");
    const ctx = await loadDexieContext(projectId, {
      renderedAt,
    });
    const files = await renderRepository(ctx, lang);
    return {
      project_id: projectId,
      language: lang,
      rendered_at: renderedAt,
      files,
    };
  },
  exportZip: async (projectId: string, language?: string) => {
    const lang = language ?? "en";
    const { loadDexieContext } =
      await import("../../lib/learning-repo/load-context-dexie");
    const { renderRepository } =
      await import("../../lib/learning-repo/renderer");
    const ctx = await loadDexieContext(projectId);
    const files = await renderRepository(ctx, lang);
    const JSZipMod = (await import("jszip")).default;
    const zip = new JSZipMod();
    for (const [path, content] of Object.entries(files)) {
      zip.file(path, content);
    }
    return zip.generateAsync({ type: "blob" });
  },
};
