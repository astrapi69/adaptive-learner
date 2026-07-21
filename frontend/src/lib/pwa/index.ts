export { LESSON_CACHE_NAME, clearLessonCache, formatMegabytes, getCacheInfo } from "./cache-info";
export type { CacheInfo } from "./cache-info";
export { canInstall, isStandalone, promptInstall, subscribeInstall } from "./install";
export { lazyWithReload } from "./lazy-route";
export { SYNC_QUEUE_CHANGED_EVENT, clearSyncQueue, enqueueRequest, getSyncQueue, initSyncQueueReplay, replaySyncQueue, syncQueueSize } from "./sync-queue";
export type { SyncQueueItem } from "./sync-queue";
// #1873 — the update mechanism itself now lives in @astrapi69/pwa-update;
// only the app's store binding stays here.
export { CURRENT_BUILD, appUpdateStore, versionJsonUrl } from "./update-store";
