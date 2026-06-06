/**
 * useLessonShortcuts (#103).
 *
 * Returns whether the lesson Enter-key shortcut is enabled, re-reading
 * live when the preference changes in this tab (via the
 * ``LESSON_SHORTCUTS_CHANGE_EVENT``) or another tab (native ``storage``
 * event). The lesson player reads this so the Settings toggle takes
 * effect without a reload.
 */

import {useEffect, useState} from "react";

import {
    LESSON_SHORTCUTS_CHANGE_EVENT,
    readLessonShortcutsEnabled,
} from "../lib/lesson/lessonShortcutsPref";

export function useLessonShortcuts(): boolean {
    const [enabled, setEnabled] = useState<boolean>(() =>
        readLessonShortcutsEnabled(),
    );

    useEffect(() => {
        const refresh = () => setEnabled(readLessonShortcutsEnabled());

        window.addEventListener(LESSON_SHORTCUTS_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);

        // Pick up any change between the initial useState and mount.
        refresh();

        return () => {
            window.removeEventListener(LESSON_SHORTCUTS_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);

    return enabled;
}
