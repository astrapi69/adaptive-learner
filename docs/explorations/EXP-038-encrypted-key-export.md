# EXP-038 — Passphrase-Encrypted Key Export (`.alk`)

Status: accepted · Author: CCW · Supersedes/relates: EXP-031 (`.alb` ZIP backup)

## Problem

AI provider keys are deliberately **excluded from the normal `.alb` backup**
(`backup.ts` strips `api_key_anthropic` / `api_key_openai` / `api_key_gemini`
from `user_settings` on both export and import — a security decision). The
consequence: when a learner switches device or browser (the common case for the
Dexie-mode / PWA / GitHub-Pages deployment, where keys live only in the local
IndexedDB), **every key must be re-entered by hand**.

We want a **separate, passphrase-encrypted export/import dedicated to the
sensitive credentials only**, distinct from the normal backup.

## Scope

In scope (the "key vault"):
- The AI provider **keys** (anthropic / openai / gemini).
- The **provider settings**: `active_provider` + `model_override_*`.

Out of scope: the rest of the app state — projects, progress, content — which
keeps flowing through the normal `.alb` backup. The two channels stay separate.

## Storage-mode boundary (DEXIE-MODE-REGEL)

Where the keys live decides what the export can even read:

| Mode | Keys live | Client can read plaintext? | Encrypted export |
|------|-----------|----------------------------|------------------|
| **Dexie** (browser / PWA / GH-Pages) | IndexedDB `userSettings.api_key_*` | **Yes** | **Supported** — the device-switch pain this feature solves |
| **API** (server) | Server-side, Fernet-encrypted DB | **No** (only `has_*_key` booleans reach the client) | **Not available** — the client has no plaintext to encrypt; keys already persist server-side |

So the feature is a **Dexie-mode feature**. In API mode the entry is shown
**disabled with a hint** (FUNKTION-NICHT-VERFUEGBAR: never a dead/empty
control). The new storage seam `settings.exportApiKeys(userId)` returns the
retrievable plaintext keys — the Dexie impl reads the row fields, the API impl
returns `{}` — and the UI gates on that result.

## Threat model

What the encryption protects, and against what:

- **Protects:** the `.alk` file **at rest** — on disk, in cloud storage, in
  transit between devices, in a backup. An attacker who obtains the file cannot
  read the keys without the passphrase.
- **Does NOT protect against:** a compromised device while the app runs (the
  keys are in IndexedDB in plaintext by design — that is the app's normal trust
  boundary, unchanged here), a keylogged passphrase, or a weak passphrase
  (brute-forceable offline). The high PBKDF2 iteration count raises the offline
  brute-force cost but cannot rescue a trivial passphrase — the UX copy says so.
- **Non-goal:** the file is not a secrets-manager. It is a portable, encrypted
  envelope the user controls.

## Crypto choice (no self-built crypto)

WebCrypto (`crypto.subtle`) only — native, vetted, already used in the project
for SHA-256 (`lib/ai/content-hash.ts`). No new crypto dependency.

- **KDF:** PBKDF2-HMAC-**SHA-256**, **250 000 iterations**, **16-byte random
  salt** per export. Derives a 256-bit AES key from the passphrase.
- **Cipher:** **AES-GCM-256**, **12-byte random IV** per export. GCM is
  authenticated encryption: the 128-bit auth tag makes a wrong passphrase or a
  tampered byte fail the `decrypt` call — no separate integrity check needed,
  no way to partially decrypt garbage.
- **Salt + IV** are generated with `crypto.getRandomValues` per export and
  stored in the file (never hardcoded). The passphrase is never persisted or
  logged; key plaintext never appears in a log or an error message.

## File format (`.alk` — Adaptive Learner Keys)

A small UTF-8 JSON envelope. Binary fields are base64. The plaintext payload is
JSON, encrypted as one AES-GCM blob:

```json
{
  "format": "adaptive-learner-keys",
  "version": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 250000, "salt": "<base64 16B>" },
  "cipher": { "name": "AES-GCM", "iv": "<base64 12B>" },
  "ciphertext": "<base64 AES-GCM(payload)>"
}
```

Decrypted payload shape:

```json
{
  "keys": { "anthropic": "sk-...", "openai": "...", "gemini": "..." },
  "providerSettings": {
    "active_provider": "anthropic",
    "model_override_anthropic": "claude-...", "model_override_openai": null, "model_override_gemini": null
  }
}
```

Extension is **`.alk`** (distinct from `.alb`). Only keys actually present are
written; absent providers are omitted.

## UX flow

**Export** (Settings → Data → "KI-Schlüssel (verschlüsselt)" — the single
export entry point, next to the other backups. The AI tab carries only a
reference button that jumps here, so a learner managing keys still finds it
without a second export form duplicating the logic. History: #1182 briefly
moved the section onto the AI tab; #1183 restored the single Data-tab home
and added the AI-tab link instead):
1. Visible only in Dexie mode; the Export action is enabled only when ≥1 key
   exists (otherwise disabled with a hint).
2. Passphrase + confirmation field. Mismatch / empty / too short → inline error,
   no download. A warning explains: a weak passphrase = weak protection, and
   the passphrase cannot be recovered.
3. On confirm: collect keys + provider settings → encrypt → download `name.alk`.

**Import** (same section):
1. Pick an `.alk` file → enter the passphrase.
2. Decrypt. On success: write each key via the existing `settings.setApiKey`
   and the provider settings via `settings.update` — the **same sinks manual
   entry uses**. Existing keys are **overwritten** by the imported ones
   (last-write-wins; an import is an explicit "make this device match" action);
   providers absent from the file are left untouched.
3. Success confirmation; the tutor chat works again immediately.

## Failure behaviour

- **Wrong passphrase / corrupted / tampered file:** AES-GCM `decrypt` throws →
  surfaced as a single, non-leaking message: *"Passphrase falsch oder Datei
  beschädigt."* No stack trace, no partial import (nothing is written until the
  full payload decrypts and parses).
- **Not an `.alk` / malformed envelope:** rejected before any crypto work with
  the same friendly message.

## Separation guarantee (regression-pinned)

- The `.alk` file contains the keys **only as the AES-GCM ciphertext** — never
  in plaintext (test: the serialized envelope contains no key substring).
- The normal `.alb` backup continues to **strip** `api_key_*` from
  `user_settings` (existing `dropApiKeyFields`, re-pinned). The two channels do
  not overlap.

## Rejected alternatives

- **Self-rolled crypto / a new crypto lib:** forbidden; WebCrypto is native and
  sufficient.
- **Putting keys into the `.alb`:** reverses the existing security decision.
- **A backend re-encrypt endpoint for API mode:** expands the server attack
  surface for a marginal case (server keys already persist); deferred.
