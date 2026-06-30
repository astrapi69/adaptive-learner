# i18n consistency analysis (machine) — pre v1.98.0

> Stand: `develop` @ 58bc4f20 (2026-06-30). Generated for the pre-v1.98.0 four-eyes review.


- Languages: 11 (de, en, el, es, fr, hi, id, ja, ko, pt, tr)
- Key reference (parity): `en` — 2788 leaf keys
- Translation source of truth: `de` (assumed correct)

## Key parity (vs EN)
- All target languages have the EXACT EN key set (0 missing, 0 extra).

## Placeholder consistency (vs DE source)
- No placeholder-set mismatches vs DE across any language.

## Empty / null values
- No empty or null values in any catalog.

## Untranslated suspects (value identical to DE source)
(short tokens, brand names, numbers, and pure-placeholder values are excluded; a non-trivial value equal to the German source likely means a forgotten translation)

- **en**: 90 non-trivial value(s) identical to DE
- **el**: 24 non-trivial value(s) identical to DE
- **es**: 33 non-trivial value(s) identical to DE
- **fr**: 56 non-trivial value(s) identical to DE
- **hi**: 16 non-trivial value(s) identical to DE
- **id**: 50 non-trivial value(s) identical to DE
- **ja**: 19 non-trivial value(s) identical to DE
- **ko**: 18 non-trivial value(s) identical to DE
- **pt**: 43 non-trivial value(s) identical to DE
- **tr**: 30 non-trivial value(s) identical to DE

<details><summary>identical-to-DE keys per language (first 60 each)</summary>

- **en** (90): `app.name`, `common.optional`, `data_export.group_gamification`, `data_export.cat_tags`, `nav.dashboard`, `nav.import`, `nav.online`, `nav.offline`, `nav.anki`, `import.role_system`, `landing.title`, `dashboard.title`, `dashboard.metric_mean_stress`, `progress.commit_stress`, `settings.key_vault.passphrase_label`, `settings.lesson_mode.timed_normal`, `settings.updates.title`, `settings.support.heading`, `settings.avatar_crop_zoom`, `settings.group_info`, `settings.tab_plugins`, `settings.section_feedback`, `settings.feedback_intensity_normal`, `settings.sounds_test`, `settings.storage_mode_api`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.section_gamification`, `settings.danger_zone_input_placeholder`, `settings.section_sync`, `cycle_steps.feedback.label`, `about.version_heading`, `about.app_label`, `about.build_hash_label`, `about.strang.branch_label`, `about.strang.commit_label`, `about.system_heading`, `about.storage_api`, `about.identity_status_label`, `about.repo_label`, `about.issues_label`, `export.title`, `export.download_md`, `sync.port`, `gamification.card_xp`, `gamification.tier.bronze`, `gamification.tier.gold`, `gamification.badges.level_5.name`, `gamification.badges.level_10.name`, `gamification.badges.level_25.name`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `ui.themes.sepia`, `ui.error_report.online`
- **el** (24): `app.name`, `nav.anki`, `landing.title`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `about.app_label`, `about.build_hash_label`, `about.strang.commit_label`, `about.repo_label`, `about.issues_label`, `export.download_md`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `content.source.github`, `share.achievement.hashtag`, `subjects.frameworks`, `hints.cost`
- **es** (33): `app.name`, `nav.anki`, `landing.title`, `settings.lesson_mode.timed_normal`, `settings.avatar_crop_zoom`, `settings.group_info`, `settings.feedback_intensity_normal`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `about.app_label`, `about.build_hash_label`, `about.strang.commit_label`, `about.author_label`, `about.issues_label`, `export.download_md`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `ui.themes.sepia`, `content.source.github`, `share.achievement.hashtag`, `subjects.frameworks`, `languages.hi`, `languages.script.devanagari`, `languages.script.hangul`, `hints.cost`, `resource.free`
- **fr** (56): `app.name`, `data_export.group_gamification`, `nav.anki`, `import.analysis_title`, `landing.title`, `dashboard.metric_mean_stress`, `progress.commit_method`, `progress.commit_stress`, `settings.lesson_mode.timed_normal`, `settings.section_profile`, `settings.avatar_crop_zoom`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `about.version_heading`, `about.app_label`, `about.build_hash_label`, `about.strang.commit_label`, `about.issues_label`, `export.download_md`, `sync.port`, `gamification.tier.bronze`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `ui.error_report.category.navigation`, `repo.stats_table_stress`, `lesson.tts.pause`, `content.save_lesson.level_label`, `content.source.github`, `content.tree.domain_psychology`, `create_lesson.meta.level_label`, `share.achievement.hashtag`, `subjects.frameworks`, `subjects.biology`, `subjects.astronomy`, `subjects.philosophy`, `subjects.psychology`, `subjects.design`, `editor.ctx_list`, `languages.hi`, `languages.script.devanagari`, `shortcuts.group_navigation`, `hints.cost`, `content_repo.badge.coach`, `resource.type_podcast`, `discover.filter.level`, `discover.domain.psychology`, `endless.pause`, `invitation_code.col.code`, `invitation_code.col.max`
- **hi** (16): `nav.anki`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `export.download_md`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `content.source.github`, `share.achievement.hashtag`, `hints.cost`
- **id** (50): `app.name`, `nav.statistics`, `nav.anki`, `landing.title`, `progress.tab.stats`, `settings.lesson_mode.timed_normal`, `settings.section_profile`, `settings.group_info`, `settings.feedback_intensity_normal`, `settings.storage_mode_api`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `about.app_label`, `about.build_hash_label`, `about.strang.branch_label`, `about.strang.commit_label`, `about.storage_api`, `about.identity_status_label`, `export.download_md`, `sync.port`, `gamification.card_xp`, `gamification.badges.level_5.name`, `gamification.badges.level_10.name`, `gamification.badges.level_25.name`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `ui.themes.sepia`, `repo.readme_status_heading`, `repo.stats_table_transfer`, `repo.stats_table_status`, `content.repo_export.private`, `content.repo_export.branch`, `content.source.github`, `learning_path.stats.title`, `share.achievement.hashtag`, `subjects.music`, `languages.hi`, `languages.script.devanagari`, `languages.script.hangul`, `hints.cost`, `content_repo.field.branch`, `resource.type_article`, `resource.free`
- **ja** (19): `app.name`, `nav.anki`, `landing.title`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `about.app_label`, `export.download_md`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `content.source.github`, `share.achievement.hashtag`, `hints.cost`
- **ko** (18): `app.name`, `nav.anki`, `landing.title`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `about.app_label`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `content.source.github`, `share.achievement.hashtag`, `hints.cost`
- **pt** (43): `app.name`, `data_export.cat_tags`, `nav.online`, `nav.offline`, `nav.anki`, `landing.title`, `settings.lesson_mode.timed_normal`, `settings.avatar_crop_zoom`, `settings.group_info`, `settings.tab_plugins`, `settings.section_feedback`, `settings.feedback_intensity_normal`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `cycle_steps.feedback.label`, `about.app_label`, `about.build_hash_label`, `about.strang.commit_label`, `about.identity_status_label`, `about.author_label`, `about.issues_label`, `export.download_md`, `gamification.tier.bronze`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `ui.error_report.online`, `ui.error_report.offline`, `content.source.github`, `share.achievement.hashtag`, `subjects.frameworks`, `subjects.design`, `languages.hi`, `languages.script.devanagari`, `languages.script.hangul`, `hints.cost`, `resource.type_podcast`
- **tr** (30): `app.name`, `nav.menu`, `nav.anki`, `landing.title`, `settings.lesson_mode.timed_normal`, `settings.section_profile`, `settings.feedback_intensity_normal`, `settings.provider_anthropic`, `settings.provider_openai`, `settings.provider_gemini`, `settings.danger_zone_input_placeholder`, `about.app_label`, `about.strang.commit_label`, `export.download_md`, `sync.port`, `gamification.danger_zone_input_placeholder`, `ui.themes.catppuccin-latte`, `ui.themes.supabase`, `ui.themes.graphite`, `ui.themes.catppuccin-mocha`, `ui.themes.soft-pop`, `ui.themes.amethyst-haze`, `ui.tooltips.menu`, `content.source.github`, `share.achievement.hashtag`, `editor.ctx_list`, `languages.script.devanagari`, `languages.script.hangul`, `hints.cost`, `resource.paid`

</details>

## Suspiciously identical across languages
(same non-trivial value shared by >= 6 of the 10 target languages — possible forgotten translation; brand/UI tokens may legitimately coincide)

- 23 key(s):
    - `app.name` — 9 langs: de,el,es,fr,id,ja,ko,pt,tr
    - `nav.anki` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `landing.title` — 9 langs: de,el,es,fr,id,ja,ko,pt,tr
    - `settings.lesson_mode.timed_normal` — 6 langs: de,es,fr,id,pt,tr
    - `settings.provider_anthropic` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `settings.provider_openai` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `settings.provider_gemini` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `settings.danger_zone_input_placeholder` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `about.app_label` — 9 langs: de,el,es,fr,id,ja,ko,pt,tr
    - `about.build_hash_label` — 6 langs: de,el,es,fr,id,pt
    - `about.strang.commit_label` — 7 langs: de,el,es,fr,id,pt,tr
    - `export.download_md` — 9 langs: de,el,es,fr,hi,id,ja,pt,tr
    - `gamification.danger_zone_input_placeholder` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `ui.themes.catppuccin-latte` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `ui.themes.supabase` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `ui.themes.graphite` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `ui.themes.catppuccin-mocha` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `ui.themes.soft-pop` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `ui.themes.amethyst-haze` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `content.source.github` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `share.achievement.hashtag` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr
    - `languages.script.devanagari` — 6 langs: de,es,fr,id,pt,tr
    - `hints.cost` — 10 langs: de,el,es,fr,hi,id,ja,ko,pt,tr

## UTF-8 / mojibake scan
- No replacement chars or common mojibake sequences found.
- DE values containing real umlauts (ä/ö/ü/ß): 803 (sanity: should be > 0).
