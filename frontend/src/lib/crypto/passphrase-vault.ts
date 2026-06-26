/**
 * passphrase-vault — authenticated, passphrase-based encryption of a small
 * JSON value, using WebCrypto only (EXP-038).
 *
 * NO self-built crypto: key derivation is PBKDF2-HMAC-SHA-256 and encryption is
 * AES-GCM-256, both native ``crypto.subtle`` primitives (the same engine the
 * project already uses for SHA-256 in ``lib/ai/content-hash.ts``). AES-GCM is
 * authenticated: a wrong passphrase or a single tampered byte makes
 * ``crypto.subtle.decrypt`` reject, so there is no separate integrity check and
 * no way to partially decrypt garbage.
 *
 * Salt (16 B) and IV (12 B) are generated with ``crypto.getRandomValues`` per
 * call and stored in the envelope — never hardcoded, never reused. The
 * passphrase is used transiently to derive the key and is never persisted or
 * logged; this module never logs and never puts plaintext into an error
 * message.
 */

/** Envelope version + algorithm parameters. Bumped only on a format change. */
const FORMAT = "adaptive-learner-keys" as const;
const VERSION = 1 as const;
const PBKDF2_ITERATIONS = 250_000;
const PBKDF2_HASH = "SHA-256" as const;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AES_KEY_BITS = 256;

/** The on-disk `.alk` envelope. Binary fields are base64. */
export interface VaultEnvelope {
    format: typeof FORMAT;
    version: typeof VERSION;
    kdf: {
        name: "PBKDF2";
        hash: typeof PBKDF2_HASH;
        iterations: number;
        salt: string;
    };
    cipher: { name: "AES-GCM"; iv: string };
    ciphertext: string;
}

/**
 * Thrown for any failure to read back a vault: a malformed envelope, a wrong
 * passphrase, or a tampered/corrupted file. The message is intentionally
 * generic and leaks nothing about the contents.
 */
export class VaultDecryptError extends Error {
    constructor(message = "Passphrase incorrect or file corrupted") {
        super(message);
        this.name = "VaultDecryptError";
    }
}

function getCrypto(): Crypto {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (!c?.subtle) {
        throw new Error("WebCrypto (crypto.subtle) is not available");
    }
    return c;
}

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    // Chunked to stay well under the String.fromCharCode argument cap.
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(
            ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
        );
    }
    return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

/** Copy bytes into a plain ``ArrayBuffer``. WebCrypto's lib.dom types (TS 6)
 *  require an ``ArrayBuffer``-backed ``BufferSource``; ``TextEncoder.encode``
 *  and our base64 decode are typed as ``ArrayBufferLike`` views. The bytes are
 *  identical at runtime — this just satisfies the stricter type. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}

async function deriveAesKey(
    passphrase: string,
    salt: Uint8Array,
    iterations: number,
): Promise<CryptoKey> {
    const subtle = getCrypto().subtle;
    const baseKey = await subtle.importKey(
        "raw",
        toArrayBuffer(new TextEncoder().encode(passphrase)),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    return subtle.deriveKey(
        { name: "PBKDF2", salt: toArrayBuffer(salt), iterations, hash: PBKDF2_HASH },
        baseKey,
        { name: "AES-GCM", length: AES_KEY_BITS },
        false,
        ["encrypt", "decrypt"],
    );
}

/**
 * Encrypt a JSON-serialisable value into a `.alk` envelope string.
 *
 * @param value - The payload (serialised with ``JSON.stringify``).
 * @param passphrase - The user's passphrase (must be non-empty).
 * @returns The pretty-printed JSON envelope, ready to write to a file.
 */
export async function encryptToVault(
    value: unknown,
    passphrase: string,
): Promise<string> {
    if (!passphrase) throw new Error("A passphrase is required");
    const crypto = getCrypto();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: toArrayBuffer(iv) },
            key,
            toArrayBuffer(plaintext),
        ),
    );
    const envelope: VaultEnvelope = {
        format: FORMAT,
        version: VERSION,
        kdf: {
            name: "PBKDF2",
            hash: PBKDF2_HASH,
            iterations: PBKDF2_ITERATIONS,
            salt: toBase64(salt),
        },
        cipher: { name: "AES-GCM", iv: toBase64(iv) },
        ciphertext: toBase64(ciphertext),
    };
    return JSON.stringify(envelope, null, 2);
}

function parseEnvelope(raw: string): VaultEnvelope {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new VaultDecryptError();
    }
    const env = parsed as Partial<VaultEnvelope>;
    if (
        !env ||
        env.format !== FORMAT ||
        env.version !== VERSION ||
        env.kdf?.name !== "PBKDF2" ||
        typeof env.kdf?.salt !== "string" ||
        typeof env.kdf?.iterations !== "number" ||
        env.cipher?.name !== "AES-GCM" ||
        typeof env.cipher?.iv !== "string" ||
        typeof env.ciphertext !== "string"
    ) {
        throw new VaultDecryptError();
    }
    return env as VaultEnvelope;
}

/**
 * Decrypt a `.alk` envelope string back into its JSON value.
 *
 * Any failure — malformed envelope, wrong passphrase, or tampered ciphertext —
 * throws {@link VaultDecryptError} with a generic, non-leaking message.
 *
 * @param raw - The envelope string read from the file.
 * @param passphrase - The passphrase used at export time.
 */
export async function decryptFromVault<T = unknown>(
    raw: string,
    passphrase: string,
): Promise<T> {
    const env = parseEnvelope(raw);
    const salt = fromBase64(env.kdf.salt);
    const iv = fromBase64(env.cipher.iv);
    const ciphertext = fromBase64(env.ciphertext);
    const key = await deriveAesKey(passphrase, salt, env.kdf.iterations);
    let plaintext: ArrayBuffer;
    try {
        plaintext = await getCrypto().subtle.decrypt(
            { name: "AES-GCM", iv: toArrayBuffer(iv) },
            key,
            toArrayBuffer(ciphertext),
        );
    } catch {
        // Auth-tag mismatch: wrong passphrase or tampered file.
        throw new VaultDecryptError();
    }
    try {
        return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    } catch {
        throw new VaultDecryptError();
    }
}
