# Phase 35 — Documentation Staleness Audit (2026-05-22)

**Audit baseline**: post-v1.20.0 HEAD (commit `26fc837`).
**Tests at audit time**: backend 786 / plugins 615 / frontend
Vitest 1233 = **2634 green**. `npm run build` clean.

This is a documentation-only sweep audit. No code changes were
made during the audit; this file is the input for the per-doc
fixes in Phase 35B–35I.

---

## Headline findings

- **CLAUDE.md is 46,621 bytes** (~4.7× the 10K budget). Top of
  the file declares "Current state (v1.19.0)" — 1 minor behind.
  The body still describes "Seven plugins shipped in v0.2.0"
  (we have **10**), "19 SQLAlchemy models" (we have **23 + 2
  badge tables = 25**), "skeleton/template extracted from
  Bibliogon" framing, and per-version footnotes for v0.4.0 /
  v0.5.0 / v0.6.0 / v0.7.0 / v0.8.0 etc. The full "Current
  state (vX.Y.0)" block is appended to on every release;
  the last 5 phases (28–34) inflated it by ~12K bytes.
- **Both READMEs claim v0.8.1** ("Active development. v0.8.1
  was released 2026-05-19"). That's 12 minor versions behind.
  Feature list stops at v0.7.0 PWA + Dexie storage. **Nothing
  about**: cycle auto-loop, streaming, sync, model picker,
  backup compare, native PT/TR/JA translations, TipTap rich
  text, gestures, audit phases, NotebookLM, voice, Anki,
  pronunciation, secrets.yaml, gamification, BISAC ← that
  last one is Bibliogon's, not ours, and shouldn't appear.
- **docs/ROADMAP.md stops at Phase 26 / v1.13.0**. Phases
  27 (v1.14.0 TipTap rich text), 28 (v1.15.0 E2E expansion),
  29 (v1.16.0 gamification), 30 (v1.17.0 Anki), 31 (v1.18.0
  voice), 32 (v1.19.0 NotebookLM), 33 (v1.19.x import
  parser audit), 34 (v1.20.0 secrets.yaml) are entirely
  missing from the table.
- **docs/reference/CONCEPT.md (2.4K)** mentions v1.5.0 as the most
  recent reference. Misses v1.6.0+ entirely (streaming, sync,
  model picker, backup compare, native i18n, TipTap, E2E,
  gamification, Anki, voice, NotebookLM, secrets.yaml).
- **docs/adaptive-learner-project-reference.md (20K)** opens
  with "Aktueller Tag: v0.0.0-template (Skeleton aus Bibliogon
  v0.33.0)" + "Phase 1: Domain-Migration + MVP", "Phase 2:
  Multi-Provider + vollstaendige i18n". The whole document
  is the original planning artefact from v0.0.0; it never got
  the "shipped" rewrite. Heavily mis-describes the actual
  architecture (no gamification / voice / Anki / NotebookLM
  / secrets.yaml sections at all).
- **MkDocs help pages: 30 pages × 2 languages = 60 files**.
  At least 10 EN pages and presumably 10 DE pages mention
  v0.6.0–v0.8.0 features as if recent. The index, FAQ,
  architecture, deployment, plugin-guide, storage-layer,
  testing, release, ai-integration, i18n developer pages
  all carry stale version refs.
- **137 stale version refs** (v0.X.Y or v1.0–v1.19) in
  CLAUDE.md / READMEs / 8 docs files. Counted with:
  ```bash
  grep -nE "v0\.[0-9]+\.|v1\.([0-9]|1[0-9])\b" \
    CLAUDE.md README*.md docs/*.md | wc -l
  ```
- **docs/configuration.md**: ALREADY refreshed in the v1.20.0
  Phase 34 commit `cfafce6`. No action needed.
- **docs/backlog.md**: BL-25 / BL-26 / BL-27 / BL-28 / BL-29
  all marked closed with v1.19.x or v1.20.0 attribution.
  Already current. The "State" header line still says
  "post v1.8.0 (Phase 21)" though — needs a refresh to
  "post v1.20.0 (Phase 34)".

---

## Per-file action table

| File | Bytes | Issue | Action for 35B–35I |
|------|------:|-------|--------------------|
| `CLAUDE.md` | 46,621 | "Current state (v1.19.0)"; says 7 plugins / 19 models; under-10K budget violated 4.7×; "skeleton extracted from Bibliogon" framing | **Full rewrite** (35B). Trim to <10K. Use ground-truth from this audit. |
| `README.md` | 10,971 | "Active development. v0.8.1 ... 2026-05-19"; feature list stops at v0.7.0; references BISAC (Bibliogon) | **Full rewrite** (35C). All shipped features. Installation paths × 4. |
| `README-de.md` | 11,532 | Same as README.md, German | **Full rewrite** (35C) — keep DE/EN structure aligned |
| `docs/configuration.md` | 12,606 | Already refreshed in v1.20.0 | **No action** — verify only |
| `docs/reference/CONCEPT.md` | 2,435 | Stops at v1.5.0 | **Append** post-v1.5.0 milestones in 35G or 35H |
| `docs/ROADMAP.md` | 8,679 | Stops at Phase 26 / v1.13.0. "State: post v1.8.0" header | **Append** Phases 27–34 to the table; update "Current state" header (35H) |
| `docs/backlog.md` | 11,464 | "State: post v1.8.0 (Phase 21)" header is stale; the closed-item entries are current | **Minor** — refresh the State header in 35H |
| `docs/adaptive-learner-project-reference.md` | 19,982 | "Aktueller Tag: v0.0.0-template"; describes Phase 1–2 only; no gamification/voice/anki/notebooklm/secrets.yaml sections | **Major append** in 35H. Add "Shipped architecture (v1.20.0)" section that diverges from the original plan. |
| `docs/help/en/index.md` | n/a | "v0.8.0 was released 2026-05-19" | **Refresh** in 35I (landing page) |
| `docs/help/de/index.md` | n/a | Mirror of EN | **Refresh** in 35I |
| `docs/help/en/user-guide/getting-started.md` | n/a | Likely refers to old onboarding flow (no subjects/tags) | **Refresh** in 35D |
| `docs/help/en/user-guide/assessment.md` | n/a | Probably no swipe/multi-select mention | **Refresh** in 35D |
| `docs/help/en/user-guide/learning-session.md` | n/a | No streaming/auto-loop/dual-prompt mention | **Refresh** in 35D |
| `docs/help/en/user-guide/dashboard.md` | n/a | No XP/badges/streak/subjects-filter mention | **Refresh** in 35D |
| `docs/help/en/user-guide/curriculum.md` | n/a | No TipTap rich-text mention | **Refresh** in 35D |
| `docs/help/en/user-guide/progress.md` | n/a | "v0.X" refs; no PDF/MD export mention | **Refresh** in 35D |
| `docs/help/en/user-guide/settings.md` | n/a | No secrets.yaml / key-source / voice / gamification / gestures mention | **Refresh** in 35D (largest user-guide doc) |
| `docs/help/en/user-guide/faq.md` | n/a | "v0.7.0" refs | **Refresh + add** Anki/voice/gamification/sync/import Q&A in 35D |
| `docs/help/en/user-guide/onboarding.md` | n/a | Onboarding has subjects/tags now | **Refresh** in 35D |
| `docs/help/en/developer/architecture.md` | n/a | v0.6.0 / v0.7.0 refs; 7-plugins-era description | **Refresh** in 35E |
| `docs/help/en/developer/setup.md` | n/a | Pre-secrets.yaml setup | **Refresh** in 35E |
| `docs/help/en/developer/plugin-guide.md` | n/a | v0.7.0-era plugin examples | **Refresh** in 35E |
| `docs/help/en/developer/storage-layer.md` | n/a | Missing recent namespaces (anki, gamification, notebooklm, imports) | **Refresh** in 35E |
| `docs/help/en/developer/ai-integration.md` | n/a | Missing async + stream hooks, dual-prompt, topic-transition, analysis, card-extraction, pronunciation-judge | **Refresh** in 35E |
| `docs/help/en/developer/testing.md` | n/a | Old test counts | **Refresh** in 35E with 2634 green |
| `docs/help/en/developer/deployment.md` | n/a | Pre-secrets.yaml deployment | **Refresh** in 35E |
| `docs/help/en/developer/i18n.md` | n/a | 8 langs but maybe old structure | **Verify + refresh** in 35E |
| `docs/help/en/developer/release.md` | n/a | Old release flow | **Refresh** in 35E with current `make sync-versions` chain |
| `docs/help/en/api/overview.md` | n/a | Endpoint count + auth model stale | **Refresh** in 35F |
| `docs/help/en/api/core-endpoints.md` | n/a | Misses settings `key_source_*` fields, system-info, backup compare endpoints | **Refresh** in 35F |
| `docs/help/en/api/plugin-endpoints.md` | n/a | Misses streaming / pronunciation / anki / gamification / notebooklm / spaced | **Refresh** in 35F |
| `docs/help/en/api/models.md` | n/a | 19-model era; we have 25 | **Refresh** in 35F |
| `docs/help/en/api/hooks.md` | n/a | Missing `ai_complete_async`, `ai_complete_stream` | **Refresh** in 35F |
| `docs/help/en/concept/philosophy.md` | n/a | Core thesis stable | **No action** likely |
| `docs/help/en/concept/six-methods.md` | n/a | Should mention 42-cell prompt matrix + method switching | **Refresh** in 35G |
| `docs/help/en/concept/seven-steps.md` | n/a | Should mention auto-loop + dual-prompt evaluation + topic transitions | **Refresh** in 35G |
| `docs/help/en/concept/tracking.md` | n/a | Should mention gamification XP + streak heatmap | **Refresh** in 35G |
| `docs/help/en/concept/tools.md` | n/a | Should mention ACTUAL Anki .apkg / NotebookLM ZIP / Voice TTS-STT — not just abstract recommendations | **Refresh** in 35G |
| `docs/help/de/**` (15 pages) | n/a | Mirror of EN with same staleness | **Refresh** alongside each EN counterpart in 35D / 35E / 35F / 35G |
| `mkdocs.yml` | n/a | Verify nav has every page | **Verify** in 35I |

---

## Ground-truth facts to apply during the rewrite

These are the numbers/lists the surveyed code actually exposes
at v1.20.0 — every doc rewrite must agree with this section.

### Version

`v1.20.0` everywhere (will become `v1.21.0` at the end of
Phase 35).

### Test counts (verified 2026-05-22 13:30)

| Suite | Count |
|---|---|
| Backend | 786 |
| Plugins (10) | 615 (assessment 110 + ai-anthropic 34 + ai-openai 31 + ai-gemini 33 + session 215 + tracking 64 + tools 58 + gamification 23 + anki 20 + notebooklm 27) |
| Frontend Vitest | 1233 |
| **Total** | **2634** |

### 10 plugins (all at version 1.20.0)

| Plugin | Routes |
|---|---|
| ai-anthropic | hook-only (`ai_complete*` for `claude-*`) |
| ai-openai | hook-only (`ai_complete*` for `gpt-*`) |
| ai-gemini | hook-only (`ai_complete*` for `gemini-*`) |
| assessment | `/questions`, `/evaluate`, `/profile/{project_id}` |
| session | `/start`, `/{id}/message`, `/{id}/message/stream`, `/{id}/rate`, `/{id}/end`, `/{id}`, switch-recommendation, `/{id}/switch`, pronunciation eligibility/phrase/judge |
| tracking | `/progress/{project_id}`, `/commits/{project_id}` |
| tools | `/recommendations/{project_id}`, `/spaced/{project_id}` |
| gamification | XP × 4 routes, badges × 3, streak × 3, reset × 1 |
| anki | cards CRUD + extract-from-{session,conversation} + mark-exported (7) |
| notebooklm | questions CRUD + generate-from-{session,project} + study-guide (7) |

### 25 data models

User, UserSettings, LearningProject, LearningProfile, Curriculum,
LearningTopic, Lesson, LearningSession, SessionMessage,
SessionRating, SessionNote, ProgressCommit, StepEvaluation,
MethodSwitch, ImportedConversation, ImportedMessage, Subject,
Tag, ProjectSubject, ProjectTag, UserXP, Badge, UserBadge,
UserStreak, AnkiCardSuggestion, StudyQuestion.

(The previous CLAUDE.md said "19 SQLAlchemy models" — that
count predates Phase 22 subjects/tags and Phase 29 gamification.)

### 8 hooks (per `backend/app/hookspecs.py`)

`get_assessment_questions`, `calculate_profile`,
`create_session_prompt`, `ai_complete` (sync, firstresult),
`ai_complete_async` (v1.5.0), `ai_complete_stream` (v1.6.0),
`recommend_method_switch`, `on_session_complete`,
`get_progress_summary`, `get_tool_recommendations`.

### 13 frontend pages

Landing, Onboarding, Assessment, Dashboard, Session,
Curriculum, Progress, Settings, Import, ImportDetail, Anki,
Pronunciation, NotFound (404).

### Tech stack

Backend: Python 3.11+, FastAPI ^0.136.0, SQLAlchemy ^2.0.49,
Pydantic ^2.13.0, Pluginforge ^0.10.0, platformdirs ^4.2.0,
Alembic ^1.18.4, Cryptography ^48.0.0, aiosqlite ^0.22.1,
ruamel-yaml ^0.19.0, httpx ^0.28.0, Poetry, pytest ^9.0.0,
mypy ^1.20.0.

Frontend: React ^19.2.0, react-router-dom ^7.14.1,
react-toastify ^11.0.5, Recharts ^3.8.1, Dexie ^4.4.2, TipTap
^2.11.0 (+ extensions), TypeScript ^6.0.3, Vite ^8.0.12,
Vitest ^4.1.6, Node engine ≥24.0.0.

### MkDocs page tree

`docs/help/{en,de}/{api,concept,developer,user-guide}/*.md`
+ `index.md` per language. 30 pages × 2 languages = **60
files**. Layout already complete.

---

## Phase 35 sub-phase plan

| Sub | Scope | Output |
|---|---|---|
| 35A | **This audit** | This file (committed). |
| 35B | CLAUDE.md rewrite | One file. Under 10K. |
| 35C | README.md + README-de.md | Two files, parallel structure. |
| 35D | MkDocs user guide × 2 langs | 9 EN + 9 DE = 18 files. |
| 35E | MkDocs developer guide × 2 langs | 9 EN + 9 DE = 18 files. |
| 35F | MkDocs API reference × 2 langs | 5 EN + 5 DE = 10 files. |
| 35G | MkDocs concept pages × 2 langs | 5 EN + 5 DE = 10 files (philosophy probably no-op). |
| 35H | Backlog + ROADMAP + project-reference | 3 files. |
| 35I | MkDocs landing + nav | index.md × 2 + mkdocs.yml. |
| 35J | docs-build + verify + version bump v1.21.0 + tag + release | Release artifacts. |

**Total**: 1 (audit) + 1 + 2 + 18 + 18 + 10 + 10 + 3 + 3 + N (release) = **~66 files touched** across 9 sub-commits.

---

## Open questions to surface before 35B starts

1. **CLAUDE.md "Current state" block scope** — the file
   currently appends a multi-paragraph "Current state (vX.Y.0)"
   block on every release. The cumulative effect is the 46K
   bloat. Proposal: **replace** the cumulative block with a
   single-line `**Current state**: v1.20.0 (Phase 34 — secrets.yaml).`
   plus a pointer to `changelog/releases/v1.20.0.md` for the
   detailed history. Loses some inline narrative, gains 36K
   of context budget. Confirm?

2. **`adaptive-learner-project-reference.md` future** — it's
   the original v0.0.0 planning artefact. Three options:
   - (a) **Keep + heavily extend** with a "Shipped architecture
     v1.20.0" section that diverges from the original plan.
     The original plan stays as a historical record.
   - (b) **Replace** with a fresh "Current architecture" doc.
     The original gets archived under
     `docs/historical/v0-planning.md`.
   - (c) **Delete** — every fact in it is now in CLAUDE.md +
     MkDocs + configuration.md.

   Recommend (a): keep history, extend with current state.

3. **MkDocs page-by-page rewrite vs holistic refresh**: the
   60-file scope is large. Two strategies:
   - (a) **Per-page targeted edits** — find stale assertions,
     fix them. Keeps surrounding prose untouched.
   - (b) **Full rewrites** for the most-stale pages
     (architecture, plugin-guide, storage-layer, settings)
     + per-page targeted edits for the rest.

   Recommend (b): the 4–5 heavily-stale pages need full
   rewrites; the rest can be surgical.

4. **i18n parity discipline** — every EN edit must have a
   matching DE edit. Confirm the existing rule: "MkDocs pages:
   DE and EN must stay in sync (identical structure, translated
   content)". I'll write EN first per page, then immediately
   write the DE counterpart. If a section is added on the EN
   side, the DE gets the equivalent German prose in the same
   commit.

5. **`docs/help/de/**` umlaut discipline** — the project rule
   says real umlauts (ä ö ü ß) in `docs/help/de/**/*.md`. I'll
   write proper German with real diacritics throughout.

**Recommended answers**: Q1 yes, Q2 (a), Q3 (b), Q4 confirmed,
Q5 confirmed. Awaiting your go/no-go before 35B.
