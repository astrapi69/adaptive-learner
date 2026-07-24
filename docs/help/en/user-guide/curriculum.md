# Curriculum

The Curriculum page is your structured learning material - the
"book" against which your sessions happen. It's an optional but
powerful layer on top of free-flowing AI sessions.

## What a curriculum is

A curriculum is a tree of **topics** plus a flat list of
**lessons**, all belonging to one learner. You can have
multiple curricula side by side ("Spanish grammar", "Spring
Boot for Java devs", "Lead guitar fundamentals").

- **Topics** form a tree - chapters and sub-chapters. Each
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

- **Add topic** at the root level - sibling of every existing
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

The lesson editor is **TipTap rich text**:
bold / italic / underline / strike, headings (H1-H3), bullet
+ ordered + task lists, blockquote, inline code, fenced code
blocks with `lowlight` syntax highlighting across 11
languages (bash / css / html / java / javascript / json /
markdown / python / sql / typescript / yaml), links, text
alignment, highlight, undo / redo, character count. The
toolbar is mobile-friendly with horizontal scroll + 40px
touch targets.

Curriculum descriptions, session notes, and lesson content
all use the same editor. Markdown / PDF exports go through
`renderStoredContent` which walks the TipTap doc tree and
emits GFM Markdown; legacy plain-text content
passes through verbatim.

## How curricula connect to sessions

Sessions can be seeded from a chat-history import or from
scratch. The conversation analyzer (`/api/imports`) extracts
a `suggested_curriculum` field; one click on the analyzed
import seeds a Curriculum with topics + lessons matching the
gaps the AI identified.

The session AI does not (yet) auto-pull individual lesson
content into the system prompt - that's a deliberate hold
until the curriculum-AI integration shape settles.

## Per-storage-mode behaviour

Both ApiStorage and DexieStorage implement curriculum CRUD.
In Local mode the data lives in IndexedDB and survives
browser reloads as long as you don't clear site data. In
Server mode the data lives in the FastAPI backend's SQLite
database.

[How storage modes work](settings.md#storage-mode)
