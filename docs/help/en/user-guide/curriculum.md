# Curriculum

The Curriculum page is your structured learning material — the
"book" against which your sessions happen. It's an optional but
powerful layer on top of free-flowing AI sessions.

## What a curriculum is

A curriculum is a tree of **topics** plus a flat list of
**lessons**, all belonging to one learner. You can have
multiple curricula side by side ("Spanish grammar", "Spring
Boot for Java devs", "Lead guitar fundamentals").

- **Topics** form a tree — chapters and sub-chapters. Each
  topic has a title, optional description, and a parent
  reference. The "Add subtopic" button creates a child.
- **Lessons** are flat under the curriculum. Each has a title
  and a rich-text content body. Use them for written material:
  notes, summaries, exercise sheets.

## Creating a curriculum

The Curriculum page lists every curriculum you own. The
"Create curriculum" form takes a title + optional description
+ optional language; pressing Create opens the new curriculum
view immediately.

## The topic tree

The left side of the curriculum view shows the topic tree,
drag-and-drop reorderable (touch-friendly on mobile too).
Click a topic to drill in; the breadcrumb under the heading
shows the path back to the root.

- **Add topic** at the root level — sibling of every existing
  top-level topic.
- **Add subtopic** under the currently-focused topic.
- **Rename** by clicking the title in edit mode.
- **Delete** removes the topic AND its descendants (Dexie
  mode handles the cascade in a single transaction; API mode
  delegates to the backend).

The tree is just metadata; topics don't have content of their
own. Content lives in lessons.

## Lessons

The right side of the curriculum view is the lesson list,
ordered by `order_index`. Each row shows the lesson title and
a snippet of its content; clicking opens the lesson editor.

The lesson editor is a plain Markdown / plain-text editor —
deliberately not a full WYSIWYG (the Bibliogon-era TipTap
editor was stripped during the v0.1.0 skeleton work, see the
project reference for the trade-off discussion). Headings,
links, code blocks, lists, and basic emphasis are supported
via Markdown.

## How curricula connect to sessions

In v0.7.0 sessions don't yet auto-pull topic/lesson content
into the AI's system prompt. The curriculum's value today is
**organising your own thinking**: write summaries of what
you learned, build a tree of topics you want to tackle, link
lessons to one another.

A future phase will plug the curriculum into the session
prompt so the AI can reference your own notes when guiding
you. That's deliberately deferred until the curriculum data
shape has settled.

## Per-storage-mode behaviour

Both ApiStorage and DexieStorage implement curriculum CRUD.
In Local mode the data lives in IndexedDB and survives
browser reloads as long as you don't clear site data. In
Server mode the data lives in the FastAPI backend's SQLite
database.

[How storage modes work](settings.md#storage-mode)
