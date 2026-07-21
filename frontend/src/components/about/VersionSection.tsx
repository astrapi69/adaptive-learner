/**
 * VersionSection — app version + build hash + build date (Phase 14B, #1873).
 *
 * A thin adapter over the kit's ``VersionCard``: it maps the app's
 * ``SystemInfo`` payload onto the card's props and picks the update control
 * that fits the storage mode. In API storage mode the payload comes from
 * ``GET /api/system/info``; in Dexie mode the synthetic browser-only payload
 * (see ``DexieStorage.system.info``) supplies ``unknown`` for the fields it
 * cannot determine, which the card renders transparently.
 *
 * The build hash links to the GitHub commit when it resolves to a real
 * short-SHA; the ``unknown`` sentinel renders as plain text. The app's
 * existing ``about-*`` test ids are mapped through so the device-verified
 * E2E selectors keep working.
 */

import { UpdateCheckControl, VersionCard } from "@astrapi69/pwa-update-react";

import type { SystemInfo } from "../../types/domain";
import { resolveStorageMode } from "../../storage";
import DesktopUpdateCheckControl from "./DesktopUpdateCheckControl";

interface Props {
    info: SystemInfo;
    t: (key: string, fallback?: string) => string;
}

export default function VersionSection({ info }: Props) {
    // #840 — Dexie/PWA keeps the service-worker check; API/desktop uses the
    // GitHub Releases check (no service worker exists in desktop mode).
    const isApiMode = resolveStorageMode() === "api";
    return (
        <VersionCard
            testId="about-version-section"
            testIds={{
                version: "about-app-version",
                hash: "about-build-hash",
                hashLink: "about-build-hash-link",
                date: "about-build-date",
            }}
            version={info.app.version}
            buildHash={info.app.build_hash}
            buildDate={info.app.build_date}
            commitUrl={(hash) => `${info.app.repository_url}/commit/${hash}`}
        >
            {isApiMode ? <DesktopUpdateCheckControl /> : <UpdateCheckControl />}
        </VersionCard>
    );
}
