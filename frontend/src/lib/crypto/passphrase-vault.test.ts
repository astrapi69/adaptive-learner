/**
 * Tests for the passphrase vault (EXP-038) — the WebCrypto AES-GCM + PBKDF2
 * envelope. Pins: round-trip, wrong passphrase, tampered ciphertext, malformed
 * envelope, and that the plaintext never appears in the envelope.
 */

import { describe, expect, it } from "vitest";

import {
    decryptFromVault,
    encryptToVault,
    looksLikeVaultEnvelope,
    VaultDecryptError,
    type VaultEnvelope,
} from "./passphrase-vault";

const SECRET = { keys: { anthropic: "sk-ant-SUPERSECRET-123" } };

describe("passphrase-vault", () => {
    it("round-trips a value with the correct passphrase", async () => {
        const envelope = await encryptToVault(SECRET, "correct horse battery");
        const back = await decryptFromVault(envelope, "correct horse battery");
        expect(back).toEqual(SECRET);
    });

    it("never stores the plaintext in the envelope", async () => {
        const envelope = await encryptToVault(SECRET, "passphrase-123");
        expect(envelope).not.toContain("sk-ant-SUPERSECRET-123");
        const parsed = JSON.parse(envelope) as VaultEnvelope;
        expect(parsed.format).toBe("adaptive-learner-keys");
        expect(parsed.kdf.name).toBe("PBKDF2");
        expect(parsed.kdf.iterations).toBeGreaterThanOrEqual(250_000);
        expect(parsed.cipher.name).toBe("AES-GCM");
        // Salt + IV present and not empty (random per export, stored in the file).
        expect(parsed.kdf.salt.length).toBeGreaterThan(0);
        expect(parsed.cipher.iv.length).toBeGreaterThan(0);
    });

    it("uses a fresh random salt + IV per export", async () => {
        const a = JSON.parse(await encryptToVault(SECRET, "p")) as VaultEnvelope;
        const b = JSON.parse(await encryptToVault(SECRET, "p")) as VaultEnvelope;
        expect(a.kdf.salt).not.toBe(b.kdf.salt);
        expect(a.cipher.iv).not.toBe(b.cipher.iv);
        expect(a.ciphertext).not.toBe(b.ciphertext);
    });

    it("rejects a wrong passphrase with VaultDecryptError", async () => {
        const envelope = await encryptToVault(SECRET, "right-passphrase");
        await expect(
            decryptFromVault(envelope, "wrong-passphrase"),
        ).rejects.toBeInstanceOf(VaultDecryptError);
    });

    it("rejects a tampered ciphertext (AES-GCM auth tag)", async () => {
        const parsed = JSON.parse(
            await encryptToVault(SECRET, "p"),
        ) as VaultEnvelope;
        // Flip a character in the base64 ciphertext.
        const ct = parsed.ciphertext;
        const flipped = (ct[0] === "A" ? "B" : "A") + ct.slice(1);
        const tampered = JSON.stringify({ ...parsed, ciphertext: flipped });
        await expect(
            decryptFromVault(tampered, "p"),
        ).rejects.toBeInstanceOf(VaultDecryptError);
    });

    it("rejects a malformed / non-vault file", async () => {
        await expect(
            decryptFromVault("not json at all", "p"),
        ).rejects.toBeInstanceOf(VaultDecryptError);
        await expect(
            decryptFromVault(JSON.stringify({ hello: "world" }), "p"),
        ).rejects.toBeInstanceOf(VaultDecryptError);
    });
});

describe("looksLikeVaultEnvelope (#1765 paste-content gate)", () => {
    it("accepts a real encrypted envelope string", async () => {
        const envelope = await encryptToVault(SECRET, "pass-1234");
        expect(looksLikeVaultEnvelope(envelope)).toBe(true);
    });

    it("rejects non-JSON, wrong-shape, and incomplete envelopes", () => {
        expect(looksLikeVaultEnvelope("not json")).toBe(false);
        expect(looksLikeVaultEnvelope("{ not: valid }")).toBe(false);
        expect(looksLikeVaultEnvelope(JSON.stringify({ hello: "world" }))).toBe(
            false,
        );
        // Right marker but missing kdf / cipher / ciphertext fields.
        expect(
            looksLikeVaultEnvelope(
                JSON.stringify({ format: "adaptive-learner-keys", version: 1 }),
            ),
        ).toBe(false);
    });

    it("rejects a foreign format marker", () => {
        expect(
            looksLikeVaultEnvelope(
                JSON.stringify({
                    format: "some-other-app",
                    version: 1,
                    kdf: {
                        name: "PBKDF2",
                        hash: "SHA-256",
                        iterations: 250000,
                        salt: "x",
                    },
                    cipher: { name: "AES-GCM", iv: "y" },
                    ciphertext: "z",
                }),
            ),
        ).toBe(false);
    });
});
