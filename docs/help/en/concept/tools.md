# Tools: the three pillars

AdaptiveLearner doesn't try to be your only learning tool.
It tries to be the orchestrator that points you at the right
external tool for what you're doing right now. Five tools
ship in the catalogue, mapped to three pillars.

## The three pillars

### 1. Spaced repetition

The cognitive science is settled: spaced review beats massed
review for long-term retention. The interval between reviews
matters; tools like Anki turn this into a discipline.

**Recommended tool**: [Anki](https://apps.ankiweb.net/).
Free on desktop, paid on iOS, the schedule algorithm is
well-tuned, and it's the de-facto standard. Most other apps
in this space copy Anki's intervals.

**Use it for**: anything that has to be remembered long-
term. Vocabulary, formulas, named entities, error-correction
recipes. AdaptiveLearner sessions are great for
understanding; Anki is great for not forgetting.

The Adaptive Learner profile weights "deductive" and
"error_based" most strongly toward Anki, since both methods
produce material that's worth carding.

### 2. Active recall from your own sources

The second pillar is building knowledge from documents you
provide. Modern tools let you upload PDFs, notes, transcripts
and then quiz yourself or ask questions grounded in that
specific corpus.

**Recommended tool**: [NotebookLM](https://notebooklm.google.com/).
Google's tool that turns your sources into an interactive
knowledge graph. Better than ChatGPT for this purpose
because the AI's answers are anchored in your provided
documents.

**Also useful**:
[Excalidraw](https://excalidraw.com/) for sketching out the
structure of your knowledge,
[Obsidian](https://obsidian.md/) for linked-notes
knowledge graphs that grow over months.

**Use it for**: domain-specific learning where you have
existing material (research papers, internal docs, course
slides) and want to extract knowledge structure from it.

### 3. Adaptive AI prompts

The third pillar is direct AI access for one-off questions
that don't fit the other two pillars. Sometimes you just
need an explanation. Sometimes you want to brainstorm.

**Recommended tool**:
[Claude](https://claude.ai/),
[ChatGPT](https://chat.openai.com/), or
[Gemini](https://gemini.google.com/). AdaptiveLearner uses
the same APIs internally; you can also talk to them directly
in their web UIs for less-structured exploration.

**Use it for**: open-ended questions, brainstorming, "explain
this paragraph", "give me three different framings of this
problem". The unstructured chat shines for divergent
thinking; AdaptiveLearner sessions shine for focused
convergent practice.

## How AdaptiveLearner ranks tools

The Dashboard's Tool Recommendations card runs a simple
scoring:

```
score(tool) = sum(profile_weight[k] for k in tool.weight_keys)
```

Each tool declares which 1-2 method axes it best serves:

| Tool | Weight keys | Why |
|---|---|---|
| Anki | deductive, error_based | Cards encode rules + corrections |
| NotebookLM | inductive, contextual | Examples + situated material |
| Adaptive AI Prompt | ai_adaptive, dialogic | Adaptive conversation |
| Excalidraw | contextual, inductive | Visual structure from examples |
| Obsidian | deductive, inductive | Theory + examples in one graph |

Profile weights from your assessment are summed across each
tool's weight_keys, and the ranked list is what the
Dashboard surfaces. The ranking updates whenever your
profile changes (re-evaluating the assessment).

## Spaced recommendations

A second tracking surface on the Dashboard: the
**Spaced** card. This is NOT tool recommendations; it's
action recommendations. The system tracks how long it's
been since you last had a session in each method, then
suggests:

| Time since last commit | Card kind | Interval |
|---|---|---|
| Never | first | 1 day |
| > 14 days | refresh | 1 day |
| 7-14 days | review | 3 days |
| 3-7 days | practice | 7 days |
| < 3 days | maintain | 14 days |

So a method you haven't touched in two weeks gets a
"Refresh in 1 day" card. A method you used yesterday gets
"Maintain in 14 days" (or doesn't surface at all because the
list is capped to 5).

The cards are sorted by urgency (lower interval × stronger
weight = higher priority). You don't have to follow them —
they're nudges, not commands.

## First-class shipped integrations (since v1.17.0)

Three tools moved from "external recommendation" to
"built-in export" between v1.17.0 and v1.20.0:

- **Anki .apkg export** (v1.17.0 / Phase 30) — review
  AI-extracted flashcards on the `/anki` page, accept the
  ones you want, click Export. The `.apkg` is built
  client-side via sql.js + JSZip and works directly in
  Anki desktop. No manual handoff.
- **NotebookLM ZIP package** (v1.19.0 / Phase 32) —
  Progress page → Download study package. The ZIP contains
  `summary.md`, `vocabulary.md`, `rules.md`, `errors.md`,
  `flashcards.md`, and `sessions/*.md` formatted for
  NotebookLM's source upload. NotebookLM has no public API,
  so this is the next-best path.
- **Voice (TTS + STT + Pronunciation Practice)** (v1.18.0 /
  Phase 31) — Web Speech API integrations directly in the
  Session + Assessment + a dedicated `/pronunciation` page
  for language projects. No external tool needed.

## What's NOT in the catalogue

Deliberately excluded:

- **Duolingo / Babbel / similar gamified apps** — they
  conflict with the philosophy. Adaptive Learner does ship
  XP + badges + streaks (v1.16.0), but as a motivational
  layer over un-gamified content, not as the primary loop.
- **Khan Academy / Coursera** — they're course-completion
  oriented, not skill-acquisition oriented. Different
  problem space.
- **Memrise** — too close to Anki; the catalogue keeps one
  tool per niche.
- **Notion** — overkill for the "linked notes" niche;
  Obsidian fits cleanly without a cloud lock-in.

The catalogue is small on purpose. Adding more would dilute
the signal.
