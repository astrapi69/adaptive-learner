/**
 * Centralized toast notification wrapper.
 *
 * Skeleton state (Phase 1A): minimal `error`/`warning`/`info`/`success`
 * pass-throughs over react-toastify. The Bibliogon-era variants
 * (report-issue link, save-error retry, bulk-action undo, success-action
 * forward) are gone with the components that used them; re-introduce
 * them alongside the new domain handlers when they actually have a
 * use site.
 */

import {toast} from "react-toastify";

interface ErrorOptions {
    /**
     * Phase 36 — when ``true``, the toast does NOT auto-dismiss.
     * The user has to close it manually. Use for failures the user
     * must acknowledge (analysis broken, AI provider down,
     * persistent error states) so the message survives the next
     * keystroke. Default ``false`` keeps the previous 12 s
     * auto-dismiss behaviour.
     */
    persistent?: boolean;
}

export const notify = {
    error: (message: string, opts?: ErrorOptions) =>
        toast.error(message, {
            autoClose: opts?.persistent ? (false as const) : 12000,
        }),
    warning: (message: string) => toast.warning(message, {autoClose: 10000}),
    info: (message: string) => toast.info(message, {autoClose: 8000}),
    success: (message: string) => toast.success(message, {autoClose: 5000}),
};
