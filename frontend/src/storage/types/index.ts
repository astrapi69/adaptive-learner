/**
 * Storage abstraction layer (Phase 10A).
 *
 * ``IStorageService`` is the implementation-agnostic contract that
 * pages and components consume. Two implementations satisfy it:
 *
 *   - ``ApiStorage`` (10A): delegates to the FastAPI backend via
 *     ``api/client.ts``. Existing behaviour, unchanged.
 *   - ``DexieStorage`` (10B-10E): stores everything in IndexedDB
 *     via Dexie.js, calls AI providers directly from the browser.
 *
 * Pages MUST import from the storage layer (`getStorage()`), not
 * from ``api/client.ts`` directly. The factory in
 * ``storage/index.ts`` picks the right backend based on build-time
 * configuration and runtime preference.
 *
 * The method names mirror the ``api.*`` namespaces 1:1 so that
 * ApiStorage can be a thin pass-through. The argument lists are
 * the same as the existing api/client; the return shapes are the
 * same domain types from ``types/domain.ts``.
 */


export * from "./core/users";
export * from "./core/settings";
export * from "./integrations/github";
export * from "./core/session";
export * from "./content/content";
export * from "./content/lesson-progress";
export * from "./learning/element-errors";
export * from "./learning/learning-data";
export * from "./learning/missions";
export * from "./content/curricula";
export * from "./integrations/learning-repo";
export * from "./core/system";
export * from "./integrations/anki";
export * from "./integrations/notebooklm";
export * from "./learning/pronunciation";
export * from "./learning/gamification";
export * from "./content/imports";
export * from "./core/service";
