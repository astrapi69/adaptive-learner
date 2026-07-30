# Unreleased

Entries staged for the next feature release AFTER v2.7.0. v2.7.0 carries the
launcher install-path change; this data-recovery lane is deliberately held off
that release so a data migration sits on a quiet baseline (no overlapping
failure sources). Fold these into the next `changelog/releases/vX.Y.Z.md` at
release time.

## Added

- **Recover review progress for the corrected Japanese, Korean and Chinese A1
  lessons (#2161).** In July 2026 those three A1 sets were re-published with a
  transliteration fix that changed the answer text of 172 review items (66 in
  Japanese A1, 58 in Korean A1, 48 in Chinese A1). Spaced-repetition review
  cards are keyed by the answer text, so any card a learner had already created
  for a changed item stopped matching and quietly fell out of scheduling. Only
  those three sets are affected; every other set in the official catalogue is
  untouched.

  A new in-product notice on the Dashboard offers a recovery, and appears ONLY
  when the affected review cards are actually present in your own data (no
  broadcast). Per affected set you can:
  - **Relink review cards** to the corrected lessons. The relink is verified
    against the current lesson content before it writes, idempotent (running it
    again changes nothing), and all-or-nothing per set. If a set changed again
    after the fix, cards whose new target no longer exists are reported by count
    and left unchanged rather than silently dropped, so a partial recovery is a
    visible, valid result.
  - **Start the set fresh**, dropping its saved progress and review cards.

  Both choices are yours to make; nothing is re-linked or reset automatically.
  The notice recommends exporting a backup first, so the step is reversible.
  Works identically in server mode and in browser (GitHub Pages) mode.
