/**
 * Confirm dialog context (#783).
 *
 * Mounts ONE {@link ConfirmDialog} at the App root and exposes a
 * promise-based ``confirm()`` via {@link useConfirm}, so call sites
 * replace the native ``window.confirm`` with a one-line, awaitable
 * call that resolves ``true`` (confirmed) or ``false`` (cancelled /
 * dismissed) — works in components AND hooks:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: t("...") }))) return;
 *
 * Default button labels come from i18n (``common.ok`` /
 * ``common.cancel``) but each call may override them; the title
 * defaults to a localized "Please confirm".
 */

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useRef,
    useState,
} from "react";

import ConfirmDialog, { type ConfirmVariant } from "../shared/ConfirmDialog";
import { useI18n } from "../hooks/useI18n";

export interface ConfirmOptions {
    message: string;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/**
 * No-provider fallback. The real app always mounts {@link
 * ConfirmProvider} (App root), so this only runs in an isolated unit
 * test that renders a consumer without the provider — there it
 * degrades to the native ``window.confirm`` (or auto-confirms in a
 * non-DOM environment) so such tests don't need to wrap every render.
 */
const fallbackConfirm: ConfirmFn = (options) =>
    Promise.resolve(
        typeof window !== "undefined" && typeof window.confirm === "function"
            ? window.confirm(options.message)
            : true,
    );

const ConfirmContext = createContext<ConfirmFn>(fallbackConfirm);

interface PendingState extends ConfirmOptions {
    open: boolean;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const { t } = useI18n();
    const [state, setState] = useState<PendingState>({ open: false, message: "" });
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const settle = useCallback((value: boolean) => {
        resolverRef.current?.(value);
        resolverRef.current = null;
        setState((prev) => ({ ...prev, open: false }));
    }, []);

    const confirm = useCallback<ConfirmFn>((options) => {
        return new Promise<boolean>((resolve) => {
            // A second call while one is open: reject the previous as
            // cancelled before opening the new one.
            resolverRef.current?.(false);
            resolverRef.current = resolve;
            setState({ ...options, open: true });
        });
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <ConfirmDialog
                open={state.open}
                title={state.title ?? t("common.confirm_title", "Please confirm")}
                message={state.message}
                confirmLabel={state.confirmLabel ?? t("common.ok", "OK")}
                cancelLabel={state.cancelLabel ?? t("common.cancel", "Cancel")}
                variant={state.variant ?? "default"}
                onConfirm={() => settle(true)}
                onCancel={() => settle(false)}
            />
        </ConfirmContext.Provider>
    );
}

/**
 * Returns the awaitable ``confirm(options)`` function. Within
 * {@link ConfirmProvider} it opens the app modal; outside it (e.g. a
 * provider-less unit test) it falls back to the native dialog.
 */
export function useConfirm(): ConfirmFn {
    return useContext(ConfirmContext);
}
