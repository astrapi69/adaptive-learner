# Vorlage: Neuer API-Endpoint (Core)

Baue: {HTTP-Verb + Pfad, z. B. GET /api/projects/{id}/streaks} — {Zweck in
einem Satz}. Vorab klären: gehört das in ein PLUGIN statt in den Core?
(architecture.md: neue Features standardmäßig als Plugin, außer sie
berühren die Kern-Aggregate.)

## Reihenfolge (implementation-workflow.md, nicht umsortieren)

1. Issue zuerst (`feature`-Kontext, GITHUB-ISSUE-PFLICHT).
2. Schema zuerst: Pydantic-v2-Request/-Response in `backend/app/schemas/`.
3. Service-Funktion (wirft `AdaptiveLearnerError`-Subklassen, NIE
   `HTTPException`); DB-Zugriff NUR über ein Repository
   (`backend/app/repositories/`, Komposition in `deps.py` — EXP-024).
4. Router dünn: validieren, Service rufen, Antwort zurück; fängt nichts.
5. Frontend: Pfad durch `getStorage()`/`IStorageService` — BEIDE Modi
   (Dexie-Namespace-Modul + ApiStorage) im SELBEN PR, oder Dexie-Modus
   degradiert freundlich (lessons/content-storage.md, Release-Blocker-Regel).
6. Tests: Service happy+error (pytest), mindestens ein
   Happy-Path-Integrationstest über `TestClient`, Frontend-Vitest für den
   Storage-Pfad; UI-Feature zusätzlich Smoke-Spec unter `e2e/smoke/`.
7. i18n: neue Strings in JEDEN Katalog unter `backend/config/i18n/`.
8. `make test` grün; Commit `feat(scope): ... (closes #NN)`; PR gegen
   develop (PR-PFLICHT). TESTPLAN-PFLICHT bei sichtbarem User-Pfad (DE+EN).

## Platzhalter

- Aggregat/Modell: {…} | Repository vorhanden? {ja/nein -> neu nach Muster}
- Fehlerfälle: {NotFound/Validation/Conflict …}
- Dexie-Pfad: {Namespace-Modul unter frontend/src/storage/…}
