# Content lessons and reviews

A **content lesson** is a small, hand-authored learning unit
(usually 5–10 minutes) downloaded from a public lesson set.
It runs in a dedicated viewer, not the AI chat session.
After the lesson the app remembers exactly which words,
pairs, or phrases you got wrong and schedules them for a
focused review session later.

Lessons are an **alternative path** to learning that
doesn't need an AI API key — perfect for trying the app or
for content where curated material beats free-form chat.

---

## Where lessons come from

Lessons live in **content sets** — small bundles published
to public GitHub repos. The app's **Set Browser** at
`/content` lists every available set; click one to download
it. The set is cached locally (in the filesystem if you run
with a backend, in IndexedDB in the browser-only deployment),
so you can study offline after the first download.

The pilot v1.27.0 set is **French A1** (2 lessons, 14 cards,
9 exercises covering all four exercise types). Every release
since adds more — see the
[set repo](https://github.com/astrapi69/adaptive-learner-content)
for the current catalog.

---

## The lesson flow

Open a set, pick a lesson, and the **lesson viewer** walks
you through each card and exercise step by step:

1. **Cards** present material to read. Click "Next" when
   ready.
2. **Exercises** check what you remember. Four types ship:
   - **Matching** — drag pairs (word ↔ translation).
   - **Picture choice** — pick the picture that matches a
     prompt.
   - **Free text** — type the answer.
   - **Word tiles** — assemble a sentence from tiles.

A progress bar at the top tracks how far through the lesson
you are. You can leave at any time — your progress is saved
per-step and resumes where you left off.

### The summary screen

When the last exercise completes, the **lesson summary**
appears:

- A **0–3 star rating** based on your score:
  - **3 stars** ≥ 90 % correct
  - **2 stars** ≥ 75 %
  - **1 star** ≥ 50 %
  - **0 stars** below 50 %
- A **per-exercise breakdown** showing which exercises you
  passed and which had mistakes (with the correct answer
  revealed for the wrong ones).
- **Next lesson**, **Repeat**, and **Back to set** buttons
  so the next action is one click away.

Hit 3 stars on your first attempt and the stars play a
small celebratory animation. (If you've turned on the OS
"reduce motion" setting, the animation respects that.)

---

## Element-level error tracking

Every wrong answer in every exercise type writes a row
keyed to the **specific element you missed** — the
individual word, pair, or phrase. The app does NOT just
remember "you scored 6/10 on lesson 3"; it remembers
"you struggled with *bonjour* and *merci* specifically".

Get the same element right **3 times in a row** and it
flips to **mastered** — removed from the review queue.
Get a mastered element wrong later and it **demotes back**
into the queue. A failed mastery is a forgotten mastery.

---

## The review queue

When you have one or more elements that need review, the
**Review queue card** appears on the Dashboard. It shows:

- How many elements are due
- How many are **overdue** (past their scheduled review
  date)
- A **Review now** button that opens a focused
  mini-session at `/review/:setId`

Scheduling uses three bands based on how many times you've
gotten the element right in a row:

| Correct streak | Next review |
|---|---|
| 0 | 1 day later |
| 1 | 3 days later |
| 2 | 7 days later |
| 3 (mastered) | removed from queue |

Within the queue, items sort: **overdue first**, then by
**error count descending**, then by **most-recent failure
first**. So the elements you struggle with the most rise
to the top.

---

## Review sessions

A review session at `/review/:setId` synthesises a
**mini-lesson on the fly** from the top items in your
queue. Mixed strategy as of **v1.35.0**:

- If you originally missed a word in a **matching** or
  **picture-choice** exercise, you'll re-do that exercise
  (with fresh shuffling, so it's not pure muscle memory).
- If you missed something in **free-text** or **word-tiles**,
  the review tries to generate a **cloze** ("fill the
  blank") that targets exactly the word you got wrong.
  Same knowledge in a different shape — your flexibility
  gets exercised, not just your recall of one specific
  exercise format.
- If cloze generation can't construct a clean blank for
  that item (e.g. the source prompt didn't carry the
  answer inline), the review silently falls back to
  replaying the original. You never see a broken or
  empty step.

When you finish a review session, the same scoring + star
rating + element-tracking machinery runs. Master 50
elements through reviews and you earn the **Review Master**
badge.

## Correction round at the end of every lesson

New in **v1.35.0**: when you finish a lesson that had any
wrong answers, the summary page shows a small **correction
round** between your score and the "Next lesson" button.
It picks up to five of your specific mistakes from this
lesson and offers each as a fresh cloze targeted at the
exact word or article you missed.

- **You can skip at any time.** The "Next lesson" button
  stays visible throughout — the correction round is opt-in
  practice, not a gate.
- **It only appears when there's something to correct.**
  Perfect-score lessons skip it entirely. Lessons whose
  mistakes can't be turned into a clean cloze (rare) also
  skip.
- **Each completed cloze counts toward mastery.** The
  correction round writes the same element-tracking rows
  as the main lesson; your streak on those specific
  elements advances toward the 3-correct mastery
  threshold.

A short "{n} elements improved" line surfaces at the end of
the round, so you can see the dent your extra practice made.

## Visual diff feedback

Also new in **v1.35.0**: wrong free-text and word-tiles
answers now show a **token-level diff** between what you
wrote and the canonical answer. Three colours, never just
colour-only:

- **Red strikethrough** — what you wrote that doesn't
  belong (with an × marker for screen readers and
  colourblind users).
- **Green** — what the canonical includes that you missed
  (with a + marker).
- **Amber** with an arrow → — a word you got slightly
  wrong, shown as `you-wrote` → `expected`.

The same diff appears on the lesson summary's per-exercise
breakdown rows for any free-text or word-tiles attempt the
v1.35.0+ store has the user-answer for.

---

## XP and badges

Each completed lesson earns XP under a per-star formula:

- **30 XP** base
- **+10 XP per star** earned (0 → 0, 1 → +10, 2 → +20, 3 → +30)
- **+20 XP bonus** if you earn 3 stars on the first attempt
  (every step at attempts = 1, no retries)
- The same **daily-streak multiplier** as chat sessions
  (+25 % per consecutive day of activity, capped at 7 days)

Four new badges unlock around lessons:

- **First Lesson** — complete your first content lesson.
- **10 Lessons Completed** — complete 10 content lessons.
- **3-Star Streak** — earn 3 stars on three lessons in a
  row.
- **Review Master** — master 50 elements through spaced
  repetition.

Lesson completions also count toward your **daily streak**,
so studying with content lessons fills the heatmap the
same way chat sessions do.

---

## Storage modes

Lessons work in **both** storage modes — API (backend) and
Dexie (browser-only / GitHub Pages). Element-level error
tracking and SRS scheduling run identically against
IndexedDB in the browser-only deployment, so users who
visit the public GitHub Pages site get the full review
loop without a backend.

What's *different* in browser-only mode: the XP-award /
badge-earn side effects fire only in API mode (they need
the backend's gamification hooks). In Dexie mode you still
earn XP and badges via the chat session path; the lesson
completion just doesn't add to that total yet.

---

## Privacy

All lesson progress, element-error rows, review-queue
state, and scheduling data stay **on your own device** in
API mode (filesystem) or browser (IndexedDB). Nothing about
which words you struggle with is sent anywhere.
