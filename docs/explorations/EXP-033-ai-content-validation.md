# EXP-033: KI-gestützte Content-Validierung (AI Content Validation)

**Kategorie:** Querschnitt · **Phase:** gestuft (App-User → CI → Community) ·
**Priorität:** Mittel · **Abhängig von:** der bestehenden
per-Lektion-KI-Review (`frontend/src/lib/content/ai-content-validator.ts`,
Backend `POST /api/content/validate-lesson`, ausgeliefert in v1.44.0), der
KI-Schlüssel-Auflösung (Settings > KI: env > `secrets.yaml` >
Fernet-DB-Spalte), EXP-032 (deterministische Content-Validierung — die
billige, kostenlose Vorstufe), EXP-023 (Multi-Content-Repository),
EXP-028 (Event-Recording, Melde-Infrastruktur), EXP-030 (Multi-User,
Voraussetzung für serverseitige Verifikation + Community-Review) ·
**Issue:** —

> Design-Dokument. Kein Code. Es beschreibt, **wie** Content-Autoren und
> Lernende die **inhaltliche** Qualität eines Lernsets von einer KI prüfen
> lassen — Übersetzungsfehler, falsche Artikel, fehlende Akzente,
> unplausible Distraktoren. Kern: der Nutzer verwendet seinen **eigenen
> API-Schlüssel** (bereits in Settings > KI konfigurierbar), es ist **kein
> Server nötig**. EXP-033 ist die KI-Schicht; die kostenlose,
> deterministische Schicht ist EXP-032. Beide ergänzen sich.

---

## 0. Was es heute schon gibt (Ist-Stand)

Damit dieses Dokument nicht eine bereits gebaute Funktion neu erfindet:

- **`ai-content-validator.ts` + `POST /api/content/validate-lesson`**
  (v1.44.0, beide Storage-Modi): eine **opt-in** KI-Review **pro Lektion**
  für Übersetzung / Grammatik / Niveau / kulturelle Korrektheit, mit
  Auto-Fix-Vorschlag **je Einzelproblem**. Sie blockiert das Teilen nie
  (advisory). Aufgerufen aus dem *Share with Community*-Flow.
- **KI-Schlüssel-Kette** (Phase 34): jeder KI-Aufruf läuft env >
  `~/.config/adaptive_learner/secrets.yaml` > Fernet-DB-Spalte > keiner.
  Drei Provider-Plugins (Anthropic / OpenAI / Gemini), Modell wählbar in
  Settings.
- **Rate-Limiting** (3-Tier Token-Bucket) auf den Backend-API-Routen.

**Was fehlt — und genau das ist EXP-033:** der Schritt vom
**per-Lektion**-Check zu einer **set-weiten Batch-Prüfung** mit
Fortschrittsanzeige, persistiertem Ergebnis-Report, Kosten-Schutz, einer
**CI-Action für Autoren** und einem **Signatur-Verfahren**, das eine
stattgefundene KI-Prüfung nachweisbar macht. EXP-033 baut auf dem
v1.44.0-Validator auf und hebt ihn auf Set-Ebene.

---

## 1. Idee

Content-Autoren und Lernende können die Qualität von Lektionen durch eine
KI prüfen lassen. Die KI findet, was eine reine Schema- oder
Wörterbuch-Prüfung nicht findet:

- Übersetzungsfehler (falsche Bedeutung, nicht nur falsche Schreibung),
- falsche Artikel (`el`/`la`, `le`/`la`, `der`/`die`/`das`),
- fehlende oder falsche Akzente (`ñ`, `á`, `é`, `í`, `ó`, `ú`, `ü`),
- Grammatik- und Konjugationsfehler (z. B. Personen-Mismatch),
- unplausible Distraktoren (zu offensichtlich falsch, oder versehentlich
  ebenfalls richtig),
- Cloze-Lücken ohne genau eine korrekte Antwort.

Kein eigener Server nötig: der Nutzer hat seinen API-Schlüssel bereits in
Settings > KI hinterlegt. Die App sammelt die Karten und schickt sie
batch-weise an den vom Nutzer gewählten Provider.

### Drei Ansätze, aufsteigend in Komplexität

| Ansatz | Wer | Wann | Status in EXP-033 |
| --- | --- | --- | --- |
| **1. App, user-initiiert** | Lernende + Autoren | manuell per Button | **Phase 1, empfohlen** |
| **2. CI-Pipeline** | Content-Autoren | bei PRs im Content-Repo | Phase 1 (additiv) |
| **3. Community-Review mit KI** | Lernende → Maintainer | "Fehler melden" beim Lernen | Phase 2 (braucht EXP-030) |

Empfehlung: **Ansatz 1 zuerst, in der App.** Ansatz 2 ist eine kleine
additive Ergänzung. Ansatz 3 setzt Multi-User (EXP-030) voraus.

---

## 2. User-Flow

### 2.1 In der App (Settings > Daten oder Content Browser)

1. **Set auswählen.**
2. **Button "Mit KI prüfen"** — nur aktiv, wenn ein API-Schlüssel
   gesetzt ist. Ohne Schlüssel gilt die Feature-State-Policy
   (`FUNKTION-NICHT-VERFÜGBAR`): sichtbar, aber deaktiviert, mit
   lokalisiertem Grund (`feature.api_key_required`) als Tooltip — nicht
   versteckt.
3. **Fortschritt:** "Prüfe Batch 1 von 5 ..." (echter Fortschritt + Abbruch
   via `AbortSignal`, analog zum Analyse-Ladeindikator aus v1.49.0).
4. **Ergebnis-Report:**

   ```
   Lernset: Spanisch A1
   Geprüft: 120 Karten in 15 Lektionen

   ✅ 115 Karten OK
   ⚠️ 5 Karten mit Problemen:

   Lektion 3, Karte "libro":
     - Problem:   Artikel "la" statt "el"
     - Vorschlag: "el libro" (maskulin)

   Lektion 7, Karte "cafe":
     - Problem:   Akzent fehlt
     - Vorschlag: "café"
   ```

5. **Button "Auto-Fix"** (optional, gefährlich): korrigiert die Karten
   automatisch. **Nur für nutzer-eigene Lektionen**, nie für offizielle
   (Trust 2/3) Repos. Bestätigung erforderlich: "Soll die KI 5 Karten
   korrigieren?" Der Auto-Fix arbeitet auf den **Vorschlägen** des
   Reports, nicht auf einem neuen KI-Aufruf.

### 2.2 Im Content-Repo (CI, für Autoren)

GitHub Action `ai_review.py`:

- läuft auf PRs **nur**, wenn ein Secret `OPENAI_KEY` (bzw.
  provider-spezifisch) existiert,
- postet das Ergebnis als **PR-Kommentar**,
- **blockiert nicht** (Warnung, kein Gate) — konsistent mit der
  bestehenden Content-Repo-CI, in der die KI-Review nie ein Hard-Gate ist,
- läuft nur bei PRs, nicht bei jedem Push (Kosten).

Pipeline-Reihenfolge im Content-Repo:

```
validate_content.py   → Schema OK?           (kostenlos, Gate)
audit_content.py       → Duplikate/Struktur?  (kostenlos, EXP-032)
ai_review.py           → Inhaltlich korrekt?  (kostet API, Warnung)
```

### 2.3 Community-Review mit KI (Ansatz 3, Phase 2)

Beim Lernen findet ein Nutzer einen Fehler, klickt "Fehler melden". Die
App schickt Karte + Nutzer-Kommentar an die KI, die den Fehler bestätigt
oder ablehnt. Bestätigte Fehler werden als GitHub-Issue im Content-Repo
angelegt (nutzt die EXP-028-Melde-Infrastruktur). Setzt Multi-User
(EXP-030) und die "Als Issue melden"-Schicht voraus.

---

## 3. Technische Details

### 3.1 Prompt-Engineering

Strukturierter Prompt **pro Batch (max. 10 Karten)**, mit Sprachpaar und
Niveau im Kontext:

```
Du bist ein Sprachlehrer und Qualitätsprüfer.
Prüfe diese Lernkarten (Quellsprache: Deutsch,
Zielsprache: Spanisch, Niveau: A1).

Pro Karte prüfen:
1. Übersetzung korrekt?
2. Artikel korrekt? (el/la/los/las)
3. Konjugation korrekt?
4. Akzente vollständig? (ñ, á, é, í, ó, ú)
5. Distraktoren plausibel, aber eindeutig falsch?
6. Cloze-Lücke hat genau eine korrekte Antwort?

Antworte NUR als JSON-Array:
[{"card_id": "...", "ok": true/false,
  "issues": [{"field": "back", "problem": "...",
  "suggestion": "..."}]}]
Keine Erklärungen außerhalb des JSON.
```

Der JSON-Parser ist defensiv: er extrahiert das erste valide JSON-Array
aus der Antwort (Modelle hängen gelegentlich Prosa an), validiert gegen
ein festes Schema (`card_id` muss zum Batch gehören) und verwirft
unbekannte `card_id`s.

### 3.2 API-Provider

Dieselben Provider wie in den KI-Settings (bereits implementiert):

- **OpenAI** (`gpt-4o-mini` reicht, günstig),
- **Anthropic** (Claude Sonnet, genauer),
- **Gemini**.

Der Nutzer wählt den Provider in Settings; EXP-033 fügt keine neue
Provider-Auswahl hinzu, es nutzt die bestehende.

### 3.3 Kosten-Schutz

- max. **10 Karten pro API-Call** (Batch),
- max. **500 Karten pro Prüfung** (= 50 Calls); größere Sets werden
  gestückelt oder der Nutzer wählt einzelne Lektionen,
- **geschätzte Kosten VOR dem Start anzeigen:** "~120 Karten, geschätzt
  $0.05",
- **Rate-Limiting:** max. 1 Prüfung pro Minute,
- **Ergebnis cachen** (nicht bei jedem Klick neu prüfen) — siehe 3.4.

### 3.4 Ergebnis-Persistenz

- Report als **JSON in Dexie** speichern (pro Set, mit Timestamp;
  API-Modus: Filesystem-Cache analog zur Content-Cache),
- "Letzte Prüfung: heute, 12:05 — 5 Probleme",
- Report **erneut anzeigbar ohne erneuten API-Call**,
- **Export als Markdown** (für GitHub-Issues / PR-Kommentare).

### 3.5 Privacy

- Karten-Inhalte gehen an den API-Provider des Nutzers.
- Der Nutzer muss dem **bewusst, einmalig zustimmen**: "Deine Lernkarten
  werden an [Provider] zur Qualitätsprüfung gesendet. Einverstanden?"
- Lernkarten sind **Lerninhalt, keine personenbezogenen Daten** — keine
  PII. Die Zustimmung deckt nur den Lerninhalt ab.

---

## 4. Abgrenzung zu EXP-032

| | EXP-032 | EXP-033 |
| --- | --- | --- |
| Methode | deterministisch (Wörterbuch, Duplikate, Schema) | KI-gestützt (LLM-Review) |
| Kosten | keine, kein API-Call | API-Call, Kosten |
| Findet | `cafe` vs `café`, Schema, Duplikate | semantische Fehler, z. B. `Ganamos → habían ganado` (Personen-Mismatch) |
| Gate? | kann blockieren | nie blockierend (advisory) |

Ein Wörterbuch findet `cafe` vs `café`. Den Personen-Mismatch
`Ganamos → habían ganado` findet **nur** eine KI.

**Empfehlung:** EXP-032 zuerst (kostenlos, deterministisch), EXP-033 als
Ergänzung für die Fälle, die EXP-032 nicht abdeckt. Beide laufen in der
gleichen CI-Pipeline nacheinander (siehe 2.2).

---

## 5. Signatur-Verfahren für AI-Validation

### 5.1 Ziel

Nachweisbar machen, dass eine KI-Prüfung **stattgefunden** hat. Andere
Nutzer sehen ein "KI-geprüft"-Badge und können der Prüfung vertrauen,
ohne sie selbst zu wiederholen (und ohne erneute API-Kosten).

### 5.2 Signatur-Objekt (im Set-Manifest)

```yaml
ai_validation:
  content_hash: "sha256:a1b2c3..."
  result: "passed"
  checked_cards: 120
  issues_found: 0
  provider: "openai/gpt-4o-mini"
  response_id: "chatcmpl-abc123def456"
  timestamp: "2026-06-17T12:00:00Z"
  checker_version: "1.0"
```

Additives, optionales Feld im Set-Manifest (Schema bleibt rückwärts-
kompatibel; Sets ohne `ai_validation` laden unverändert).

### 5.3 Content-Hash-Berechnung

SHA-256 über alle Karten des Sets, **deterministisch**: sortiert nach
`card_id`, `JSON.stringify` ohne Whitespace, feste Feldreihenfolge.
Ändert sich eine Karte, ändert sich der Hash — und die Signatur wird
**ungültig**. Genau dasselbe Verfahren muss client- und CI-seitig
implementiert sein (Cross-Sprache-Parität, analog zu den bestehenden
Parity-Goldens in `tests/fixtures/`), sonst driften die Hashes.

### 5.4 Verifikation (3 Stufen)

**Stufe 1 (Client, offline):**

- `content_hash` stimmt mit den lokalen Karten überein?
- Signatur-Felder vollständig?
- `timestamp` nicht in der Zukunft?
- → Badge: "KI-geprüft" oder "Signatur ungültig".

**Stufe 2 (Client, online, optional):**

- `response_id`-Format passt zum Provider? (OpenAI: `chatcmpl-...`,
  Anthropic: `msg_...`)
- Timestamp plausibel (nicht älter als der Content)?

**Stufe 3 (Server, Zukunft / EXP-030):**

- `response_id` gegen die Provider-API verifizieren (bei OpenAI gibt es
  kein öffentliches `GET /chat/completions/{id}`, aber der Aufruf ist im
  Account-Log einsehbar),
- ein eigener Verifikations-Endpoint.

### 5.5 Fälschungs-Schutz

- `response_id` ist nicht erratbar (UUID-ähnlich),
- ohne echten API-Call lässt sich keine gültige `response_id` erzeugen,
- der Content-Hash verhindert "alte Signatur auf neuen Content kleben",
- **nicht 100% fälschungssicher** (Client-Manipulation bleibt möglich),
  aber "gut genug" für ein Community-Trust-System,
- Stufe 3 (Server) wäre der einzig wirklich sichere Weg.

### 5.6 Trust-Level-Integration

Neuer Badge-Typ in der App: **"AI-Checked ✓"** wenn die Signatur gültig
ist. Einordnung **zwischen "Validated" (Trust 1) und "Verified"
(Trust 2)**: technisch validiert **und** KI-geprüft, aber noch nicht
menschlich verifiziert. Das reduziert den manuellen Review-Aufwand für
Maintainer — sie müssen nur die KI-Ergebnisse sichten, nicht jede Karte
einzeln. (Trust-Level-Definitionen: siehe
[CONTENT-REPO-GUIDE.md](../CONTENT-REPO-GUIDE.md), §6.)

---

## 6. Roadmap

| ID | Task | Aufwand |
| --- | --- | --- |
| AIV-01 | Prompt-Engineering + JSON-Parser (set-weit, batched) | S |
| AIV-02 | "Mit KI prüfen"-Button im Content Browser | M |
| AIV-03 | Ergebnis-Report-UI | M |
| AIV-04 | Ergebnis-Caching in Dexie (+ API-Modus) | S |
| AIV-05 | Kosten-Schätzung + Bestätigung | S |
| AIV-06 | CI-Action `ai_review.py` (Content-Repo) | M |
| AIV-07 | Auto-Fix (optional, nur User-Content) | L |
| AIV-08 | Content-Hash-Berechnung (SHA-256, deterministisch) | S |
| AIV-09 | Signatur-Objekt im Manifest speichern | S |
| AIV-10 | Client-Verifikation (Stufe 1+2) | M |
| AIV-11 | "KI-geprüft"-Badge im Content Browser | S |
| AIV-12 | Signatur invalidieren bei Content-Änderung | S |

---

## 7. Offene Fragen

1. **Prüfung pro Set oder pro Lektion?** Empfehlung: **pro Set** (weniger
   Klicks, effizienter; der v1.44.0-Validator ist pro Lektion und bleibt
   für den Share-Flow erhalten).
2. **Welches Modell?** `gpt-4o-mini` ist am günstigsten
   (~$0.15/1M Tokens). Claude Sonnet genauer, aber teurer. Empfehlung:
   **Nutzer wählt** (bestehende Provider-Auswahl in Settings).
3. **Auto-Fix zu riskant für offizielle Repos?** Empfehlung: **nur für
   nutzer-eigene Lektionen**, nie für Trust 2/3 Repos.
4. **Report als GitHub-Issue im Content-Repo anlegen?** Empfehlung: ja,
   "Als Issue melden"-Button — aber erst nach Multi-User (EXP-030).
5. **Hash-Parität:** wer ist die kanonische Referenz-Implementierung des
   Content-Hash (TS-Client vs. Python-CI)? Empfehlung: ein geteiltes
   Golden-Fixture pinnt beide (wie bei den bestehenden
   Cross-Sprache-Parity-Tests).

---

## Verwandte Dokumente

- [EXP-032 — Inhaltliche Content-Validierung](EXP-032-content-quality-validation.md)
  (die deterministische Vorstufe)
- [CONTENT-REPO-GUIDE.md](../CONTENT-REPO-GUIDE.md) (Trust-Levels,
  Qualitätsanforderungen)
- [EXP-023 — Multi-Content-Repository](EXP-023-multi-content-repository.md)
- [EXP-028 — User-Event-Recording](EXP-028-user-event-recording.md)
  (Melde-Infrastruktur für Ansatz 3)
- [EXP-030 — Multi-User-Strategie](EXP-030-multi-user-strategy.md)
  (Voraussetzung für serverseitige Verifikation + Community-Review)
