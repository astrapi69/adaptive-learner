# FAQ

## Is my data safe?

In **Local mode** all your data lives in IndexedDB on your own
device. No backend, no third-party service. Closing the
browser tab doesn't delete it; clearing site data does. If you
share the device, anyone with access to this browser profile
can read it.

In **Server mode** the data lives in the SQLite database the
FastAPI backend manages. API keys are encrypted at rest with
Fernet using a secret you set via the
`ADAPTIVE_LEARNER_SECRET_KEY` environment variable, or via
`secret_key:` in `~/.config/adaptive-learner/secrets.yaml`.

Neither mode sends telemetry, analytics, or your messages to
any third party other than the AI provider you've chosen — and
that one only sees the message content you'd expect (system
prompt + your text + the AI's prior responses in the session).

## Do I need an API key?

Yes for AI sessions. The app uses **bring-your-own-key** for
all three supported providers: Anthropic Claude, OpenAI GPT,
Google Gemini. Free-tier limits are usually enough to get
started.

Three places to put the key (highest priority wins): an
`ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` env var, the
`ai.<provider>.api_key` field in
`~/.config/adaptive-learner/secrets.yaml`, or the Settings UI.
The UI shows the per-provider source so you always know where
your key came from.

You can browse the Curriculum, take the Assessment, view your
Dashboard, and even run the chat-history Import without an
API key. The Session page + the analysis step + the
AI-extraction features are the ones that need a key.

## Can I use it offline?

Partially. The PWA service worker caches the static assets
(HTML, JS, CSS, icons) so the app launches without internet.
Past sessions and Dashboard data load from local storage too,
so reading old material works fine.

**Live sessions still need internet** because the AI provider
sits outside your browser. The Session page detects "offline"
and shows a clear inline message rather than failing
silently.

## What does the method switch mean?

When three sessions in a row show your understanding stagnant
AND your stress high, the app surfaces a banner: "Want to try
[other method] for the next session?". The recommendation
prefers your second-strongest method from the assessment that
you haven't used recently.

It's a *suggestion*, not an order. You can dismiss the banner
and continue with your current method; the banner reappears if
the stagnation pattern continues. Method switches are
recorded in the `method_switches` table and surface in the
Progress page distribution.

## What is auto-loop?

When a session reaches step 7 (Integrate) and the
topic-transition evaluator judges the topic integrated AND
recommends continuing, a fresh cycle starts automatically
with a new subtopic. Up to 5 cycles per session (runaway
protection). The chat history renders dashed-border "Cycle N"
cards at each transition. The end-of-session rating dialog
summarises the multi-cycle journey when `cycle_count > 1`.

## Can I export my data?

Yes. Three export paths shipped:

- **Backup**: Settings → Backup → Create Backup. Downloads a
  timestamped JSON with every row from your account. API keys
  are stripped. Works in both storage modes.
- **Progress / Session / Curriculum reports**: Settings →
  Export. Markdown + PDF (browser print-to-PDF).
- **Anki .apkg**: review AI-extracted flashcards on the
  `/anki` page, accept the ones you like, click Export. The
  file works directly in Anki desktop.
- **NotebookLM ZIP**: from the Progress page, download a
  structured ZIP (summary + vocabulary + rules + errors +
  flashcards + sessions) formatted for NotebookLM's source
  upload.

## What's the voice feature?

Three Web Speech API integrations:

- **Text-to-Speech** on AI replies + Assessment results — a
  ▶ button next to each speaks it aloud, language-matched.
- **Speech-to-Text** on the Session input — a 🎤 button
  captures your voice and populates the textarea with
  interim transcripts before send.
- **Pronunciation Practice** for language projects — visit
  `/pronunciation`, the AI generates a target phrase, you
  speak, and a judge AI scores similarity + suggests
  improvements.

Voice toggles live in Settings → Voice. The section hides
itself in browsers that don't support the API.

## What's the chat-history import?

The Import page (`/import`) accepts pasted or uploaded chat
transcripts from ChatGPT, Claude.ai (both JSON bulk export
and single-conversation Markdown export), Gemini, and
arbitrary Markdown. The analyzer extracts your topic,
weaknesses, error patterns, recommended method, vocabulary
(for language conversations), and a suggested curriculum.
One click seeds a Curriculum + starts a targeted session
from the analysis.

The Claude.ai per-conversation Markdown export is a
validated import case — the parser ships with full timestamp
extraction + role boundary preservation for that format.

## Sync between devices?

Local-network bidirectional sync. Settings →
Sync → "Pair this device": scan the QR code on the other
device's screen (rear camera), or paste the pairing URL.
Once paired, push + pull buttons exchange data; conflicts
go through an AI-merge resolver. 30 tables on the sync
surface (incl. lesson progress, element errors, and
missions).

## How is this different from ChatGPT?

ChatGPT is a chat interface to a single model. Adaptive
Learner is a *structured learning system* that uses an AI
under the hood but adds:

1. **A 6-method × 7-step matrix** of bespoke system prompts.
2. **Per-turn step evaluation** — a second AI call judges
   readiness and may move you forward / back.
3. **Auto-loop into new cycles** when the topic is
   integrated.
4. **A profile** of your learning preferences from the
   12-question assessment.
5. **Long-term tracking** — ProgressCommits, streak heatmap,
   XP, badges, time-per-step charts. ChatGPT forgets when
   you close the tab.
6. **Provider freedom** — Anthropic, OpenAI, or Gemini.
7. **Local-first option** — everything in your browser,
   nothing sent to a server (except your AI calls).

## What if the AI goes wrong?

The system fails visibly:

- **Wrong API key**: the AI call returns a clear error
  message, surfaced inline in the chat.
- **Provider down**: same — the error renders the HTTP
  status from the provider's API.
- **JSON parse failure from the evaluator**: a deterministic
  +1 advance kicks in (capped at step 7), with
  `fallback_used: true` recorded so a future audit can spot
  models that struggle with the format.
- **Streaming aborted mid-response**: the partial reply is
  saved; the next message picks up from there.
- **Stale or weird AI response**: end the session, give it a
  low rating, retake. The method-switch heuristic will
  surface a different method if the pattern persists.
