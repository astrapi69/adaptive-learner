"""Adaptive Learner NotebookLM plugin (Phase 32 / v1.19.0).

NotebookLM has no public API, so direct integration isn't
possible. This plugin provides the next-best path:

  1. **Active-recall question generator** — turns session
     transcripts + project data into NotebookLM-suitable
     ``StudyQuestion`` rows the user reviews / accepts /
     edits.
  2. **Study guide generator** — one big AI call that
     produces a comprehensive Markdown guide from the
     project's sessions, extractions, curriculum, profile.
  3. **NotebookLM ZIP export** — assembled CLIENT-SIDE in
     ``frontend/src/lib/export/notebooklm-package.ts``
     from the user's data; the resulting ZIP holds
     ``summary.md``, ``vocabulary.md``, ``rules.md``,
     ``errors.md``, ``flashcards.md``, plus a
     ``sessions/`` dir with per-session excerpts. Each
     file is structured for NotebookLM's source parser
     (short paragraphs, clear headers, Q&A blocks).
"""

__version__ = "1.23.0"
