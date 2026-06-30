# i18n catalog review — v1.98.0

> Stand: `develop` @ 58bc4f20 (2026-06-30). Generated for the pre-v1.98.0 four-eyes review.


Per-key export of all 11 i18n catalogs for an external four-eyes (native-language) review.

- **Source of truth: German (`de`)** — assume the German strings are correct; verify the other languages against DE.
- `en` is the technical key reference (parity baseline).
- Languages (11): de, en, el, es, fr, hi, id, ja, ko, pt, tr (DE/EN shown first per key).
- Leaf keys: 2788 × 11 languages.
- **Please check:** correct translation, idiomatic phrasing, swallowed/renamed placeholders (`{name}` must match DE), tone & terminology consistency — especially JA/KO/HI/ID/TR/PT (less verified).
- Split into parts (one file would be ~2 MB); whole namespaces are never split across parts.

## Parts
| Part | Namespaces | Keys | Size |
|---|---|---|---|
| [01-app.md](01-app.md) | app, common, avatar, data_export, nav, import, curriculum, landing, onboarding, assessment, dashboard, adaptive, review | 374 | 197 KB |
| [02-session.md](02-session.md) | session, progress | 54 | 28 KB |
| [03-settings.md](03-settings.md) | settings, methods, cycle_steps, errors, toast | 375 | 224 KB |
| [04-install.md](04-install.md) | install, about, backup, export, sync, gamification | 378 | 211 KB |
| [05-anki.md](05-anki.md) | anki, voice, pronunciation, notebooklm, feature, ui, repo | 325 | 170 KB |
| [06-lesson.md](06-lesson.md) | lesson | 241 | 110 KB |
| [07-content.md](07-content.md) | content, contribute, milestone | 333 | 203 KB |
| [08-missions.md](08-missions.md) | missions, create_lesson, learning_path, pwa, share, taxonomy, subjects | 364 | 165 KB |
| [09-editor.md](09-editor.md) | editor, languages, statistics, shortcuts, srs, hints, favorites, content_repo, resource, discover, update, endless, shuffle, invitation_code, migration | 344 | 161 KB |

## Machine analysis summary
See [00-analysis.md](00-analysis.md) for the full machine consistency check (key parity, placeholders, empties, untranslated suspects, cross-language identical, mojibake).
