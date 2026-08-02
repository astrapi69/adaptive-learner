/**
 * Test-mode context (#2319).
 *
 * Holds the ephemeral, in-memory "test mode" flag for a lesson run. The
 * provider is mounted INSIDE the lesson page, so leaving the lesson unmounts
 * it and the flag resets - nobody keeps learning with test mode silently on.
 * Nothing is persisted, so a reload resets it too.
 *
 * ``available`` comes from the build flag ({@link isTestModeAvailable}); when
 * it is false, ``enable`` is a no-op and ``enabled`` can never become true, so
 * the regular build cannot enter test mode even if the activation gesture
 * fires.
 *
 * The default context value (no provider) is "unavailable + disabled", so
 * every consumer outside a lesson - the other exercise runners, and every
 * renderer unit test - behaves exactly as before.
 */

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import type {ReactNode} from "react";

import {isTestModeAvailable} from "../../../lib/lesson/test-mode";

export interface TestModeContextValue {
    /** The build opted in (``VITE_TEST_MODE``). Off in the regular build. */
    available: boolean;
    /** Test mode is currently active (only ever true when ``available``). */
    enabled: boolean;
    /** Turn test mode on. No-op unless ``available``. */
    enable: () => void;
    /** Turn test mode off. */
    disable: () => void;
}

const DEFAULT_VALUE: TestModeContextValue = {
    available: false,
    enabled: false,
    enable: () => {},
    disable: () => {},
};

export const TestModeContext =
    createContext<TestModeContextValue>(DEFAULT_VALUE);

export function TestModeProvider({children}: {children: ReactNode}) {
    const available = isTestModeAvailable();
    const [enabled, setEnabled] = useState(false);

    const enable = useCallback(() => {
        if (available) setEnabled(true);
    }, [available]);
    const disable = useCallback(() => setEnabled(false), []);

    const value = useMemo<TestModeContextValue>(
        () => ({
            available,
            // Belt and braces: even if enabled got set, it only reads true
            // while the build allows it.
            enabled: available && enabled,
            enable,
            disable,
        }),
        [available, enabled, enable, disable],
    );

    return (
        <TestModeContext.Provider value={value}>
            {children}
        </TestModeContext.Provider>
    );
}

/** Read the current test-mode state. Returns the safe "disabled" default when
 *  no provider is present. */
export function useTestMode(): TestModeContextValue {
    return useContext(TestModeContext);
}
