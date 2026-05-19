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
`ADAPTIVE_LEARNER_SECRET_KEY` environment variable.

Neither mode sends telemetry, analytics, or your messages to
any third party other than the AI provider you've chosen — and
that one only sees the message content you'd expect (system
prompt + your text + the AI's prior responses in the session).

## Do I need an API key?

Yes for AI sessions. The app uses **bring-your-own-key** for
all three supported providers: Anthropic Claude, OpenAI GPT,
Google Gemini. Free-tier limits on each provider are usually
enough for a few sessions a day; if you go heavier, paid tiers
unlock higher quotas.

You can browse the Curriculum, take the Assessment, and view
your Dashboard without an API key. The Session page is the
only feature that needs one, because it's the one that calls
the AI.

## Can I use it offline?

Partially. The PWA service worker caches the static assets
(HTML, JS, CSS, icons) so the app launches without internet.
Past sessions and Dashboard data load from local storage too,
so reading old material works fine.

**Live sessions still need internet** because the AI provider
sits outside your browser. The Session page detects "offline"
and shows a clear inline message rather than failing
silently when you start a new session without a connection.

## What does the method switch mean?

When three sessions in a row show your understanding stagnant
AND your stress high, the app surfaces a banner: "Want to try
[other method] for the next session?". The recommendation
prefers your second-strongest method from the assessment that
you haven't used recently.

It's a *suggestion*, not an order. You can dismiss the banner
and continue with your current method; the banner reappears if
the stagnation pattern continues.

## How is this different from ChatGPT?

ChatGPT is a chat interface to a single model. Adaptive
Learner is a *structured learning system* that uses an AI
under the hood but adds five things:

1. **A 6-method × 7-step matrix** of bespoke system prompts.
   The AI behaves very differently as a deductive Input
   companion vs a contextual Integrate companion.
2. **Per-turn step evaluation** — a second AI call judges
   whether you're ready to advance and may suggest moving
   forward, repeating, or going back.
3. **A profile** of your learning preferences, picked up from
   a 12-question assessment, that shapes which method the
   sessions start in.
4. **Long-term tracking** — ProgressCommits, streak days,
   per-method distribution, time-per-step charts. ChatGPT
   forgets the moment you close the tab.
5. **Provider freedom** — pick Anthropic, OpenAI, or Gemini.
   Adaptive Learner is the orchestration; the model is your
   choice.

## What if the AI goes wrong?

The system is designed to fail visibly:

- **Wrong API key**: the AI call returns a clear error
  message, surfaced inline in the chat.
- **Provider down**: same — the error rendering surfaces the
  HTTP status from the provider's API.
- **JSON parse failure from the evaluator**: a deterministic
  +1 advance kicks in (capped at step 7), with
  `fallback_used: true` recorded so a future audit can spot
  models that struggle with the format.
- **Stale or weird AI response**: end the session, give it a
  low rating, retake. The method-switch heuristic will
  surface a different method if the pattern persists.

## Can I export my data?

In v0.7.0 export isn't a first-class button yet. In Local
mode you can read the raw rows via the browser's IndexedDB
inspector (Chrome DevTools > Application > IndexedDB >
adaptive-learner). In Server mode you can query the SQLite
database directly (it's a single file, no special tools
needed).

Proper export / backup / restore is a known follow-up.
