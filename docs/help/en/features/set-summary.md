# Set-completion review

Finishing every lesson of a set used to end in a trophy card - "all
N lessons done" - and nothing else, even though the app already
tracks, per exercise, the error count, the streak, the mastery flag,
and your own wrong answer. **Set-completion review** is the missing
picture: every mistake of the set you just finished, in one place.

Reach it from the **Next step** suggestions at the end of the last
lesson of a set, or from the set's own page.

---

## What it shows

- **Totals** - errors and time spent across the whole set, not just
  the lesson you last played.
- **By lesson** - which lessons in the set produced the most
  mistakes.
- **By exercise type** - whether a specific type (matching, cloze,
  free text, ...) is where the errors cluster.
- **Weak areas** - the individual items you keep getting wrong, each
  showing your last wrong answer next to the correct one, so you see
  exactly what to fix, not just that something needs fixing.

---

## How it works

The page is read-only and storage-agnostic: it reads the same rows
your review sessions already write (error counts, mastery flags) and
runs them through a single aggregation step, so the numbers match
exactly what SRS review and the learning path already track - no
separate bookkeeping to drift out of sync.

---

## Related pages

- [Lessons and reviews](../user-guide/lessons.md) - where the underlying error and mastery data comes from
- [Learning Path](../user-guide/learning-path.md) - the set-level progress view this complements
