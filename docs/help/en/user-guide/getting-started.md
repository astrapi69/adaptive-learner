# Getting started

Adaptive Learner is a learning companion built on a research-backed
six-method model. You take a short assessment to discover which
methods suit you best, then run AI-supported sessions through a
seven-step cycle. The app learns with you and adapts how it
teaches.

## Try it now

The fastest way to try Adaptive Learner is the public deployment:

[**Open the live app**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

This runs in **Local mode** — all your data stays in your browser
(IndexedDB), and AI calls fire directly from the page to
Anthropic, OpenAI, or Google Gemini using your own API key. No
backend involved.

## Install as a Progressive Web App

Adaptive Learner is installable. On modern browsers you'll see an
"Install" or "Add to home screen" prompt the first time you open
the site. Accept it and Adaptive Learner becomes a standalone app
on your phone or desktop, launchable without a browser tab.

The app also works offline for the Dashboard and past sessions.
New AI sessions still need internet because the AI provider lives
outside the browser.

## What you need

- **A modern browser** (Chrome 100+, Firefox 100+, Safari 17+,
  Edge 100+). The app uses IndexedDB, service workers, and
  modern JavaScript.
- **An AI API key** for at least one of the supported providers
  (Anthropic, OpenAI, or Google Gemini). Free tiers are usually
  enough to get started; see [Settings](settings.md) for how to
  add a key.

## First five minutes

1. **Open the app** and pick your language. All 8 UI languages
   are fully translated (DE, EN, ES, FR, EL, PT, TR, JA).
2. **Onboard your learning project**: topic, goal, timeframe,
   minutes per day, plus optional subject taxonomy and tags.
   See [Onboarding](onboarding.md).
3. **Take the 12-question assessment** so the app knows which
   learning methods to lean on. Swipe left/right between
   questions on mobile. See [Assessment](assessment.md).
4. **Add your AI API key** in Settings, OR drop it into
   `~/.config/adaptive-learner/secrets.yaml` if you run the
   desktop launcher. The Settings UI shows which layer your
   key came from.
5. **Start your first session**. The Dashboard's "Start session"
   button drops you into a learning conversation. AI replies
   stream token-by-token; the dual-prompt evaluator decides
   each cycle step. See [Learning session](learning-session.md).

## Where to go next

- [The 7-step learning cycle explained](learning-session.md)
- [Reading your Dashboard](dashboard.md)
- [FAQ — common questions](faq.md)
- [The pedagogical concept behind the app](../concept/philosophy.md)
