# Content lessons and reviews

A **content lesson** is a small, handcrafted learning unit
(usually 5-10 minutes) downloaded from a public lesson set. It
runs in its own viewer, not in the AI chat session. After the
lesson, the app remembers exactly which words, pairs or phrases
you answered incorrectly, and schedules them for a focused review
session later.

Lessons are an **alternative learning path** that needs no AI API
key — ideal for trying out the app or for content where curated
material works better than free chat.

---

## Where lessons come from

Lessons live in **content sets** — small bundles published in
public GitHub repos. The **set browser** at `/content` lists every
available set; click one to download it. The set is cached locally
(in the filesystem when running with a backend, in IndexedDB in
browser-only mode), so you can learn offline after the first
download.

The pilot set from v1.27.0 is **French A1** (2 lessons, 14 cards,
9 exercises covering all four exercise types). Every release since
adds more — see the
[set repo](https://github.com/astrapi69/adaptive-learner-content)
for the current catalog.

---

## The lesson flow

Open a set, choose a lesson, and the **lesson viewer** guides you
step by step through each card and exercise:

1. **Cards** present material to read. Click "Next" when you are
   ready.
2. **Exercises** test what you remembered. Four types are
   available:
   - **Matching** — drag pairs (word ↔ translation). Both tiles of
     a found pair share a **distinct color** and a **number
     badge**, so the pairing is recognizable in a colorblind-safe
     way (not by color alone).
   - **Picture choice** — pick the image that matches the prompt.
   - **Free text** — type the answer.
   - **Word tiles** — assemble a sentence from tiles.
   - **Cloze** — fill a gap in the sentence (generated
     specifically from your mistakes, see below).

A progress bar at the top tracks how far you are in the lesson.
You can stop at any time — your progress is saved per step and
resumes where you left off.

### Enter shortcut

You can operate the whole lesson via the keyboard: **Enter**
checks an answered exercise and then advances to the next step;
free-text and cloze fields submit on Enter (no newline). Controls
that need Enter themselves keep priority. The shortcut is
toggleable in **Settings → Learning** (on by default) and also
applies in Error Replay ("Repeat mistakes").

### Example and theory links

- **View example:** A theory step can carry an optional link to a
  detailed example, shown as a "View example" button.
- **Re-read theory:** An exercise shows a subtle link to the
  nearest preceding theory; from there, "Back to exercise" returns
  you to the task. This lets you look up a rule without losing your
  thread.

### The summary

When the last exercise is complete, the **lesson summary**
appears:

- A **star rating from 0-3** based on your result:
  - **3 stars** ≥ 90% correct
  - **2 stars** ≥ 75%
  - **1 star** ≥ 50%
  - **0 stars** below 50%
- An **exercise-by-exercise breakdown** that shows which exercises
  you passed and which contained mistakes (with the correct answer
  for the wrong ones).
- **Next lesson**, **Retry** and **Back to set** as buttons, so
  the next action is one click away.

If you get 3 stars on the first attempt, a small celebration
animation plays. (If you have the OS setting "reduce motion"
enabled, the animation respects that.)

### Exporting the result

The summary offers **"Copy result"** and **"Save as file"**. Both
produce a **Markdown report** with your score, a mistake-by-mistake
breakdown (your answer + the correct answer) and the still-weak
areas. The report is suitable for pasting into an AI assistant
that can help you specifically. The export is a pure builder with
no backend and works in both storage modes.

---

## Element-level error tracking

Every wrong answer in every exercise type writes a row that points
to the **specific element you missed** — the single word, pair or
phrase. The app does NOT just remember "you scored 6/10 in lesson
3"; it remembers "you particularly struggled with *bonjour* and
*merci*".

When you answer the same element correctly **3 times in a row**,
it is marked as **mastered** — and removed from the review queue.
If you later answer a mastered element incorrectly, it **slips
back** into the queue. A missed mastery is a forgotten mastery.

---

## The review queue

When you have one or more elements that need a review, the
**review card** appears on the Dashboard. It shows:

- How many elements are due
- How many are **overdue** (past the scheduled review date)
- A **Review now** button that opens a focused mini session at
  `/review/:setId`

The scheduling uses three bands, based on how often you answered
the element correctly in a row:

| Correct streak | Next review |
|---|---|
| 0 | 1 day later |
| 1 | 3 days later |
| 2 | 7 days later |
| 3 (mastered) | removed from the queue |

Within the queue, the entries sort themselves: **overdue first**,
then by **error count descending**, then by **most recent error
first**. This way the elements you struggle with most rise to the
top.

---

## Review sessions

A review session at `/review/:setId` synthesizes a **mini lesson
on the fly** from the top entries of your queue. Mixed strategy
since **v1.35.0**:

- If you originally missed a word in a **matching** or **picture
  choice** exercise, you do exactly that exercise again (with a
  fresh shuffle — no pure muscle memory).
- If you missed something in **free text** or **word tiles**, the
  review tries to generate a **cloze** exercise that targets
  exactly the missed word. The same knowledge in a different form
  — flexibility is trained, not just repeating a specific exercise
  format.
- If no clean cloze can be built for an element (e.g. when the
  original prompt did not contain the answer in the sentence), the
  review silently replays the original exercise. You never get a
  broken or empty step.

When you complete a review session, the same scoring + stars +
element-tracking machinery runs. Master 50 elements through
reviews and you earn the **Review Master** badge.

## End-of-lesson correction round

New in **v1.35.0**: When you finish a lesson with mistakes, the
summary page shows a small **correction round** between your score
and the "Next lesson" button. It takes up to five specific
mistakes from this lesson and offers each as a fresh cloze that
targets exactly the missed word / missed article.

- **Skippable at any time.** The "Next lesson" button stays
  visible — the correction round is voluntary practice, not a
  gate.
- **Appears only when there is something to correct.** Lessons
  with a perfect score skip it entirely. So do lessons whose
  mistakes cannot be reshaped into a clean cloze (rare).
- **Each completed cloze counts toward mastery.** The correction
  round writes the same element-tracking records as the main
  lesson; your streak on those elements moves toward the
  3-correct mastery threshold.

At the end, a brief "{n} elements improved" line appears, so you
see the effect of your extra practice.

## Visual diff feedback

Also new in **v1.35.0**: Wrong free-text and word-tile answers now
show a **token-level diff** between your input and the canonical
answer. Three colors, never color alone:

- **Red strikethrough** — what you wrote and did not belong (with
  an × marker for screen readers and colorblind users).
- **Green** — what the canonical answer contains and you missed
  (with a + marker).
- **Yellow** with an arrow → — a slightly wrong word, shown as
  `your-word` → `expected`.

The same diff appears in the lesson summary in each exercise's
breakdown — for every free-text or word-tile answer whose user
input the v1.35.0+ storage knows.

---

## XP and badges

Every completed lesson earns XP by a star formula:

- **30 XP** base
- **+10 XP per star** earned (0 → 0, 1 → +10, 2 → +20, 3 → +30)
- **+20 XP bonus** if you get 3 stars on the first attempt (every
  step with attempts = 1, no retries)
- The same **daily streak multiplier** as chat sessions (+25% per
  consecutive day, capped at 7 days)

Four new badges unlock around lessons:

- **First lesson** — complete your first content lesson.
- **10 lessons completed** — complete 10 content lessons.
- **3-star streak** — get three lessons in a row with 3 stars.
- **Review Master** — master 50 elements through spaced
  repetition.

Lesson completions also count toward your **daily streak**, so
learning with content lessons fills the heatmap the same way chat
sessions do.

---

## Storage modes

Lessons work in **both** storage modes — API (backend) and Dexie
(browser-only / GitHub Pages). Element-level error tracking and
SRS scheduling run identically against IndexedDB in browser-only
mode, so users visiting the public GitHub Pages site get the full
review loop without a backend.

Since **v1.33.0** the gamification is aligned too: in browser-only
mode you earn **the same XP and lesson badges** for completed
lessons as in server mode — the star, streak and badge logic is
ported to TypeScript and pinned against identical golden values.
There is no longer any feature difference between the modes on
lesson completion.

---

## Privacy

All lesson progress, element-error rows, review-queue states and
scheduling data stay **on your own device** — in the filesystem
(API mode) or in the browser (IndexedDB). Nothing about which
words you struggle with is sent anywhere.
