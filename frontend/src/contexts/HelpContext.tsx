/**
 * Help drawer context (Phase 38).
 *
 * Mounts once at the App root. Holds the currently-open
 * glossary entry key (or ``null`` when the drawer is closed)
 * + the open/close actions. The HelpTooltip's "Learn more"
 * link calls ``openHelp(key)``; ``HelpDrawer`` consumes the
 * state and renders the article. Decoupled from React Router
 * so the drawer doesn't push browser history entries — it's
 * a transient overlay, not a navigable page.
 */

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

interface HelpContextValue {
    /** Currently-open glossary key. ``null`` when closed. */
    openKey: string | null;
    /** Open the drawer on the given glossary key. */
    openHelp: (key: string) => void;
    /** Close the drawer. */
    closeHelp: () => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({children}: {children: ReactNode}) {
    const [openKey, setOpenKey] = useState<string | null>(null);

    const openHelp = useCallback((key: string) => {
        setOpenKey(key);
    }, []);

    const closeHelp = useCallback(() => {
        setOpenKey(null);
    }, []);

    const value = useMemo<HelpContextValue>(
        () => ({openKey, openHelp, closeHelp}),
        [openKey, openHelp, closeHelp],
    );

    return (
        <HelpContext.Provider value={value}>{children}</HelpContext.Provider>
    );
}

/** Hook to access the help-drawer controls. Falls back to a
 *  no-op shape if used outside the provider so unit tests can
 *  render isolated components without setting up the
 *  provider tree. */
export function useHelp(): HelpContextValue {
    const ctx = useContext(HelpContext);
    if (ctx) return ctx;
    return {
        openKey: null,
        openHelp: () => {
            /* no-op fallback (no provider mounted) */
        },
        closeHelp: () => {
            /* no-op fallback */
        },
    };
}
