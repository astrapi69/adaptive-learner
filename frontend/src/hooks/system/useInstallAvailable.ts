import {useEffect, useState} from "react";

import {canInstall, subscribeInstall} from "../../lib/pwa/install";

/**
 * Reactive "can the app be installed right now?" flag (#604), backed by
 * the {@link canInstall} store. Re-renders when the browser fires
 * ``beforeinstallprompt`` / ``appinstalled``.
 */
export function useInstallAvailable(): boolean {
    const [available, setAvailable] = useState<boolean>(() => canInstall());
    useEffect(() => subscribeInstall(() => setAvailable(canInstall())), []);
    return available;
}
