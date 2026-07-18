/**
 * Sync pairing URI (#1795 — extracted from sync-engine.ts).
 *
 * Builds + parses the adaptive-learner://sync?... URI embedded
 * in the desktop QR code and pasted/scanned on the phone.
 */

// ----- Pairing URI ----------------------------------------------------

/**
 * Pairing URI shape: ``adaptive-learner://sync?host=192.168.1.x&port=18001&token=abc``.
 * Embedded in the QR code on the desktop, parsed on the phone.
 */
export interface PairingPayload {
    host: string;
    port: number;
    token: string;
}

export function buildPairingUri(payload: PairingPayload): string {
    const params = new URLSearchParams({
        host: payload.host,
        port: String(payload.port),
        token: payload.token,
    });
    return `adaptive-learner://sync?${params.toString()}`;
}

export function parsePairingUri(uri: string): PairingPayload | null {
    if (typeof uri !== "string" || uri.trim() === "") return null;
    const trimmed = uri.trim();
    let qs: string;
    if (trimmed.startsWith("adaptive-learner://sync?")) {
        qs = trimmed.slice("adaptive-learner://sync?".length);
    } else if (trimmed.startsWith("?")) {
        qs = trimmed.slice(1);
    } else if (trimmed.includes("?")) {
        qs = trimmed.split("?")[1] ?? "";
    } else {
        return null;
    }
    const params = new URLSearchParams(qs);
    const host = params.get("host")?.trim();
    const portRaw = params.get("port")?.trim();
    const token = params.get("token")?.trim();
    if (!host || !portRaw || !token) return null;
    const port = parseInt(portRaw, 10);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
    return {host, port, token};
}
