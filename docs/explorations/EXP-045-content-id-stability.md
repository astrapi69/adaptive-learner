# EXP-045: Content-ID-Stabilität (Content Identity Stability)

**Kategorie:** Querschnitt · **Phase:** Analyse (keine Umsetzung in diesem
Dokument) · **Priorität:** Sehr hoch (Datenintegrität) · **Abhängig von:**
EXP-039 (JSON-Schema als Single Source of Truth), EXP-042 (Content-Engine),
EXP-002/003 (Content-Repository, Lektionsformat) · **Issue:** #2130
(Bedarfsanmeldung, repoübergreifend), #2128 (laufender Datenverlust), #2125
(Durchgang, blockiert)

> Explorationsdokument. Kein Code, keine Schema-Änderung — nur Ist-Aufnahme,
> Optionen und Abstimmungsbedarf. Kern: Übungs- und Karten-Identität ist heute
> nicht stabil über Content-Updates hinweg. Das ist zuerst ein **laufendes
> Datenintegritäts-Risiko** (#2128) und erst danach ein Blocker für künftige
> Auswertungen (Durchgänge #2125, Fehlerhistorie). Stabile Identität ist eine
> **Zusage der Inhalte, durchgesetzt vom Schema** — keine Eigenschaft, die die
> App sich selbst geben kann. Betroffen sind drei Repos: `adaptive-learner`,
> `learn-content-engine` (Schema-Hoheit), die Content-Repos.

---

## 1. Problem

Lernfortschritt (`LessonProgress`) und Wiederholungsdaten (`ElementError` /
SRS) verweisen auf Inhalte ausschliesslich über **Identitäts-Strings**:

- `LessonProgress`: `(user, source, set_id, lesson_filename)`
- `ElementError`: `(user_id, set_id, lesson_id=filename, exercise_id, element_key, direction)`

Diese Strings sind **keine Fremdschlüssel** und werden bei einem Content-Update
weder migriert noch geprüft. Wird ein Set aktualisiert (manueller "Update",
Repo-Sync, stiller 24h-Auto-Sync), ersetzt die App nur die **Inhalte** und
behält die Fortschrittszeilen unverändert. Ob der Fortschritt danach noch
auflöst, hängt allein davon ab, ob der Autor die Identitäts-Strings gleich
gelassen hat — ohne Durchsetzung, ohne Erkennung, ohne Warnung.

Das laufende Risiko ist in **#2128** belegt (Verhalten real durchgespielt, nicht
abgeleitet: `frontend/src/lib/content/browse/set-update-orphaning.test.ts`).
Dieses Dokument klärt die **Ursache** und die **repoübergreifende Strategie**.

---

## 2. Ist-Aufnahme (mit Fundstellen)

### 2.1 Wie Übungs-/Karten-IDs heute entstehen

| Herkunft | lesson id | exercise id | card id | element_key (SRS) |
|---|---|---|---|---|
| **Heruntergeladenes Autoren-Set** | verbatim (`NN-slug`) | **verbatim Slug** | verbatim Slug | Inhalt (Antworttext) |
| **KI / Analyse** (py+ts) | `analysis-{topic-slug}` | **`ex-match/free/cloze/tiles-{i}` (positionsbasiert)** | `vocab-{i}` (positionsbasiert) | Inhalt |
| **KI cards→exercises** | — | **`ai-ex-{n}-{type}` (positionsbasiert)** | — | Inhalt |
| **Buch-Import** | `slugify(title)` | `ai-ex-{n}-{type}` | — | Inhalt |
| **Manueller Draft** | `slugify(title)` | Draft-Slug | `card-{base36ts}-{seq}` | Inhalt |

- Heruntergeladene Sets: der Loader liest IDs **verbatim**, er generiert nie
  (`github_adapter.py:204-216` `fetch_json` = `json.loads`; `service.py:502-528`
  `get_lesson` → `read_lesson`). Die Stabilität liegt vollständig beim Autor.
- KI/Analyse-Lektionen: IDs **positionsbasiert** aus dem Listenindex
  (`plugins/.../analysis_to_lesson.py:125,249,269,304,328,408`; TS-Spiegel
  `frontend/src/lib/exercises/authoring/exercise-builder.ts:159,181,203,229,266,304,402`;
  `frontend/src/lib/ai/generation/cards-to-exercises.ts:128-134` `ai-ex-${index+1}`).
- `element_key` ist **kein** ID, sondern der **kanonische Antwort-INHALT** des
  kleinsten bewertbaren Elements (`frontend/src/lib/srs/element-attempt.ts`:
  `pair.left`, `accept[0]`, `tiles.join(" ")`, Kartenfront). Eine
  Tippfehlerkorrektur im Antworttext ändert `element_key`.

### 2.2 Was das Schema fordert

- Schema-Hoheit liegt bei **`learn-content-engine`**; dieses Repo **spiegelt**
  es (`schema/*.json`, `$id` → `learn-content-engine`; `make sync-schema` →
  `scripts/sync_schema_mirror_from_engine.py` kopiert aus dem gepinnten npm-Paket
  `frontend/node_modules/learn-content-engine/schema/`; `engine-parity-check`
  byte-gated gegen `schema/engine-version.txt`).
- Der Schema-Vertrag für IDs (`schema/exercise.schema.json:364-369`,
  `card.schema.json:144-149,44`, `lesson.schema.json:809-814,1070-1075`):
  `id` ist ein **Slug, eindeutig NUR innerhalb der Lektion**
  (`maxLength 120`; Karten + Steps werden dedupliziert, Exercise-IDs nicht
  einmal auf Eindeutigkeit geprüft — `schema.py:359-393`). Es gibt **keine
  Notion einer stabilen, autoren-eigenen, versionsunabhängigen
  Übungsidentität**. Die versionssensible Remap-Idee (AUTH-05, EXP-025) ist
  **offen / nicht implementiert**.

### 2.3 Wie die ausgelieferten Sets tatsächlich ausgezeichnet sind

Stichprobe der in-Repo gebündelten Lektions-JSONs (die produktiven 26 Sets
liegen in den nicht angebundenen Content-Repos — siehe Abstimmungsbedarf):

- **Autoren-authored** (`frontend/src/lib/content/__fixtures__/inception-lesson.json`,
  `e2e/fixtures/multiple-choice-device-check.lesson.json`): **menschliche
  semantische Slugs** (`ex-match-begriffe`, `ex-pick-inception`, `gasse-wo`).
  Diese sind über Reorder stabil — solange der Autor die ID an der Übung lässt.
- **KI/Analyse** (Test-Marker `ai-ex-1-free-text`, `ex-free-0`): **positionsbasiert**.
  Diese verschieben sich bei Insert/Reorder.

**Befund:** Die Stabilität ist heute reine Autorendisziplin für
heruntergeladene Sets und **strukturell nicht gegeben** für KI-/Buch-/
Analyse-generierte Inhalte. Der Umfang der 26 produktiven Sets muss über die
Content-Repos verifiziert werden (nicht app-seitig einsehbar).

---

## 3. Optionen

### Option A — Autorenseitige stabile Kennung (Schema-durchgesetzt)

Jede Übung/Karte trägt eine im Content vergebene, **unveränderliche** Kennung
(z. B. `stable_id` / `uid`), die das Schema als **vorhanden + set-weit
eindeutig + über Versionen unverändert** deklariert. Fortschritt/SRS keyen auf
diese Kennung statt auf Slug/Position.

- **Aufwand:** Schema-Änderung in `learn-content-engine`; App-seitige
  Umstellung der SRS-/Progress-Keys; **Nachrüstung aller bestehenden Sets** +
  Autorenregel + Generatoren (KI/Buch) müssen stabile Kennungen vergeben.
- **Folgen:** Sauberste, dauerhaft korrekte Lösung. Löst auch die Voraussetzung
  für Durchgänge (#2125) und Fehlerhistorie. Rettet aber **keine Bestandsdaten**
  von sich aus (die alten Zeilen kennen die neue Kennung nicht).

### Option B — Inhaltsbasierte Kennung mit Toleranz

Kennung aus dem Inhalt abgeleitet (Hash über Prompt + Antworten), mit
Fuzzy-Zuordnung bei kleinen Änderungen.

- **Aufwand:** Kein Eingriff in die Inhalte; Ableitungs- + Toleranzlogik in der
  App.
- **Folgen:** **Unzuverlässig genau dort, wo korrigiert wird** (eine
  Tippfehlerkorrektur ist eine kleine Inhaltsänderung — der Hash bricht, die
  Toleranz muss raten). Verschiebt das Problem, statt es zu lösen. Nicht
  empfohlen als alleinige Lösung.

### Option C — Zuordnung beim Aktualisieren (Migration/Remap)

Beim Ersetzen eines Sets wird **alt gegen neu** abgeglichen und Fortschritt
best-effort übertragen (AUTH-05).

- **Aufwand:** Remap-Heuristik + Migrationslauf, beide Speichermodi (#2053).
- **Folgen:** **Rettet Bestandsdaten unabhängig von der gewählten Kennung** —
  aber Heuristik, nie garantiert korrekt. Wertvoll als Einmal-Brücke, nicht als
  Dauerzusage.

### Kombinationsbewertung (empfohlen)

**A (für die Zukunft) + C (einmalig für Bestandsdaten).** A macht neue Inhalte
dauerhaft korrekt und schema-durchgesetzt; C überträgt vorhandenen Fortschritt
beim Umstieg, so weit möglich. B wird verworfen (bricht am Korrektur-Fall). Bis
A greift, ist die **Sofortmassnahme aus #2128** (Auto-Sync nicht still
überschreiben + Warnung vor manuellem Update) die Blutstillung.

---

## 4. Abstimmungsbedarf (drei Repos)

- **`learn-content-engine` (Schema-Hoheit):** Die stabile Übungs-/
  Karten-Kennung (Option A) ist eine **Schema-Änderung** und wird **dort**
  entschieden, nicht app-seitig umgangen. Bedarf: ein `stable_id`-Feld
  (vorhanden, set-weit eindeutig, versionsstabil), plus Validierung.
  → **Bedarf anmelden** (engine-cc-Abstimmung), keine Änderung in diesem Repo.
- **Content-Repos (Autorenregel + Nachrüstung):** Bestehende Sets müssen die
  stabile Kennung nachtragen; die Autorendoku muss "IDs sind ein Vertrag, nie
  umbenennen" festschreiben. Aufwand für die **KI-erzeugten Sets** getrennt
  schätzen (deren IDs sind positionsbasiert — Nachrüstung heisst dort:
  Generator vergibt stabile Kennungen).
- **`adaptive-learner` (Konsum + Migration):** Umstellung der SRS-/Progress-Keys
  auf die stabile Kennung; einmaliger Remap (Option C) für installierte Nutzer;
  Backup-Schema-Bump falls die Keys sich ändern. Offene Frage: ob
  Bestandsfortschritt überhaupt rettbar ist (nur per Heuristik).

---

## 5. Ergebnis

- **Empfehlung:** Option **A + C**. A ist die dauerhafte, schema-durchgesetzte
  Zusage; C die einmalige Rettung der Bestandsdaten. B verworfen.
- **Reihenfolge:**
  1. **Sofort:** #2128-Sofortmassnahme (Blutstillung: Auto-Sync-Guard +
     Update-Warnung) — unabhängig von A/C.
  2. **Schema:** `stable_id` in `learn-content-engine` (Bedarf angemeldet).
  3. **Generatoren + Content-Repos:** stabile Kennungen vergeben/nachrüsten.
  4. **App:** Keys umstellen + einmaliger Remap (C) + Backup-Schema-Bump.
- **Aufwand je Repo:** engine = klein (Feld + Validierung), Content-Repos =
  mittel bis gross (Nachrüstung aller Sets, KI-Generator), app = mittel
  (Key-Umstellung + Migration + Tests beide Modi).
- **Abhängige Vorhaben — dürfen erst nach geklärter Identität weiter:**
  - **#2128** Datenverlust (die Sofortmassnahme entkoppelt das akute Risiko).
  - **#2125** Durchgänge (erneut durcharbeiten) — braucht stabile Kennung für
    den Vergleich Durchgang 1 vs 2.
  - **Fehlerhistorie-Exploration** — dieselbe Vorbedingung.
  - **EXP-034 Content Discovery** — baut den Verteilungs-/Aktualisierungsweg im
    grossen Massstab; **kein Rollout vor geklärter Identität** (dort als
    Vorbedingung vermerkt).

---

## 6. Offene Fragen

- Ist Bestandsfortschritt der bereits ausgelieferten Sets per Remap (C)
  überhaupt rettbar, oder nur der ab-A-erzeugte Fortschritt? Hängt an der
  Qualität der Alt-gegen-neu-Zuordnung.
- Wie vergeben die KI-/Buch-Generatoren eine stabile Kennung, die einen
  Re-Analyse-Lauf übersteht (heute rein positionsbasiert)?
- Migrationsweg für installierte Nutzer inkl. Backup-Abwärtskompatibilität
  (`.alb`-Schema-Version).
