# AI exercise generation

A lesson made only of theory (no exercises) can be turned into a
practiceable lesson by having the AI **generate exercises** from
its cards. This is the EXP-036 pipeline shipped in v1.90.0. It
needs an AI key configured (Settings → AI); without one the button
is visible but disabled, with the reason in its tooltip.

<!-- TODO: Screenshot — the "Generate exercises" button on a theory-only lesson -->

---

## The pipeline

Generation is not a single AI call — it is a
**generate → quality-gate → balance → feedback** pipeline:

1. **Generate.** A generation prompt asks the model for exercises
   across the supported types; a defensive JSON parser tolerates
   the usual model formatting quirks.
2. **Quality gate.** A deterministic gate rejects exercises that
   are malformed, trivial, or duplicate existing ones — before you
   ever see them.
3. **Balance.** The set of generated exercises is balanced across
   exercise types so a lesson is not all of one shape.
4. **Regenerate with feedback.** If the result is not right, you
   can regenerate with feedback to steer the next attempt.

---

## Per-lesson and per-set

- **Single lesson:** a **"Generate exercises"** button appears on
  theory-only lessons.
- **Whole set:** batch generation fills in exercises across every
  theory-only lesson in a set in one run.

---

## Quality and trust

Because the quality gate is deterministic, generated exercises
meet the same minimum bar as authored ones (enough exercises,
more than one type, no empty cards). Generation augments authored
content — it never silently overwrites your existing exercises.

For checking *existing* content quality (authored or generated),
see [AI content check](../user-guide/ai-validation.md).

---

## Related pages

- [AI content check](../user-guide/ai-validation.md) — set-wide quality checks
- [Creating lessons](../content-creation/overview.md) — build lessons yourself
- [Lessons and reviews](../user-guide/lessons.md) — the exercise types
