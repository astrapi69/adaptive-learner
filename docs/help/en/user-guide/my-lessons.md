# My Lessons: create, save, share

**My Lessons** are lessons *you* create - turned into the same
offline, playable format as downloaded content sets. You can make a
lesson from an analysed chat, save a good adaptive lesson for replay,
export a lesson to share with someone else, and import lessons others
have shared. These steps work offline, and your lessons stay on your
device until you use a feature that passes them on, for example a
community contribution (pull request) or "Share as repository", which
upload the lesson to GitHub, or an AI check, which sends its content
to your AI provider.

You'll find My Lessons at the top of the **Set Browser** (`/content`),
above the downloaded sets.

---

## Create a lesson from a chat analysis

1. Import a chat and **Analyze** it (see *Import*).
2. On the analysis result, click **Save as Offline Lesson**.
3. A preview shows the lesson's structure - how many exercises and
   theory steps, the estimated time. Adjust the title if you like.
4. Click **Save**. The lesson appears under **My Lessons**.

The lesson is built from what the analysis found:

- **Theory** from the topic, summary, sub-topics, your strengths and
  weaknesses, common-mistake patterns, and any suggested curriculum.
- **Exercises** from the extracted vocabulary - matching and
  type-the-translation from each word, plus fill-in-the-blank and
  word-order exercises from any example sentences.

The richer the analysis (especially vocabulary with example
sentences), the richer the lesson. If there aren't enough vocabulary
items, you'll get a **theory-only study guide** and a hint to import a
longer chat for more practice material.

Generated lessons play in the normal lesson viewer with full scoring,
exactly like a downloaded lesson.

---

## Play, edit, delete

Each My Lesson has:

- **Play** - open it in the lesson viewer.
- **Edit** - opens the **Lesson Creator pre-filled** with the
  lesson's metadata, cards, and exercises. If one of your sets holds
  **several lessons**, a **lesson picker** first asks which one to
  edit. Book-text lessons open the exercise editor directly;
  attached book metadata is preserved. When saving you choose:
  **Save changes** (overwrites the same lesson - your learning
  progress survives for unchanged cards, changed ones start fresh)
  or **Save as a copy** (creates a new lesson, the original stays
  untouched). Analysis-based lessons still open the underlying chat
  analysis. Foreign (downloaded) lessons remain read-only.
- **Delete** - remove it (with confirmation).

---

## Combine several lessons into a set

Via **"Combine into a set"** in My Lessons you tick several of your
own lessons and merge them - either into a **new set** (title,
optional description, level) or into an **existing own set**. If the
selection mixes languages or levels, a non-blocking hint says so
(the set takes the most common combination). Colliding lesson files
automatically get a number suffix instead of overwriting each other.
The combined set is a normal own set - play, export, and share it as
usual.

---

## Save an adaptive lesson

When you finish an **adaptive lesson**, a **Save this lesson?** button
appears on the summary. Saving keeps a snapshot you can replay later
from My Lessons - handy when an adaptive session turned out
especially useful. The snapshot stays playable even if the adaptive
generator changes in a later version.

---

## Export and share

Each My Lesson can be shared. Exporting needs no account; the community
pull request needs a GitHub account. A GitHub token speeds up the pull
request and is needed for sharing a whole set as your own repository:

- **Export** - download the lesson as a single `.json` file.
- **Export as set** - download a content-set `.zip` (manifest +
  lessons).
- **Share with Community** - opens a **pull request** in the official
  content repository. The lesson JSON lands at the right path in the
  content tree, and the repository's validation runs automatically. The
  pull request is publicly visible on GitHub as soon as it exists. A
  maintainer reviews it; if they accept it, everyone can download the
  lesson. The pull request comes about in one of two ways:
    - **Without a token** - a single lesson opens GitHub's file editor
      at the right path, with the PR title and description pre-filled.
      For a small lesson, its content is already in the GitHub address
      that opens; for a larger one, the app downloads the file first and
      you paste it into the editor. A set with several lessons downloads
      the files and opens GitHub's upload page, where you drag them in.
      GitHub creates the fork and the pull request once you confirm
      there.
    - **With a GitHub token** (Settings > Integrations, see
      [Settings](settings.md#integrations)) - a single lesson is shared
      without leaving the app: the app forks the repository, commits the
      lesson and opens the pull request, then shows you its link. A set
      with several lessons still takes the way without a token. If
      GitHub rejects the token, the message points you to Settings >
      Integrations.
- **Share as repository** - pushes the whole set, in the content-repo
  format, to a GitHub repository of yours (created if it does not exist
  yet) in one commit. You choose the repository (`owner/name`), private
  or public, and the branch. A quality check runs first: if it finds
  problems that a content repository's checks would reject, it lists
  them and the button turns into **Export anyway**. Sharing as a
  repository needs a GitHub token and is only available in the browser
  version of the app; otherwise the button stays visible but disabled,
  with the reason as its tooltip. The pushed repository can then be
  connected as a content source (see
  [Content repositories](../features/content-repos.md)).

Exported files contain only the lesson content - no progress, no
error history, nothing personal.

---

## Import a lesson

Click **Import Lesson**, choose a `.json` lesson or a `.zip` set, and
the app validates it and shows a preview. Confirm to add it to My
Lessons. If the file is invalid you'll see a specific reason rather
than a broken import.

This closes the loop: one learner exports a lesson, another imports
and plays it - completely offline.
