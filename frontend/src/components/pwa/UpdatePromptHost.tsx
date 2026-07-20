/**
 * UpdatePromptHost — mounts the kit's update banner (#613, #1873).
 *
 * Mounted once at the app root. Renders nothing until a newer build is
 * detected; then shows the discreet banner with the app's translated copy
 * (supplied by {@link AppUpdateProvider}).
 *
 * This is the Dexie/PWA (service-worker) path; API/desktop mode has no
 * service worker and uses {@link DesktopUpdateHost} (GitHub Releases)
 * instead (#840), so this host stays out of the way in API mode.
 *
 * The iOS-standalone "close the app and reopen it" hint (#1357) is no longer
 * assembled here: the kit's store carries ``needsFullRestart`` and the banner
 * renders the hint itself, so the quirk cannot be lost by a host that forgets
 * about iOS.
 */

import { RefreshCw } from "lucide-react";
import { UpdateBanner } from "@astrapi69/pwa-update-react";

import { resolveStorageMode } from "../../storage";

export default function UpdatePromptHost() {
    // #840 — SW banner is Dexie/PWA only; API/desktop uses DesktopUpdateHost.
    if (resolveStorageMode() === "api") return null;

    return <UpdateBanner icon={<RefreshCw size={16} />} />;
}
