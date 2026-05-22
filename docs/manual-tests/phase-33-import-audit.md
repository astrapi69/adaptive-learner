# Phase 33 — Import + Analysis Audit

Date: 2026-05-22. Tester: Claude Code (CLI session) + manual
follow-up by Aster for browser-driven steps. The pre-flight
baseline at session start was:

- Backend pytest: 765 tests green
- 10 plugins (assessment / ai-anthropic / ai-openai / ai-gemini
  / session / tracking / tools / gamification / anki / notebooklm):
  615 tests green (110+34+31+33+215+64+58+23+20+27)
- Frontend Vitest: 1167 tests across 108 files green (1179 after
  this audit landed its +12 regression-pins)
- Frontend `npm run build`: green (1.71MB main bundle, PWA
  precaches 48 entries)

## Source artefact

Anonymized fixture committed at
[frontend/src/chat_import/__fixtures__/claude-markdown-export.md](../../frontend/src/chat_import/__fixtures__/claude-markdown-export.md).

Raw input: a real **Claude.ai per-conversation Markdown export**
(`tmp/Claude-Grammatik mit adaptivem Lernprotokoll.md`, kept out
of git via `.gitignore`). 73 KB, 1808 lines, 25 user turns + 25
assistant responses, German + English mixed, multiple `plaintext`
code-fenced tool/thought blocks. Topic: applying an adaptive
learning protocol to German grammar (commas, cases, Konjunktiv,
syntax, das/dass).

Anonymizer at
[scripts/anonymize_chat_export.py](../../scripts/anonymize_chat_export.py).
Scrubs first name ("Aster" → "TestUser"), cross-chat references
(Docker / Ansible / Skills sessions → generic terms), and the
Claude.ai chat URL UUID. Leaves grammar exercises + answers
+ timestamps intact.

## Part A — Import deep test

### A1 Parser validation — Vitest pinned

New audit suite at
[frontend/src/chat_import/claude_markdown_export.audit.test.ts](../../frontend/src/chat_import/claude_markdown_export.audit.test.ts)
runs every parser against the fixture:

| Path                            | Outcome                                 |
|---------------------------------|-----------------------------------------|
| `detectFormat()`                | returns `"markdown"`                    |
| `parseChatImport(auto)`         | 1 conversation, **1 user message of 72,747 chars** |
| `parseChatImport(markdown)`     | identical to auto                       |
| `parseChatImport(claude)`       | throws — Claude parser expects JSON     |
| `parseChatImport(chatgpt)`      | throws — ChatGPT parser expects JSON    |
| `parseChatImport(generic)`      | throws — Generic parser expects JSON    |

**Expected**: 25 user + 25 assistant messages, timestamps
preserved, `source="claude"`. **Actual**: 1 user message
containing the verbatim file, no warning.

Root cause: the Claude.ai single-chat Markdown export uses
`## Prompt:` / `## Response:` headers as turn markers. The
markdown_parser's `recogniseMarker()` strips the trailing colon
and runs `classifyName()` against fixed allowlists:

- USER_MARKERS = `["you", "user", "human", "me", "learner",
  "student", "frage", "ich", "du", "benutzer"]`
- ASSISTANT_MARKERS = `["assistant", "chatgpt", "claude",
  "gemini", "ai", "bot", "model", "antwort", "ki"]`

"prompt" is not in either, "response" is not in either, so
both headers are silently rejected and the whole file falls
into the no-markers-found branch → "one big user message".

Filed as **BL-25** (P0) below.

### A2 / A3 — Analysis (API mode + Dexie mode)

Code path inspected:
[frontend/src/chat_import/analysis.ts](../../frontend/src/chat_import/analysis.ts).
Same module runs in both modes (browser-direct AI call); the
only difference is which IndexedDB the persisted result lands
in.

**Schema actually returned** (per
[frontend/src/types/domain.ts:505-526](../../frontend/src/types/domain.ts#L505-L526)):

```
topic, subtopics, user_level, strengths, weaknesses,
error_patterns, recommended_method, recommended_focus,
suggested_curriculum, summary, chunk_summaries, fallback_used,
vocabulary
```

**Schema asked-for in the SYSTEM_PROMPT** (analysis.ts:56-125):

```
topic, subtopics, user_level, strengths, weaknesses,
error_patterns, recommended_method, recommended_focus,
suggested_curriculum, summary
```

**Schema read by `parseAnalysisResponse`** (analysis.ts:246-280):
the same 10 fields as the system prompt — `vocabulary` is **not
read** even if the model emits it.

**Schema consumed by downstream features**: the NotebookLM ZIP
exporter ([lib/export/notebooklm-package.ts:312-323](../../frontend/src/lib/export/notebooklm-package.ts#L312-L323))
and the Dexie-mode Anki "vocabulary path"
([storage/anki.ts:222-246](../../frontend/src/storage/anki.ts#L222-L246))
both read `analysis_result.vocabulary`. Because nothing populates
it, **both features are dead-code in practice unless the AI
happens to emit `vocabulary` unprompted AND the parser is
extended to read it**. Filed as **BL-27** (P1) below.

Because Part A1's parser hands the analyzer a single 72,747-char
"user message", the chunker
([analysis.ts:166-192](../../frontend/src/chat_import/analysis.ts#L166-L192))
would split it into ~5 chunks at the 16K-char threshold. Each
chunk would receive an opaque text blob with no role information
— the analyzer cannot tell user errors from AI corrections
because everything reads as "Learner:" in
`buildAnalysisUserContent`. **Analysis quality on Claude.ai
Markdown imports is therefore degraded even without BL-27.**
BL-25 must land first; analysis-quality testing is blocked on
it.

A real end-to-end provider call to validate field relevance
requires API keys + network, which the CLI session can't drive
safely. **Aster to run manually** with the steps in Part B
section B7.

### A4 / A5 — Curriculum + Session from analysis

Same upstream block: until BL-25 lands, the analyzer receives no
role structure and the suggested_curriculum it produces will be
generic, not error-targeted. Pinning A4 + A5 is therefore also
blocked on BL-25.

Manual verification path is documented in Part B sections B7
and B8.

### A6 — Edge cases (all PASS in current code)

All pinned in the new audit suite:

| Edge case                          | Result                                                 |
|------------------------------------|--------------------------------------------------------|
| Empty / whitespace-only input      | throws `ChatImportParseError` cleanly                  |
| User-only (3 `**You:**` turns)     | 3 user messages preserved                              |
| Large (1000 alternating turns)     | parses in well under a second, no overflow             |
| Mixed German role markers          | "Ich:" / "KI:" / "Frage:" / "Antwort:" all recognized  |
| Code blocks in messages            | preserved verbatim including fences and code body      |
| Non-chat JSON (random shape)       | falls back to markdown → single user message           |

The one edge case that does NOT pass — Claude.ai per-chat
Markdown export — is documented as BL-25 + BL-26.

## Part B — Full user journey (manual, browser-driven)

The CLI session cannot drive the browser. The following plan is
written for Aster to execute step-by-step. Each step records
expected behaviour; any deviation gets a backlog entry.

### Setup

```bash
make dev  # backend on 18001, frontend on 15174
```

In a fresh browser profile (so prior localStorage doesn't taint
the test): open <http://localhost:15174>.

### B1 — First visit (clean state)

- Landing page renders, language selector visible
- Switch to German: every UI string updates with **real umlauts**
  (ä, ö, ü, ß — not ae, oe, ue, ss; per the
  `.claude/rules/lessons-learned.md` German-content discipline)
- Switch back to English; verify symmetry

### B2 — Onboarding

- Click Start → Onboarding
- Topic: "Spanish Grammar" — subject auto-suggester should
  surface Languages → Spanish → Grammar
- Goal: "Pass B2 exam"
- Timeframe: "3 months", 30 min/day
- Problem: "I confuse ser and estar"
- Add tags: "exam-prep", "daily"
- Submit → redirected to Assessment
- Repeat with "Skip/Later" → creates default user + lands on
  Dashboard

### B3 — Assessment

- Answer all 12 questions (mix of radio + checkbox)
- Verify progress bar advances
- Swipe left/right between questions on a touch device or
  Chrome DevTools mobile emulation
- Submit → profile radar appears
- Verify the dominant method aligns with the answer pattern
- Auto-redirect to Dashboard

### B4 — Dashboard widgets

- Profile Radar (6 axes)
- Session Counter (sessions, minutes, streak, avg understanding,
  avg stress)
- Recent Sessions (empty after fresh assessment)
- Method Distribution (empty after fresh assessment)
- Spaced Repetition card
- Quick Start CTA (suggests method from profile)
- Subject/Tag filter bar
- XP widget shows non-zero (initial XP from assessment completion)
- Badge notification: "First Assessment" badge earned (toast +
  badge tile)

### B5 — Settings

- API Key: enter Anthropic key → "saved" confirmation, key
  redacted in subsequent renders
- Provider: select Anthropic → highlighted as active
- Model: model picker loads real models via the discovery API
  (or falls back to the static list when offline)
- Storage Mode: current mode shown; switching toasts a reload
  notice
- Language: switch → UI updates
- Voice: TTS / STT toggles work when browser supports them
- Gamification: XP / badge notification toggles persist
- Backup: export button downloads `.json`; key fields scrubbed
- Sync: pairing section renders QR + paste-link surfaces
- About: 5 sections render (version / system / credits /
  donations / license)

### B6 — First learning session

- Dashboard → Quick Start
- Method selected based on profile
- Session header: `<Provider>: <Model name>` with model id + ctx
  window in tooltip
- CycleProgress shows step 1 (Input)
- Send: "Teach me about ser and estar"
- AI streams tokens (cursor ▍ visible)
- CycleProgress advances after each turn
- At step 7: auto-loop transition card appears (if cycle ≥1)
- End session → Rating dialog (1-5 understanding, 1-5 stress,
  1-5 method-fit, optional rich-text note)
- Submit → XP toast + dashboard updates

### B7 — Import + analysis (THIS IS THE CRITICAL ONE)

After API mode is configured with a valid Anthropic / OpenAI /
Gemini key:

- Navigate to `/import`
- Paste the contents of
  [frontend/src/chat_import/__fixtures__/claude-markdown-export.md](../../frontend/src/chat_import/__fixtures__/claude-markdown-export.md)
  (or upload it as a file)
- Enter topic: "German grammar"
- Click Analyze
- **Today's expected outcome (with BL-25 unfixed):** the
  parser will hand the analyzer a single 72,747-char "user
  message". The AI receives a transcript with everything
  labelled "Learner:" and no role boundaries. The resulting
  analysis will be GENERIC ("user is learning German grammar")
  instead of specific ("user confused 'obwohl' as not needing
  a preceding comma; missed exactly one comma in 5 diagnostic
  tasks; explicit-vs-implicit knowledge gap identified by the
  assistant"). Note in the audit log how close the analysis
  gets to the real grammar gaps surfaced in the actual
  transcript.
- **Post-fix expected outcome (BL-25 + BL-26 landed):** the
  analyzer sees 50 alternating turns. Topic, weaknesses,
  error_patterns, suggested_curriculum should all be concrete
  (e.g. weakness mentioning "Komma vor 'obwohl'", curriculum
  including a Konjunktiv-II drill).
- Click "Create Curriculum": verify the topic + topic tree +
  lessons are seeded from the analysis fields.
- Click "Start Session": verify the system prompt the AI
  receives carries the identified gaps (BL-25 / BL-26 may also
  block this path)
- Switch to Dexie mode and repeat: A3 verification. Expect the
  same parsing bug to surface and the same downstream blocks.

### B8 — Curriculum + topics

- Navigate to `/curriculum`
- Curriculum from B7 exists
- Add a subtopic manually
- Add a lesson with rich-text content (code block, bold)
- Reorder topics by drag or swipe-to-reveal on mobile
- Delete a topic → children should be detached, NOT cascade-
  deleted
- Export curriculum as Markdown → verify shape

### B9 — Progress tracking

- Navigate to `/progress`
- Charts populate from the B6 session
- Commit history shows the session
- Step-evaluation insights (longest steps highlighted)
- Export progress report as PDF → verify shape

### B10 — Backup + restore

- Settings → Backup → Export
- JSON downloads; structure contains every model table; **NO
  api_key fields** present
- Restore via "Compare Backups" + the diff preview
- Same-file diff: shows "0 changes"

### B11 — Mobile (if device available)

- Run B2–B6 on a phone (or DevTools mobile emulation)
- Responsive layout, hamburger menu, 44px touch targets
- Install prompt appears

### B12 — Anki export

- Navigate to `/anki` after sessions exist
- AI-suggested cards from sessions render
- Accept some cards
- Export `.apkg` → file downloads, ~1MB
- Open in Anki desktop → cards render correctly
- Vocabulary-path test (BL-27 dependency): set up a language
  project, import the fixture, analyze, click "Extract Anki
  cards from this conversation". **Today's expected outcome:**
  in Dexie mode, throws 400 "No vocabulary found" because the
  analysis prompt doesn't ask for vocabulary. In API mode, same
  result unless the AI happened to emit vocabulary unprompted
  (which the parser drops anyway).

### B13 — Voice

- Click TTS button on AI response → reads aloud (Web Speech API)
- Mic button → speak → interim transcript populates textarea
- Pronunciation Practice (language project only): generate
  phrase → speak → judge

### B14 — NotebookLM export

- Export study package as ZIP
- Verify ZIP contents: `summary.md`, `vocabulary.md`,
  `rules.md`, `errors.md`, `flashcards.md`, `sessions/*.md`
- `vocabulary.md` will likely be empty (BL-27 dependency)

## Part C — Bug findings

Filed in [docs/backlog.md](../backlog.md). Severity ordering:

| ID    | Title                                                  | Severity | Mode      |
|-------|--------------------------------------------------------|----------|-----------|
| BL-25 | Claude.ai .md export collapses to 1 user message       | P0       | API+Dexie |
| BL-26 | markdown_parser allowlist missing prompt/response      | P0       | API+Dexie |
| BL-27 | `vocabulary` field spec/code drift (asked-vs-read-vs-consumed) | P1 | API+Dexie |
| BL-28 | source-stamping for Claude .md exports (`source="claude"` instead of `"manual"`) | P3 | n/a |

## Reproducibility

```bash
# Run the audit suite on its own
cd frontend && npx vitest run src/chat_import/claude_markdown_export.audit.test.ts

# Full vitest run
cd frontend && npm test -- --run

# Full make test
make test
```

## Open questions to surface for Aster

1. **BL-25 fix scope** — minimal patch is "add `prompt` to
   USER_MARKERS and `response` to ASSISTANT_MARKERS", but Claude
   .md exports also carry per-turn timestamps in a follow-up
   line ("23.3.2026, 08:53:41"). Should the parser extract those
   into `message.timestamp` as well? Recommend yes for a proper
   fix, but the bare allowlist patch closes the core symptom.
2. **BL-27 fix scope** — extend SYSTEM_PROMPT to ask for
   vocabulary on language-learning topics only (auto-detect
   from `topic` field?), and extend `parseAnalysisResponse` to
   read it. Or keep vocabulary as a separate AI call only fired
   from the Anki page. Recommend extending the prompt; the
   types + downstream consumers are already in place.
3. **Anonymizer durability** — the current scrubber is a fixed
   wordlist. If a future export contains other proper names or
   personal references, the audit fixture will need a manual
   re-anonymize pass. Not a code bug, just a process note.
