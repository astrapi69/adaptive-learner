# Vorlage: Neue Funktion in einem bestehenden Plugin

Baue in `plugins/adaptive-learner-plugin-{name}`: {Funktion in einem Satz}.

## Reihenfolge

1. Issue zuerst (GITHUB-ISSUE-PFLICHT).
2. Geschäftslogik in einem eigenen Service-Modul des Plugin-Pakets
   (`adaptive_learner_{name}/{modul}.py`) — NICHT in `routes.py`;
   `routes.py` delegiert nur. Fehler als Domain-Exceptions
   (`NotFoundError`/`ValidationError`/`ExternalServiceError`), nie
   `HTTPException`.
3. DB: Plugins dürfen bis EXP-024-Phase-2 direkt `Session` nutzen;
   API-Key-Auflösung über `SqlAlchemySettingsRepository(db)` am Call-Site
   (architecture.md Repository-Abschnitt).
4. Einstellungen: `backend/config/plugins/{name}.yaml` (NICHT im
   Plugin-Ordner — Laufzeit liest nur das Backend-config_dir,
   lessons/backend.md). Jede Einstellung UI-editierbar oder `# INTERNAL`;
   keine toten Felder.
5. Externe Dienste in `ExternalServiceError` wrappen; in Tests mocken.
6. Tests in `plugins/adaptive-learner-plugin-{name}/tests/` (Hook feuert +
   Route happy path mindestens); Frontend-Anteil über `getStorage()` in
   beiden Modi (Dexie-Pflicht wie im Endpoint-Template).
7. i18n in alle Kataloge; `make test` grün (Plugin-Tests laufen voll).
8. Commit `feat({name}): ... (closes #NN)`; PR gegen develop;
   TESTPLAN-PFLICHT bei User-Pfad. Plugin-`pyproject.toml`-Version NICHT
   anfassen (Lock-Step nur via `make sync-versions` beim Release).
9. Falls `pyproject.toml` des Plugins Deps ändert: `poetry.lock` des
   Plugins im selben Commit (pre-commit-Hook erzwingt das Paar) UND
   Backend-Lock neu (`make lock-all-plugins`-Hinweis in lessons/backend.md).

## Platzhalter

- Hook nötig? {bestehender Hook / neuer Spec in backend/app/hookspecs.py mit api_version}
- UI-Slot: {settings_section / dashboard_widget / session_panel / keiner}
