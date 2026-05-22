/**
 * Content-hash for duplicate-import detection (Phase 36 Bug 1).
 *
 * Mirrors ``backend/app/services/imports.py:compute_content_hash``
 * exactly so the API path and the Dexie path land the same digest
 * for the same transcript. Title is NOT part of the hash —
 * re-importing the same chat under a different display title still
 * detects as a duplicate.
 *
 * Algorithm:
 *
 *   sha256(
 *     "\\n".join(`${m.role.toLowerCase()}:${m.content.trim()}` for m in messages)
 *   )
 *
 * Uses the browser-native ``SubtleCrypto`` API so no JS hash
 * library dependency is needed. SubtleCrypto returns an
 * ArrayBuffer; the hex stringification matches the Python
 * ``hashlib.sha256(...).hexdigest()`` shape.
 */

interface HashableMessage {
    role: string;
    content: string;
}

export async function computeContentHash(
    messages: ReadonlyArray<HashableMessage>,
): Promise<string> {
    const payload = messages
        .map((m) => `${m.role.toLowerCase()}:${m.content.trim()}`)
        .join("\n");
    const data = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (const b of bytes) {
        hex += b.toString(16).padStart(2, "0");
    }
    return hex;
}
