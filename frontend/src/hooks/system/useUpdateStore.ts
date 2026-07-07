/**
 * useUpdateStore — React binding for the shared PWA update store (#1374).
 *
 * A thin ``useSyncExternalStore`` wrapper so any component (the global banner
 * via {@link useAppUpdate}, the About "check for updates" control) reads the
 * SAME snapshot and re-renders together when it changes.
 */

import { useSyncExternalStore } from "react";

import {
  getUpdateSnapshot,
  subscribeUpdateStore,
  type UpdateStoreState,
} from "../../lib/pwa/updateStore";

export function useUpdateStore(): UpdateStoreState {
  return useSyncExternalStore(subscribeUpdateStore, getUpdateSnapshot);
}
