# Video Exercise Type — Feasibility Audit (Phase 1: Storage Knockout + Design)

**Date:** 2026-07-22
**Scope:** Phase 1 only — verify-first storage/cost knockout, then reuse-vs-new-type
design assessment. No implementation.
**Verdict:** **Do NOT build now.** The storage/asset infrastructure cannot carry
video assets without a large, offline-first-violating architecture change. The
knockout criterion is negative, and that is the actual finding of this phase.

---

## 1. Summary

A video exercise type was assessed against a deliberately front-loaded knockout
criterion: *can video assets live in the current storage architecture at all?*
The answer is **no, not without a major architecture change**, on evidence that
is consistent across every layer of the asset pipeline.

The interaction/wiring question (does a video type need a whole new
schema+renderer+grader, or can it reuse dictation/reading-comprehension?) has a
clean, encouraging answer — a video type would follow the **dictation blueprint
almost exactly**. But that answers the wrong question. The interaction pattern is
a solved problem; the **asset storage substrate that pattern depends on is the
wall**, and it is exactly what the knockout criterion tests. So the cheap wiring
is irrelevant: it would be wiring onto a foundation that cannot hold video.

Notably, **video is already a documented, deliberate exclusion** in the project,
on precisely these grounds:

> `docs/help/en/developer/authoring-content.md:442` — "Deliberately excluded"
> table: **Audio / video / file upload | Storage + infrastructure; conflicts
> with offline-first.**

This audit confirms that exclusion is still correct and quantifies why.

---

## 2. Knockout criterion: storage / asset cost (NEGATIVE)

Every layer of the asset pipeline is hard-capped and image-shaped. Video collides
with all of them.

### 2.1 Schema / manifest caps (image-only, 500 KiB/asset)

- **Per-asset hard cap 500 KiB.** `ContentSetAsset.size_kb` is
  `Field(..., ge=1, le=500)` (`manifest_generated.py:40`), mirrored by
  `MAX_ASSET_SIZE_KB = 500` (`models.py:151`). A single short learning video is
  in the **MB range even compressed** — one to two orders of magnitude over this
  cap.
- **Extension whitelist is 5 image types.**
  `_IMAGE_EXTENSIONS = {.png, .jpg, .jpeg, .webp, .svg}` (`models.py:145`); the
  path validator rejects anything else. **No `.mp4` / `.webm` / `.mov` anywhere**
  in the whitelist, the MIME map, or the codebase.
- **Per-set soft limit 10 MiB / 500-asset hard cap.**
  `SET_ASSETS_SOFT_LIMIT_KB = 10*1024` (`models.py:158`); the assets list is
  `max_length=500`. A single video would consume the entire per-set media budget.
- **Download-time byte guard.** `_validate_asset_size()` rejects when actual bytes
  exceed declared `size_kb * 1024 * 1.10` (`service.py:145-147`), i.e. an
  effective ceiling of ~562 KiB actual bytes per asset.

### 2.2 Backend endpoint: full-buffer, no streaming, no range

`GET .../sets/{source}/{set_id}/assets/{path}` (`routes.py:345-399`):

- `read_asset()` does `target.read_bytes()` (`cache.py:311`) — **the entire file
  is read into RAM** — and the route returns a plain
  `Response(content=payload, ...)` (`routes.py:393-399`).
- **No `StreamingResponse`, no `FileResponse`, no HTTP range / `Accept-Ranges`
  support anywhere** in the pipeline. Video playback requires byte-range requests
  (seek, progressive load); serving a multi-MB file as a single buffered response
  is both memory-hostile and breaks native `<video>` seeking.
- Cache-Control is `public, max-age=31536000, immutable` (1-year), justified by
  the version-pinned cache layout — fine for images, unchanged by this concern.

### 2.3 Dexie mode: base64-in-a-TEXT-column (the hardest wall)

- Binary assets are stored **base64-encoded in the `body` TEXT column** of
  `contentSetFiles` (`db-rows.ts:582-595`, `encoding: "base64"`). There is **no
  Blob / ArrayBuffer column.** Base64 inflates stored size by **~33%** on top of
  the raw bytes.
- Every read decodes the **whole** asset back to a `Blob` in memory
  (`content-loader-read.ts:95-123`).
- A 10 MB video would become a **~13 MB base64 string in a single IndexedDB row**,
  fully materialised into memory on every play. This is prohibitive for even a
  handful of videos.

### 2.4 In-memory object URLs, held for the consumer lifetime

`useAsset` (`hooks/ui/useAsset.ts`) + `asset-resolver.ts` ref-count a **single
`URL.createObjectURL(blob)` per asset**, kept resident until the last consumer
releases. For images this is negligible; for video blobs it means multi-MB held
in memory for as long as any component references the exercise.

### 2.5 Data-URI upload path caps out at 2 MiB

Dictation (the one type that recently added media) uploads clips as a base64
`data:` URI capped at `AUDIO_MAX_BYTES = 2 MiB` (`dictation-audio.ts:31`), with
**no re-encode** (audio/video cannot be canvas-recompressed the way card images
are). Video routinely exceeds 2 MiB; the self-contained data-URI approach that
made dictation cheap is **not available to video**.

### 2.6 Browser storage is fragile and NOT persisted (iOS eviction)

- `auto-backup.ts:1-24`: "Browser storage is fragile: a cache clear, a browser
  update, or a storage-pressure **eviction can wipe IndexedDB silently**."
- **`navigator.storage.persist()` is never called** — IndexedDB + Cache Storage
  remain **best-effort / evictable**. The app only *observes* pressure
  (`estimate()` → warn at >90% quota, `auto-backup.ts:330-354`); it never requests
  durability.
- iOS WKWebView eviction is a documented platform risk:
  `docs/reference/adaptive-learner-vorgehensweise.md:172` — "IndexedDB kann unter
  Storage-Druck evakuiert werden." Video would build storage pressure fast,
  raising the odds of a silent wipe of *all* user progress — the exact failure the
  auto-backup ring exists to mitigate (and which a full IndexedDB eviction defeats,
  since the backup ring is itself in IndexedDB).
- The Workbox precache globs exclude video/audio and default to a **2 MiB
  per-file cap**; the `adaptive-learner-lessons` runtime cache bounds by **entry
  count (500) / 90 days, LRU — not bytes** (`vite.config.ts:148-189`), so it offers
  **no protection against a few large videos** blowing past a reasonable device
  budget while staying well under 500 entries.
- Native wrappers that could relax these limits are **explicitly rejected**:
  `adaptive-learner-vorgehensweise.md:173` — "Capacitor/React Native/Kotlin sind
  NICHT der Weg. Bestehende PWA härten."

### 2.7 Knockout conclusion

Supporting video assets in the current architecture would require, at minimum:

1. Raising/removing the `size_kb ≤ 500` schema cap and the per-set 10 MiB budget.
2. Adding `.mp4`/`.webm` to the extension whitelist + MIME map.
3. Converting the backend endpoint to `StreamingResponse`/`FileResponse` with HTTP
   range support.
4. Replacing Dexie's base64-in-text storage with a real Blob store, and reworking
   the memory model (no full-decode-per-read).
5. Adopting `navigator.storage.persist()` + an eviction/UX story for large media.

Each item is non-trivial; together they are a **media-storage subsystem rewrite**,
and several (offline-stored multi-MB media, no-native-migration) run **directly
against the offline-first product principle**. **The knockout criterion fails.**

---

## 3. Reuse vs. new type (only partially relevant, given §2)

For completeness — if the storage wall did not exist, the *interaction* side is
cheap. A video type is **not a new interaction category**; it is a media source
for two already-solved patterns:

| Video use case | Existing pattern | Reuse basis |
| --- | --- | --- |
| Watch → transcribe / answer one prompt | **`ext:al-dictation`** | Closest match: dictation already solves media referencing — `audio: string` (relative `assets/` path *or* `data:` URI), the media-type-agnostic `useAsset` chain, the `data:`-direct-play branch in `ListenFirstAudio`, and the SRS/grading reuse. A video type would mirror `DictationPayload` with a `video` field. |
| Watch → answer N comprehension questions | **`ext:al-reading-comprehension`** | Contributes the multi-question grading fan-out (`{passage, questions[]}`), but has **no media plumbing at all** — would need a `video` field bolted on plus dictation's asset chain. |

The wiring is mechanical and matches the dictation adoption: add the type to
`SUPPORTED_EXTENSIONS` / `SUPPORTED_EXT_EXERCISE_TYPES` / `EXTENSION_WIZARD_TYPES`,
a `renderAdoptedExtension` branch, a blank-payload entry, an editor `*Fields`
component, and (optionally) a core-picker button. The generalized
`requires_extensions` gate (#1895) then works with zero extra code, and
`ext_payload` being `additionalProperties: true` means **no engine-schema change**
is forced.

**But this is not the deciding factor.** The reusable dictation blueprint depends
on the very asset-storage substrate that §2 shows cannot hold video. A "cheap
variant of dictation" would be cheap *code* wired onto storage that fails. So:
**no new type is needed structurally — but neither a new type nor a dictation
variant is viable, because both would depend on unbuildable video-asset storage.**

---

## 4. Accessibility note (for the record)

If video were ever introduced, WCAG would require captions/subtitles and a text
transcript. Ironically, the transcript requirement means the *comprehension value*
of a video is largely recoverable from text — a reading-comprehension exercise
over the transcript, plus an external video link, delivers most of the pedagogy
**without storing the video at all**. This reinforces the recommendation in §6.

---

## 5. Effort estimate

Giving a full build estimate would be misleading, since §2 fails the knockout. For
the record:

- **Interaction/wiring** (if storage were free): ~ the dictation adoption — a few
  days (payload module, renderer with a `<video>` variant of `ListenFirstAudio`,
  wizard fields, gate registration).
- **Storage rework** (the real cost): a **multi-week media-storage subsystem
  project** — streaming backend with range support, a non-base64 Dexie/OPFS Blob
  store, `persist()` adoption, eviction UX, precache/runtime-cache policy for large
  media — and a **product-level decision to relax or carve out an exception to the
  offline-first principle.** This dwarfs the exercise-type work and is the item
  that "puts the whole proposal in question," as the brief anticipated.

---

## 6. Overall recommendation

**Do not build a video exercise type now.**

- The knockout criterion (storage) is negative. Video assets are not tractable in
  the current offline-first, Dexie-base64, non-streaming, non-persisted
  architecture. This matches the existing documented exclusion (§1).
- **Build later only under an explicit precondition:** a deliberate media-storage
  architecture decision — e.g. an external streaming/CDN media tier with graceful
  offline degradation (accepting that such content is *connectivity-required*, a
  carve-out from offline-first), plus `navigator.storage.persist()` and an eviction
  story. Absent that decision, do not proceed to any detailed design.
- **Better-fit alternative available today (recommended interim):** the
  pedagogical need "learn from a video" is already served by the **EXP-029 media
  integration** ("Vertiefe das Thema", `media.yaml`, offline-safe YouTube
  thumbnails) — external video *links* as supplementary material, not a
  stored/graded asset. If graded assessment over video content is wanted, author a
  **`ext:al-reading-comprehension` exercise over the video's transcript** and link
  the video via the media section. This delivers the comprehension pedagogy with
  **zero new storage cost** and full offline-first compliance.

---

## 7. Questions and assumptions

- **Assumption (conservative):** "short learning video" means ≥ a few MB even
  compressed. This is standard for even 30–60 s clips and is what makes the
  500 KiB / 2 MiB caps decisive; the conclusion holds for any realistic video size.
- **Evidence-based:** every numeric claim (500 KiB cap, 10 MiB set budget, 2 MiB
  data-URI cap, 2 MiB precache default, 500-entry runtime cache, base64-in-text,
  no `persist()`) is grounded in the files cited inline, read this session.
- **Not blocking:** whether a future connectivity-required media tier is
  acceptable is a product decision for the maintainer, not resolvable from repo
  evidence — flagged as the precondition in §6, not assumed either way.

_Phase 1 only. No Phase 2 design produced, per the brief: the knockout criterion
fell, so no design detail was elaborated for a feature that is not architecturally
tenable._
