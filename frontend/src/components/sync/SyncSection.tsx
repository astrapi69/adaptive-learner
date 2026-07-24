/**
 * Sync settings panel (Phase 13B + 13F).
 *
 * Single React component that renders the full sync UX:
 *
 *   - Unpaired state:
 *       In API mode -> "Generate pairing code" produces a QR + a
 *       short ``adaptive-learner://`` link the phone can paste.
 *       In Dexie mode -> "Connect to a desktop" accepts the
 *       pasted link and verifies it against the remote backend.
 *   - Paired state:
 *       Connection card (host, port, user_name, paired_at),
 *       last-sync timestamp, "Sync Now" button, "Unpair" with
 *       a confirmation dialog, and the last 5 sync runs.
 *
 * The actual sync flow lives in ``SyncEngine``. This component
 * is a thin shell that calls into it and surfaces toasts +
 * loading states.
 */

import {lazy, Suspense, useEffect, useRef, useState} from "react";
import QRCode from "qrcode";

import {Button} from "@/components/ui/button";
import {api, ApiError} from "../../api/client";
import {useI18n} from "../../hooks/ui/useI18n";
import {useConfirm} from "../../contexts/ConfirmContext";
import {readLearnerState} from "../../lib/learning/learnerState";
import {resolveStorageMode} from "../../storage";
import {
    buildPairingUri,
    getSyncEngine,
    readLastSyncAt,
    readSyncConfig,
    readSyncHistory,
    type ConflictBundle,
    type ConflictResolution,
    type SyncConfig,
    type SyncHistoryEntry,
} from "../../storage/sync/sync-engine";
import {notify} from "../../utils/notify";
import SyncConflictDialog from "./SyncConflictDialog";
// Phase 61 C4 — lazy-load the QR scanner modal so ``html5-qrcode``
// (~542 KB) is split out of the Settings chunk and only fetched when
// the user actually opens the scanner.
const QRScannerModal = lazy(() => import("./QRScannerModal"));

const DEFAULT_BACKEND_PORT = 18001;

export default function SyncSection() {
    const {t} = useI18n();
    const confirm = useConfirm();
    const storageMode = resolveStorageMode();

    const [config, setConfig] = useState<SyncConfig | null>(readSyncConfig);
    const [lastSync, setLastSync] = useState<string | null>(readLastSyncAt);
    const [history, setHistory] = useState<SyncHistoryEntry[]>(readSyncHistory);
    const [busy, setBusy] = useState<string>("");
    const [pairingLink, setPairingLink] = useState("");
    const [conflicts, setConflicts] = useState<ConflictBundle[] | null>(null);
    const [scannerOpen, setScannerOpen] = useState(false);

    // Refresh persisted state on focus so a sync triggered from
    // another tab is reflected here without remount.
    useEffect(() => {
        function refresh() {
            setConfig(readSyncConfig());
            setLastSync(readLastSyncAt());
            setHistory(readSyncHistory());
        }
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, []);

    function refreshFromStorage() {
        setConfig(readSyncConfig());
        setLastSync(readLastSyncAt());
        setHistory(readSyncHistory());
    }

    async function handleConnectViaLink() {
        if (!pairingLink.trim() || busy) return;
        setBusy("pair");
        try {
            await getSyncEngine().pair(pairingLink.trim());
            refreshFromStorage();
            setPairingLink("");
            notify.success(t("sync.paired"));
        } catch (err) {
            const detail =
                err instanceof ApiError
                    ? err.detail
                    : err instanceof Error
                      ? err.message
                      : t("sync.pair_error");
            notify.error(detail);
        } finally {
            setBusy("");
        }
    }

    /**
     * v1.7.0 / Phase 20B — pair via QR scan. Same verify + pair
     * flow as ``handleConnectViaLink``; the scanned URI is just
     * routed straight into ``getSyncEngine().pair``. The modal
     * stays open until pair() resolves so the user sees the
     * success state inside the scanner overlay, then closes.
     */
    async function handleScannedUri(uri: string) {
        setBusy("pair");
        try {
            await getSyncEngine().pair(uri);
            refreshFromStorage();
            setPairingLink("");
            setScannerOpen(false);
            notify.success(t("sync.paired"));
        } catch (err) {
            const detail =
                err instanceof ApiError
                    ? err.detail
                    : err instanceof Error
                      ? err.message
                      : t("sync.pair_error");
            notify.error(detail);
            // Keep the modal open so the user can retry with a
            // fresh QR from the desktop (the v1.0.0 token has
            // a 5-minute TTL; expired tokens land here).
            setScannerOpen(true);
        } finally {
            setBusy("");
        }
    }

    async function handleSyncNow() {
        if (!config || busy) return;
        setBusy("sync");
        try {
            const outcome = await getSyncEngine().sync(async (incoming) => {
                // Defer to the conflict-resolution dialog; we
                // resolve the engine's await with the user's
                // chosen mapping.
                return await new Promise<ConflictResolution[]>((resolve) => {
                    setConflicts(incoming);
                    pendingResolverRef.current = resolve;
                });
            });
            refreshFromStorage();
            notify.success(`${t("sync.synced")}: ${outcome.summary}`);
        } catch (err) {
            const detail =
                err instanceof ApiError
                    ? err.detail
                    : err instanceof Error
                      ? err.message
                      : t("sync.sync_error");
            notify.error(detail);
        } finally {
            setBusy("");
        }
    }

    async function handleUnpair() {
        const ok = await confirm({
            message: t("sync.unpair_confirm"),
            confirmLabel: t("common.remove", "Remove"),
            variant: "danger",
        });
        if (!ok) return;
        getSyncEngine().unpair();
        refreshFromStorage();
        notify.info(t("sync.unpaired"));
    }

    // Conflict-resolver bridge: we pass a promise resolver into
    // sync()'s callback and complete it when the dialog returns.
    const pendingResolverRef = useRef<
        ((decisions: ConflictResolution[]) => void) | null
    >(null);

    function handleConflictResolved(decisions: ConflictResolution[]) {
        const resolver = pendingResolverRef.current;
        pendingResolverRef.current = null;
        setConflicts(null);
        if (resolver) resolver(decisions);
    }

    function handleConflictCancelled() {
        // Defer all conflicts ("keep local for all") so the
        // engine still records the cycle as "deferred" without
        // mutating server state.
        const decisions: ConflictResolution[] =
            conflicts?.map((c) => ({
                table: c.table,
                id: c.id,
                chosen: "local",
            })) ?? [];
        handleConflictResolved(decisions);
    }

    return (
        <section
            className="settings-section"
            data-testid="settings-sync"
            style={{marginTop: "1.5rem"}}
        >
            <h2 className="settings-section-title">
                {t("settings.section_sync", "Sync")}
            </h2>
            <p className="muted">
                {t("sync.intro")}
            </p>

            {config ? (
                <PairedView
                    config={config}
                    lastSync={lastSync}
                    history={history}
                    busy={busy}
                    storageMode={storageMode}
                    onSyncNow={handleSyncNow}
                    onUnpair={handleUnpair}
                    t={t}
                />
            ) : storageMode === "api" ? (
                <DesktopUnpairedView t={t} />
            ) : (
                <PhoneUnpairedView
                    pairingLink={pairingLink}
                    setPairingLink={setPairingLink}
                    onConnect={handleConnectViaLink}
                    onScanClick={() => setScannerOpen(true)}
                    busy={busy}
                    t={t}
                />
            )}

            {scannerOpen && (
                <Suspense fallback={null}>
                    <QRScannerModal
                        open={scannerOpen}
                        onScan={handleScannedUri}
                        onClose={() => setScannerOpen(false)}
                        t={t}
                    />
                </Suspense>
            )}

            {conflicts !== null && (
                <SyncConflictDialog
                    conflicts={conflicts}
                    onResolve={handleConflictResolved}
                    onCancel={handleConflictCancelled}
                />
            )}
        </section>
    );
}

// ---- Subviews --------------------------------------------------------

function PairedView({
    config,
    lastSync,
    history,
    busy,
    storageMode,
    onSyncNow,
    onUnpair,
    t,
}: {
    config: SyncConfig;
    lastSync: string | null;
    history: SyncHistoryEntry[];
    busy: string;
    storageMode: "api" | "dexie";
    onSyncNow: () => void;
    onUnpair: () => void;
    t: (k: string, fb?: string) => string;
}) {
    return (
        <div data-testid="sync-paired-view">
            <div
                style={{
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "0.75rem 1rem",
                    marginBottom: "0.75rem",
                    background: "var(--surface)",
                }}
            >
                <div style={{fontWeight: 600}}>
                    {t("sync.connected_to")}: {config.user_name}
                </div>
                <small style={{opacity: 0.7}}>
                    {config.host}:{config.port}
                    {" · "}
                    {t("sync.paired_at")}:{" "}
                    {new Date(config.paired_at).toLocaleString()}
                </small>
                <div style={{marginTop: "0.5rem"}}>
                    <small data-testid="sync-last">
                        {t("sync.last_sync")}:{" "}
                        {lastSync
                            ? new Date(lastSync).toLocaleString()
                            : t("sync.never")}
                    </small>
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginTop: "0.75rem",
                        flexWrap: "wrap",
                    }}
                >
                    <Button
                        type="button"
                        variant="default"
                        onClick={onSyncNow}
                        disabled={busy !== ""}
                        data-testid="sync-now-button"
                    >
                        {busy === "sync"
                            ? t("sync.syncing")
                            : t("sync.now")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onUnpair}
                        disabled={busy !== ""}
                        data-testid="sync-unpair-button"
                    >
                        {t("sync.unpair")}
                    </Button>
                </div>
                {storageMode === "api" && (
                    <p
                        className="muted"
                        style={{marginTop: "0.5rem", fontSize: "0.85rem"}}
                    >
                        {t("sync.api_mode_note")}
                    </p>
                )}
            </div>

            {history.length > 0 && (
                <div data-testid="sync-history">
                    <h3 style={{margin: "1rem 0 0.5rem"}}>
                        {t("sync.history")}
                    </h3>
                    <ul style={{listStyle: "none", padding: 0, margin: 0}}>
                        {history.map((h, i) => (
                            <li
                                key={`${h.at}-${i}`}
                                data-testid={`sync-history-${i}`}
                                style={{
                                    borderBottom: "1px solid var(--border)",
                                    padding: "0.4rem 0",
                                    fontSize: "0.9rem",
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        color: h.success
                                            ? "var(--success)"
                                            : "var(--danger)",
                                    }}
                                >
                                    {h.success ? "✓" : "✕"}
                                </span>{" "}
                                <span style={{opacity: 0.7}}>
                                    {new Date(h.at).toLocaleString()}
                                </span>{" "}
                                - {h.summary}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function DesktopUnpairedView({
    t,
}: {
    t: (k: string, fb?: string) => string;
}) {
    const [busy, setBusy] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [link, setLink] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [host, setHost] = useState<string>(window.location.hostname || "localhost");
    const [port, setPort] = useState<number>(DEFAULT_BACKEND_PORT);

    async function generatePairing() {
        const {userId} = readLearnerState();
        if (!userId) {
            notify.error(
                t("sync.no_user"),
            );
            return;
        }
        setBusy(true);
        try {
            // Phase 61 C2 — route through the central api client so a
            // failure surfaces as ApiError (was a raw fetch + bare Error).
            const body = await api.sync.generatePairToken(userId);
            const uri = buildPairingUri({host, port, token: body.token});
            const dataUrl = await QRCode.toDataURL(uri, {
                width: 256,
                margin: 1,
                errorCorrectionLevel: "M",
            });
            setQrDataUrl(dataUrl);
            setLink(uri);
            setExpiresAt(body.expires_at);
        } catch (err) {
            const detail = err instanceof Error ? err.message : "unknown error";
            notify.error(`${t("sync.pair_error")} (${detail})`);
        } finally {
            setBusy(false);
        }
    }

    function copyLink() {
        if (!link) return;
        navigator.clipboard?.writeText(link).then(
            () => notify.success(t("sync.link_copied")),
            () => notify.error(t("sync.copy_error")),
        );
    }

    return (
        <div data-testid="sync-desktop-unpaired">
            <p className="muted">
                {t("sync.desktop_hint")}
            </p>
            <div
                style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    marginBottom: "0.75rem",
                }}
            >
                <label style={{display: "flex", flexDirection: "column"}}>
                    <small style={{opacity: 0.7}}>
                        {t("sync.host")}
                    </small>
                    <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        data-testid="sync-host-input"
                        style={{padding: "0.35rem 0.5rem", minWidth: 180}}
                    />
                </label>
                <label style={{display: "flex", flexDirection: "column"}}>
                    <small style={{opacity: 0.7}}>{t("sync.port")}</small>
                    <input
                        type="number"
                        value={port}
                        onChange={(e) =>
                            setPort(parseInt(e.target.value, 10) || DEFAULT_BACKEND_PORT)
                        }
                        data-testid="sync-port-input"
                        style={{padding: "0.35rem 0.5rem", width: 100}}
                    />
                </label>
                <Button
                    type="button"
                    variant="default"
                    onClick={generatePairing}
                    disabled={busy}
                    data-testid="sync-generate-button"
                >
                    {busy
                        ? t("sync.generating")
                        : t("sync.generate")}
                </Button>
            </div>
            {qrDataUrl && link && (
                <div
                    data-testid="sync-qr-panel"
                    style={{
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "1rem",
                        background: "var(--surface)",
                    }}
                >
                    <div style={{textAlign: "center"}}>
                        <img
                            src={qrDataUrl}
                            alt={t("sync.qr_alt")}
                            data-testid="sync-qr-image"
                            style={{maxWidth: 256, height: "auto"}}
                        />
                    </div>
                    <p
                        style={{
                            marginTop: "0.5rem",
                            fontSize: "0.85rem",
                            wordBreak: "break-all",
                            background: "var(--bg)",
                            padding: "0.5rem",
                            borderRadius: 4,
                        }}
                        data-testid="sync-qr-link"
                    >
                        {link}
                    </p>
                    <div style={{display: "flex", gap: "0.5rem", flexWrap: "wrap"}}>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={copyLink}
                            data-testid="sync-copy-link"
                        >
                            {t("sync.copy_link")}
                        </Button>
                        {expiresAt && (
                            <small
                                style={{
                                    opacity: 0.7,
                                    alignSelf: "center",
                                }}
                            >
                                {t("sync.expires_at")}:{" "}
                                {new Date(expiresAt).toLocaleTimeString()}
                            </small>
                        )}
                    </div>
                    <p
                        className="muted"
                        style={{marginTop: "0.5rem", fontSize: "0.85rem"}}
                    >
                        {t("sync.scan_hint")}
                    </p>
                </div>
            )}
        </div>
    );
}

function PhoneUnpairedView({
    pairingLink,
    setPairingLink,
    onConnect,
    onScanClick,
    busy,
    t,
}: {
    pairingLink: string;
    setPairingLink: (value: string) => void;
    onConnect: () => void;
    onScanClick: () => void;
    busy: string;
    t: (k: string, fb?: string) => string;
}) {
    return (
        <div data-testid="sync-phone-unpaired">
            <p className="muted">
                {t("sync.phone_hint_v17")}
            </p>
            <Button
                type="button"
                variant="default"
                onClick={onScanClick}
                disabled={busy !== ""}
                data-testid="sync-scan-button"
                style={{marginBottom: "0.75rem", width: "100%", maxWidth: 320}}
            >
                {t("sync.scan_qr")}
            </Button>
            <details
                data-testid="sync-paste-fallback"
                style={{marginTop: "0.5rem"}}
            >
                <summary
                    style={{
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        opacity: 0.8,
                        padding: "0.25rem 0",
                    }}
                >
                    {t("sync.paste_link_fallback")}
                </summary>
                <textarea
                    value={pairingLink}
                    onChange={(e) => setPairingLink(e.target.value)}
                    placeholder="adaptive-learner://sync?host=...&port=18001&token=..."
                    rows={2}
                    style={{
                        width: "100%",
                        padding: "0.5rem",
                        marginTop: "0.5rem",
                        fontFamily: "monospace",
                        fontSize: "0.85rem",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        background: "var(--bg)",
                        color: "var(--text)",
                    }}
                    data-testid="sync-pair-input"
                    disabled={busy !== ""}
                />
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onConnect}
                    disabled={!pairingLink.trim() || busy !== ""}
                    data-testid="sync-pair-button"
                    style={{marginTop: "0.5rem"}}
                >
                    {busy === "pair"
                        ? t("sync.pairing")
                        : t("sync.connect")}
                </Button>
            </details>
        </div>
    );
}
