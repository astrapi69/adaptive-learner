/**
 * Port-change data-loss hint (#2069).
 *
 * IndexedDB and localStorage are origin-bound (scheme + host +
 * port). When the launcher changes the host-facing public port the
 * app moves to a new origin: a Dexie-mode learner then sees an
 * empty app while their sets, progress, and self-authored exercises
 * sit in the previous origin's IndexedDB, unreachable.
 *
 * Positive detection ("your data is at another port") is impossible
 * from within the new origin - the old origin's storage cannot be
 * read, and in Dexie mode there is no backend to leave a
 * cross-origin breadcrumb. So the mitigation is a conditional,
 * non-alarming hint on the empty Landing state that explains the
 * likely cause and the lossless recovery path (back to the old
 * port, export a backup, import it here).
 *
 * This module holds the single pure decision so it is unit-testable
 * in both storage modes without a DOM (rule #2053).
 */

import type {StorageMode} from "../../storage/types";

/** Inputs for the port-change-hint decision. */
export interface PortChangeHintInput {
    /** The active storage mode (``resolveStorageMode()``). */
    mode: StorageMode;
    /** ``window.location.port`` - "" for the default 80/443. */
    port: string;
}

/**
 * Decide whether a port change is plausible enough - and lossy
 * enough - to justify the empty-state hint.
 *
 * Two conditions must both hold:
 *
 *   - **Dexie mode.** API mode keeps its canonical data server-side
 *     and re-seeds the learner pointers from ``identity.yaml`` on
 *     the Landing route (Phase 41B), so it auto-recovers across a
 *     port change and a hint there would mislead.
 *   - **An explicit port** in the URL. The canonical Dexie
 *     deployment (GitHub Pages) is served over https/443 with no
 *     explicit port, so ``window.location.port`` is "" and the port
 *     can never change there; only a self-hosted origin carries a
 *     port and can be re-published on a different one.
 *
 * The caller renders the hint only on the empty Landing state, so
 * this never fires for a learner whose data is present.
 *
 * @param input - Storage mode + current URL port.
 * @returns ``true`` when the conditional hint should be shown.
 */
export function shouldShowPortChangeHint({mode, port}: PortChangeHintInput): boolean {
    if (mode !== "dexie") return false;
    return port.trim() !== "";
}
