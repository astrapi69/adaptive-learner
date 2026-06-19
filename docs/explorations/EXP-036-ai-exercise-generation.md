# EXP-036: KI-Übungsgenerierung aus Theorie-Content (AI Exercise Generation)

**Kategorie:** Feature · **Phase:** 2 (App-User, opt-in) ·
**Priorität:** Hoch · **Abhängig von:** dem deterministischen
Analyse-zu-Lektion-Konverter (`frontend/src/lib/content/analysis-to-lesson.ts`
+ Python-Mirror `analysis_to_lesson.py`), dem deterministischen
Übungsgenerator (`frontend/src/lib/content/exercise-generator.ts`, genutzt von
CreateLesson Schritt 3 und vom Analyse-Konverter), den browser-direkten
KI-Aufrufen (`frontend/src/storage/ai-providers.ts` `aiComplete` /
`aiCompleteWithMeta`, beide Storage-Modi), der KI-Schlüssel-Auflösung
(env > `secrets.yaml` > Fernet-DB-Spalte), der per-Lektion-KI-Review
(`ai-content-validator.ts`, `POST /api/content/validate-lesson`) und
EXP-033 (set-weite KI-Prüfung — teilt sich Prompt-Batching, defensiven
JSON-Parser, Kosten-Schutz, Privacy-Zustimmung) · **Issue:** —

> Design-Dokument. Kein Code. Es beschreibt, **wie** eine importierte oder
> analysierte Lektion, die **nur Theorie-Steps** enthält (Prosa, keine
> strukturierten Karten), per Knopfdruck **Übungen von einer KI generieren**
> lässt. Kern: der Nutzer verwendet seinen **eigenen API-Schlüssel** (bereits
> in Settings > KI konfigurierbar), es ist **kein Server nötig**
> (Dexie-Modus ruft den Provider browser-direkt). Das schließt die Lücke
> zwischen Chat-Import / Theorie-only-Lektion und vollwertiger, spielbarer
> Lektion.

---

## 1. Idee

Wenn eine importierte / analysierte Lektion **nur Theorie-Steps** hat,
bietet die App einen Button **"Übungen generieren"** an. Die KI liest die
Theorie und erzeugt passende, schema-valide Übungen:

- **matching** (Begriffe ↔ Definitionen),
- **cloze** (Lückentexte aus den Erklärungen),
- **free_text** (Verständnisfragen),
- **word_tiles** (Satz / Sequenz aus Token zusammensetzen),
- **multiple_choice** — **gibt es heute NICHT** als Typ (siehe §4.3); in
  Phase 1 über `cloze` im `select`-Modus abgebildet.

Das schließt die Lücke zwischen Chat-Import (reine Theorie) und einer
vollwertigen, spielbaren Lektion. Heute landet ein analysierter Chat als
**Theorie-only-Lektion** (gültig speicherbar seit #796, aber ohne eine
einzige Übung — man kann sie lesen, nicht *üben*).

---

## 2. Problem

Lektionen aus dem **Chat-Import** bestehen aus **reiner Prosa-Theorie, mit
0 Exercises** — sie sind lesbar, aber nicht **lernbar**. Konkret am
beigelegten Beispielset *"Ansible-Grundlagen für Quality Engineering"*
(`manifest.yaml`, `schema_version: 1.4`, Domäne `knowledge`, de→de):

| | Wert (verifiziert aus dem ZIP) |
| --- | --- |
| Lektionen | **4** (`part-1` … `part-4`) |
| Theorie-Steps gesamt | **39** (10 / 10 / 10 / 9) |
| Karten (`cards[]`) | **0** in jeder Lektion |
| Übungen (Exercise-Steps) | **0** in jeder Lektion |

**Warum die bestehenden Generatoren hier nicht helfen:** Sowohl
`analysis-to-lesson.ts` als auch `exercise-generator.ts` bauen Übungen
**aus strukturierten Karten / `vocabulary[]`** (`front`/`back`/`example`).
Das Ansible-Set hat **keine Karten** — nur Fließtext wie *"Übungen, in
denen verschiedene Szenarien beschrieben werden und der Lernende das
passende Modul (file, copy, service, apt, shell) … auswählt"*. Ein
**regelbasierter** Generator kann daraus **nichts** ableiten: er weiß
nicht, dass `file`/`copy`/`service`/`apt`/`shell` Schlüsselbegriffe sind,
welche Definition dazugehört, oder wo eine lehrreiche Cloze-Lücke sitzt.
Genau dieses Lesen-und-Extrahieren aus Prosa **kann nur ein LLM**.

Folge ohne EXP-036: jede chat-importierte Wissens-Lektion bleibt ein
**Read-only-Artefakt**. Der Kern-Nutzen der App (üben, Fehler-Tracking,
adaptive Wiederholung) ist für sie tot.

---

## 3. Architektur-Optionen

### Option A — Button "Übungen generieren" auf der Lektion (user-initiiert)

Auf jeder Oberfläche, die eine Theorie-only-Lektion zeigt
(`SaveOfflineLessonModal` auf `/import/:id`, **"Meine Lektionen"** im
Content Browser, `CreateLesson` Schritt 3), erscheint ein Button. Der
Nutzer entscheidet bewusst, wann er API-Tokens ausgibt.

- **Pro:** volle Kontrolle, klare Kosten-Zuordnung, Feature-State-Policy
  greift sauber (sichtbar+deaktiviert ohne Schlüssel).
- **Contra:** ein zusätzlicher manueller Schritt; Nutzer muss wissen, dass
  es ihn gibt.

### Option B — Automatisch während der Analyse

Der Chat-Analyse-Flow (`/import/:id`) generiert die Übungen **direkt mit**,
sodass nie eine 0-Übungs-Lektion entsteht.

- **Pro:** nahtlos, der Nutzer bekommt sofort eine spielbare Lektion.
- **Contra:** **unfreiwillige API-Kosten** bei jeder Analyse (gegen die
  Kosten-Schutz-Linie von EXP-033); keine Vorschau/Korrektur vor dem
  Speichern; verlängert den ohnehin langen Analyse-Ladevorgang;
  funktioniert nicht für **bereits gespeicherte** Theorie-Lektionen.

### Option C — Hybrid: Vorschlag generieren, User bestätigt (empfohlen)

Der Button (Option A) erzeugt einen **Vorschlag**, der im echten
`LessonViewer` als **Preview** gezeigt wird; der Nutzer **übernimmt oder
verwirft** und kann jede Übung vor dem Speichern **einzeln editieren**
(CreateLesson-Editor). Die generierten Übungs-Steps werden an die
bestehenden Theorie-Steps **angehängt**, dann via
`getStorage().contentLoader.saveUserSet()` persistiert (beide Modi).

- **Pro:** kombiniert Kostenkontrolle (A) mit niedriger Hürde; KI-Output
  ist ein **Vorschlag, kein Diktat**; passt zur bestehenden
  CreateLesson-Preview-Infrastruktur.
- **Contra:** etwas mehr UI-Arbeit (Preview + Diff + Editier-Sprung).

**Empfehlung: Option C.** A ist der Auslöser, C der Flow. B wird
**ausgeschlossen** (Auto-Kosten + keine Korrektur).

---

## 4. Technische Herausforderungen

### 4.1 Prompt-Design: Theorie → strukturierte Exercises

Der Prompt bekommt die **Theorie-Step-Bodies** als Kontext (Domäne, Niveau,
UI-Sprache) und verlangt schema-valides JSON. Pro Lektion, nicht pro Set
(eine Lektion = eine Übungsmenge). Skizze:

```
Du bist Didaktiker. Lies den folgenden Theorie-Text (Domäne: knowledge,
Thema: Ansible für Quality Engineering, Sprache: de) und erzeuge {n}
Übungen, die das Verständnis prüfen.

Erlaubte Typen: matching, cloze, free_text, word_tiles.
- matching: 3-6 Paare Schlüsselbegriff ↔ Kurzdefinition AUS DEM TEXT.
- cloze:    ein Satz aus dem Text mit genau EINER lehrreichen Lücke (___).
- free_text: eine Verständnisfrage; accept[] = akzeptierte Kernantworten.
- word_tiles: eine kurze Sequenz/ein Satz, in Token zerlegt.

Regeln: nur Inhalte aus dem Text, nichts erfinden. Jede Cloze-Lücke hat
GENAU EINE korrekte Antwort. Distraktoren plausibel, aber eindeutig falsch.

Antworte NUR als JSON. Keine Prosa außerhalb des JSON.
```

Herausforderung: das Modell darf **nicht halluzinieren** (keine Module
erfinden, die der Text nicht nennt) und muss **deutschsprachige**
Distraktoren liefern — das Set ist de→de.

### 4.2 Output-Format: `cards[]`-Array (Schlüssel-Entscheidung)

Zwei Wege, das LLM-Ergebnis zu strukturieren:

- **4.2a — direkt `exercises[]`:** Das LLM gibt fertige
  `ContentLessonExercise`-Objekte (`type`, `prompt`, `pairs`, `sentence`,
  `blanks`, `cloze_mode`, `accept`, `distractors`). Maximale Freiheit,
  aber das Modell muss die volle Übungs-Schema-Komplexität treffen.
- **4.2b — `cards[]` + deterministischer Generator (empfohlen):** Das LLM
  extrahiert nur ein **`cards[]`-Array** (`front`/`back`/`example`/
  `token_roles`) aus der Theorie — die *inhaltlich* schwere Aufgabe. Dann
  baut der **bestehende, getestete `exercise-generator.ts`** daraus die
  Übungen (matching/cloze/free_text/word_tiles). Die KI macht nur das, was
  sie allein kann (Prosa→Konzepte); das geprüfte deterministische Gerüst
  macht den Rest.

Vorteil von **4.2b**: kleineres, robusteres LLM-Schema; Wiederverwendung
des validierten Generators; die Übungs-Qualität erbt automatisch alle
bestehenden Generator-Garantien (genau-eine-Cloze-Antwort, ≥2 Accepts,
Direction-Logik EXP-018). Für reine **Verständnisfragen** (free_text), die
sich nicht aus einer Karte ableiten, ergänzt ein kleiner direkter
`exercises[]`-Zweig (4.2a) — Hybrid auf Format-Ebene.

### 4.3 Übungstyp-Auswahl — `multiple_choice` existiert nicht

Das `ExerciseType`-Enum (`schema.py`, `content.ts`) hat **genau fünf**
Werte: `matching`, `picture_choice`, `free_text`, `word_tiles`, `cloze`.
**`multiple_choice` ist keiner davon.** Optionen:

- **Phase 1 (kein Schema-Bump, empfohlen):** Multiple-Choice über
  **`cloze` im `select`-Modus** (Lücke + `distractors[]` = de-facto
  MC-Auswahl). Konzeptfragen als **`free_text`** mit großzügiger
  `accept`-Liste.
- **Später (eigener EXP):** echter `multiple_choice`-Typ → Schema-Bump
  1.4 → 1.5, neuer Renderer, SRS-Verdrahtung, i18n. Nicht in der ersten
  Iteration.

### 4.4 Qualitätssicherung der generierten Übungen

Jede generierte Übung läuft durch den **bestehenden deterministischen
Validator** (`content-validator.ts`: Cloze genau-eine-Antwort, free_text
≥2 Accepts + Distraktoren, matching ≥3 Paare, keine leeren Felder).
**Schlägt sie durch, wird sie verworfen** (oder dem Nutzer zur Korrektur
markiert) — die KI darf nie schema-invalide Übungen einschleusen. Der
defensive JSON-Parser (übernommen aus `ai-content-validator.ts`)
extrahiert das erste valide JSON, verwirft Unbekanntes. Optional schließt
sich die **EXP-033**-Inhaltsprüfung an (separater Call).

### 4.5 Token-Budget (Theorie als Input, Exercises als Output)

- **Input:** die 4 Ansible-Lektionen sind je ~3-12 KB Text → unkritisch.
  Sehr lange Theorie wird **pro Lektion** verarbeitet (nicht das ganze
  Set auf einmal) und nötigenfalls auf die inhaltstragenden Steps
  reduziert (Überschriften + erste N Absätze).
- **Output:** auf `n` Übungen pro Lektion deckeln (Default ~6-8), damit
  die Antwort im Token-Limit bleibt und die Kosten kalkulierbar sind.
- **Kosten-Schätzung VOR dem Start** (wie EXP-033 §3.3): "4 Lektionen,
  ~24 Übungen, geschätzt $0.02". **AbortSignal** für Abbruch (analog zum
  Analyse-Ladeindikator v1.49.0). Kein Auto-Re-Run.

### 4.6 Beide Modi (Dexie Browser-Direct + API)

Pflicht — Dexie-Modus ist Teil des Vertrags:

- **Dexie:** `aiComplete()` aus `ai-providers.ts` (browser-direkt;
  Schlüssel/Provider/Modell aus der IndexedDB `userSettings`-Zeile), exakt
  wie `aiValidateDexie` in `content-loader-dexie-ai.ts`.
- **API:** neuer Endpoint `POST /api/content/generate-exercises` analog
  `validate-lesson`, feuert den `ai_complete`-Hook (Schlüssel
  serverseitig aufgelöst).

Beide teilen sich **Prompt + Parser + Validator**. Da KI-Output **nicht
deterministisch** ist, gibt es **keine Cross-Sprache-Golden-Parität** wie
bei den regelbasierten Generatoren — getestet wird der Parser (gemockte
KI-Antwort → erwartete `cards[]`/`exercises[]`) und das Verwerfen
ungültiger Übungen, nicht der KI-Call selbst.

---

## 5. Roadmap-Tasks

| ID | Task | Aufwand |
| --- | --- | --- |
| AIX-01 | Prompt-Design + defensiver JSON-Parser (Theorie → `cards[]` (4.2b) + ergänzender `exercises[]`-Zweig für free_text) | M |
| AIX-02 | Qualitäts-Gate: jede generierte Übung durch `content-validator.ts`, Ungültiges verwerfen/markieren | S |
| AIX-03 | Beide Modi: `generateExercisesDexie()` über `aiComplete()` + Backend `POST /api/content/generate-exercises` | M |
| AIX-04 | Hybrid-UI (Option C): "Übungen generieren"-Button (Feature-State-Policy) → Preview im `LessonViewer` → übernehmen/verwerfen/editieren, in `SaveOfflineLessonModal` + "Meine Lektionen" + `CreateLesson` | L |
| AIX-05 | Token-Budget + Kosten-Schätzung + Privacy-Zustimmung + `AbortSignal` (aus EXP-033 / v1.49.0 übernehmen) | S |
| AIX-06 | i18n (`content.ai_exercises.*`, alle Kataloge) + Tests (Parser-Fixture, Verwerfen, gemockter KI-Call) | M |

---

## 6. Offene Fragen

1. **`exercises[]` direkt oder `cards[]` + Generator (4.2)?** Empfehlung:
   **`cards[]` + Generator (4.2b)** als Hauptweg, ein schmaler direkter
   `exercises[]`-Zweig nur für free_text-Verständnisfragen.
2. **`multiple_choice` abbilden oder neu (4.3)?** Empfehlung: **Phase 1 auf
   `cloze`-`select` + `free_text`**; echter Typ = eigener EXP + Schema-Bump.
3. **Auch bei Lektionen MIT Karten anbieten?** Empfehlung: nein — dort
   gewinnt der kostenlose **deterministische** Generator. EXP-036 ist der
   Fallback für **karten-/vokabellose Prosa**.
4. **Direction (EXP-018)?** Generierte Übungen brauchen ein `direction`.
   Empfehlung: aus dem Settings-Wert / der `direction_strategy` ableiten,
   Default `target_to_source` (rezeptiv).
5. **Welches Modell?** Wie EXP-033: **Nutzer wählt** (bestehende
   Provider-Auswahl). Reine Extraktion → günstig (`gpt-4o-mini`);
   Verständnisfragen profitieren von einem stärkeren Modell.
6. **Pro Lektion oder pro Set?** Empfehlung: **pro Lektion** (das
   Ansible-Set wären 4 getrennte Generierungen — granular, abbrechbar,
   klar zuordenbar).

---

## 7. Evaluation

### 7.1 Durchgespielt am Ansible-Set (konkret, aus dem ZIP)

Welche Übungen würde EXP-036 aus den 39 Theorie-Steps erzeugen? Belegbar
aus dem realen Text:

| Theorie-Quelle (Originalformulierung) | Generierte Übung |
| --- | --- |
| *"das passende Modul (file, copy, service, apt, shell) … auswählen"* | **matching**: `file`→Dateien/Verzeichnisse · `copy`→Dateien kopieren · `service`→Dienste verwalten · `apt`→Pakete installieren · `shell`→Shell-Befehle |
| *"dem Schlüsselwort 'all' … gezielt mit hosts:-Zeilen ansprechen"* | **cloze**: "`hosts: ___` spricht alle Hosts an" → `all` |
| *"alle wichtigen state-Werte … (absent, directory, stopped, restarted)"* | **matching**: `absent`→entfernt · `directory`→Verzeichnis anlegen · `stopped`→Dienst gestoppt · `restarted`→Dienst neugestartet |
| *"Konzept der Idempotenz — warum Ansible Tasks sicher mehrfach ausführen kann"* | **free_text**: "Was bedeutet Idempotenz bei Ansible?" (accept: "mehrfaches Ausführen ändert nichts / gleiches Ergebnis") |
| *"Unterschied zwischen Task-Sequenzialität und Host-Parallelität"* (Kern-Schwäche) | **free_text**: "Erkläre den Unterschied …" — accept verlangt **beide** Hälften (Tasks nacheinander, Hosts parallel) → trainiert genau die im Set notierte Lücke |
| *"deutsche Wörter 'wenn'/'sonst' statt 'if'/'else'"* (häufiger Fehler) | **cloze**-`select`: Jinja2-Bedingung mit Auswahl `if`/`else` vs. Distraktoren `wenn`/`sonst` |
| *"Tippfehler: 'stoped' statt 'stopped'"* (häufiger Fehler) | **cloze**: "`state: ___`" → `stopped` (Distraktor `stoped`) |

Für die 4 Lektionen ergäbe das grob **~6-8 Übungen je Lektion → ~24-32
Übungen gesamt**, aus einem Set, das heute **0** hat. Bemerkenswert: das
Set notiert die **Fehlermuster des Lernenden** ("Woran wir arbeiten",
"Häufige Fehler") direkt im Theorie-Text — die KI kann daraus **gezielt
auf die Schwächen zugeschnittene** Übungen ableiten (Jinja2 if/else,
stopped, Task- vs. Host-Ebene). Das ist mehr, als ein generischer
Vokabel-Generator je könnte.

### 7.2 Nutzen vs. Aufwand

- **Nutzen: hoch.** Verwandelt jede chat-importierte Wissens-Lektion vom
  Read-only-Artefakt in eine spielbare, fehler-trackbare Lektion — schließt
  die einzige verbleibende Lücke der Chat-Import-Pipeline. Der Hebel ist
  groß: **jede** Domäne (Ansible, Recht, Medizin, Geschichte …) profitiert,
  nicht nur Sprachsets.
- **Aufwand: mittel.** Fast die gesamte Infrastruktur existiert
  (KI-Aufrufe beide Modi, Schlüssel-Auflösung, defensiver Parser aus
  EXP-033, deterministischer Generator + Validator, CreateLesson-Preview).
  EXP-036 verdrahtet Bekanntes neu; der einzige echt neue Teil ist der
  Theorie→`cards[]`-Prompt.

### 7.3 Risiken

- **Halluzination:** Modul/Begriff erfinden, den der Text nicht nennt →
  abgefedert durch "nur aus dem Text" + Qualitäts-Gate, aber semantische
  Falschheit fängt erst die (optionale) EXP-033-Review.
- **Kosten/Erwartung:** Nutzer könnte den Button mehrfach drücken →
  Kosten-Schätzung + Bestätigung + kein Auto-Re-Run.
- **Qualität schwankt mit Modell/Domäne:** Fachdomänen (Ansible) brauchen
  ein stärkeres Modell als einfache Vokabeln → Nutzer wählt Provider.

### 7.4 Empfehlung

**Umsetzen, Option C (Hybrid), Format 4.2b (`cards[]` + Generator).**
Hoher Nutzen, moderater Aufwand auf vorhandener Infrastruktur, sauber
gegen die anderen EXPs abgegrenzt (§ Verwandte Dokumente). Reihenfolge:
AIX-01/02 (Kern + Gate) → AIX-03 (beide Modi) → AIX-04/05 (UI + Schutz) →
AIX-06 (i18n + Tests).

---

## Verwandte Dokumente

- [EXP-013 — Fehler-basierte adaptive Lektionen](EXP-013-...) — regelbasierte
  Generierung aus Fehlern; EXP-036 ist der prosa-basierte Gegenpart.
- [EXP-021 — Lektions-Creator](EXP-021-lesson-creator.md) — der
  deterministische Übungsgenerator in Schritt 3; EXP-036 ergänzt ihn.
- [EXP-033 — KI-gestützte Content-Validierung](EXP-033-ai-content-validation.md)
  — teilt Prompt-Batching, JSON-Parser, Kosten-Schutz, Privacy-Zustimmung
  (prüft, statt zu erzeugen).
- [EXP-018 — Übungsrichtung](EXP-018-exercise-direction.md) — generierte
  Übungen brauchen ein `direction`.
