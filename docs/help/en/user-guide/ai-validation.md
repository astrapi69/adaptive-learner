# AI content check

Adaptive Learner can **optionally have an AI review** a downloaded
lesson set (EXP-033). The AI scans the set's cards for translation,
grammar and level issues and reports what it finds - it never
blocks anything, it only advises. Separately, repositories carry a
**trust level** you can read at a glance.

<!-- TODO: Screenshot - Content Browser, set card with the "Check with AI" button + "AI-Checked" badge -->

---

## Repository trust levels

Every lesson set shows a source badge with a trust level in the
Content Browser. It speaks to **provenance**, not to content
quality:

- **Trust 0 - not validated.** A newly connected repo whose
  automatic check has not (yet) passed.
- **Trust 1 - technically validated.** The repo contains at least
  one lesson and no executable code. The check re-runs on every
  sync.
- **Trust 3 - officially recommended.** A curated repo from the
  official recommendation list.

Community ratings (Trust 2) and a central index are not yet
implemented.

---

## Prerequisites for the AI check

The AI check calls an AI provider directly from the browser. You
need:

- a **stored API key** (Settings → Integrations) for one of the
  providers (Anthropic, OpenAI or Gemini);
- **browser mode** (Dexie) - the check runs browser-direct;
- a **downloaded set** (the check works on the locally cached
  cards).

Without a key the button is visible but disabled; a notice links
to Settings.

> **Cost:** the check spends tokens on your own provider account
> and is billed at that provider's rates. Before it starts, the
> dialog shows a **cost estimate** you must confirm.

---

## Check a set - step by step

1. Open the **Content Browser** and pick a downloaded set.
2. Click **"Check with AI"**.
3. The dialog shows a **cost estimate**. Confirm it to start the
   run.
4. The cards are checked in **batches**; a progress bar tracks it,
   and you can **cancel** at any time.
5. At the end you get a **per-card report**: only cards with a
   finding are listed, each with the lesson it belongs to and the
   AI's note.

There is a short **cooldown** between two runs (about one minute)
so you don't get billed twice by accident.

---

## Report, cache and the "AI-Checked" badge

- **Cached.** The report is stored locally (IndexedDB) and shown
  again next time without paying again. It carries a content hash
  + a signature, so a changed set suggests a fresh check.
- **Exportable.** You can download the report as **Markdown** -
  handy for pasting into a lesson revision or an issue.
- **Badge.** A checked set shows an **"AI-Checked"** badge in the
  Content Browser so you can see a check exists.

The AI is **advisory**: it highlights possible problems but never
prevents you from learning, editing or sharing a set. The call is
yours.

---

For how this works behind the scenes, see the developer docs on
[AI integration](../developer/ai-integration.md).
