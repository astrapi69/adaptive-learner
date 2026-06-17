# EXP-032: Inhaltliche Content-Validierung (Content Quality Validation)

**Kategorie:** Querschnitt · **Phase:** gestuft (Wörterbuch → LLM → Community) ·
**Priorität:** Hoch · **Abhängig von:** der bestehenden Schema-Validierung
(`scripts/validate_content.py`, `frontend/src/lib/content/content-validator.ts`,
`backend/.../content-loader`), dem Content-Repo
[astrapi69/adaptive-learner-content](https://github.com/astrapi69/adaptive-learner-content)
und seiner CI, EXP-013 (fehler-basierte adaptive Lektionen, liefert die
Sprach-Klassifikation), EXP-028 (Event-Recording, liefert die Melde-Infrastruktur),
EXP-030 (Multi-User, Voraussetzung für moderierte Community-Reviews) · **Issue:** —

> Design-Dokument. Kein Code. Es beschreibt, **wie** Adaptive Learner die
> Korrektheit des **Inhalts** einer Lektion prüft — nicht nur, ob die JSON-Struktur
> stimmt. Die zentrale Aussage: die heutige Validierung garantiert ein
> **wohlgeformtes**, aber nicht ein **richtiges** Lernpaket. Falsche
> Übersetzungen, fehlende Akzente und falsche Artikel passieren jede Prüfung.
> Der Weg dahin ist gestuft: zuerst billige, deterministische
> **Wörterbuch-Abgleiche** (Akzente, Artikel, Sprachpaar), dann eine optionale,
> teure **LLM-Review** als Vision, schließlich eine **Community-Review-Pipeline**,
> sobald Multi-User (EXP-030) existiert.

---

## 0. Was es heute schon gibt (Ist-Stand)

Die Validierung ist **zweischichtig** und rein **strukturell**:

- **`scripts/validate_content.py`** (Content-Repo-CI) und der Spiegel
  `frontend/src/lib/content/content-validator.ts` (gated *Share with Community*)
  prüfen: Schema-Version, Sprachpaar-**Felder** (`source_language`/`target_language`
  vorhanden + ISO-Code), Qualitäts-**Minima** (≥ 5 Übungen, ≥ 2 Typen, ≥ 1 Theorie,
  Freitext ≥ 2 Accepts + Distraktoren, Matching ≥ 3 Paare, keine leeren Karten).
- Die optionale **AI-Content-Review** (`ai-content-validator.ts`, EXP seit v1.44.0)
  kann *auf Wunsch* Übersetzung/Grammatik/Niveau prüfen — sie **blockiert nie**
  das Teilen und braucht einen API-Key, läuft also nicht in der CI.

**Die Lücke:** all das prüft **Form**, nicht **Wahrheit**. Eine Karte
`{ front: "der Mädchen", back: "the girl" }` ist schema-valide, sprachpaar-konsistent,
nicht leer — und trotzdem falsch (`das Mädchen`). Genau diese Klasse von Fehlern
fällt heute erst dem Lernenden auf, der dann **die falsche Antwort als richtig lernt**.

---

## 1. Problem

`validate_content.py` prüft das **Schema**, nicht den **Inhalt**. Drei Fehlerklassen
passieren die Validierung ungehindert:

| Klasse | Beispiel (de→es / de→fr) | heute erkannt? |
| --- | --- | --- |
| Falsche Übersetzung | `gato → "Hund"` statt `"Katze"` | nein |
| Fehlende Akzente | `corazon` statt `corazón`, `etre` statt `être` | nein |
| Falscher Artikel | `la problema` statt `el problema`, `der Mädchen` statt `das` | nein |
| Verdächtige Antwortlänge | Freitext-Accept `"."` oder ein 400-Zeichen-Absatz | nein |
| Encoding-Schaden | `Ã¶` (doppelt UTF-8-kodiertes `ö`), `cafe?` | teilweise (nur wenn JSON bricht) |

Der gemeinsame Nenner: es braucht **Wissen über die Zielsprache**, nicht nur über
die Dateistruktur. Genau dieses Wissen lässt sich in drei Stufen einbringen —
billig-deterministisch, teuer-probabilistisch, menschlich.

---

## 2. Automatisierbare Prüfungen (Stufe 1 — deterministisch, kein API-Key)

Alle in der **Content-Repo-CI** und client-seitig im *Share*-Gate lauffähig, ohne
Netzwerk oder Modell. Output je Befund: `error` (blockiert) oder `warning`
(Hinweis, blockiert nicht).

### 2.1 Sprachpaar-Konsistenz

Das `source_language`-Feld muss zum **tatsächlichen** Text der Kartenrückseiten
(Theorie, Notizen) passen, `target_language` zur Vorderseite. Realisierung über
eine leichte **Sprach-Erkennung** (`lib/content/detect-language` existiert bereits
für den Import via Stopwort-/Digraph-Heuristik). Erkennt das offensichtliche
Vertauschen von Quelle/Ziel und Sets, die als „fr für Deutsche" deklariert sind,
aber englischen Theorietext tragen. → `warning` (Heuristik), `error` bei klarem
Widerspruch über viele Karten.

### 2.2 Duplikat-Erkennung

Gleiche Frage/Karte in mehreren Lektionen desselben Sets (oder set-übergreifend).
Normalisierter Vergleich (lowercase, Akzente entfernt, Whitespace) über
`front`+`back`. Baut auf der vorhandenen `lib/content/duplicate-detection.ts`
(heute Lektions-Ebene im Share-Wizard) auf, hochgezogen auf Set-/Repo-Ebene.
→ `warning` (gewollte Wiederholung ist legitim, aber sichtbar machen).

### 2.3 Akzent-Check (Wörterbuch-Abgleich)

Wörter, die in der Zielsprache einen Akzent **brauchen**, aber keinen haben.
Pro Sprache eine **Wortliste der akzentuierten Formen** (`es`, `fr`, `pt`; für `de`
die Umlaut-/ß-Formen). Algorithmus: tokenisieren → für jedes Token die
**akzent-entfernte** Form bilden → wenn diese Form NUR als akzentuierte Variante
im Wörterbuch existiert (`corazon` ∉ Wörterbuch, `corazón` ∈ Wörterbuch), ist das
fehlende Akzent fast sicher ein Fehler. → `warning` mit Vorschlag
(`corazon → corazón?`). Quelle der Wortlisten: frei lizenzierte Frequenzlisten
(z. B. Hunspell-Wörterbücher), als kompaktes Set im Repo / als Build-Artefakt.

### 2.4 Artikel-Check (Spanisch / Französisch / Deutsch)

Nomen-Artikel-Paare gegen ein **Genus-Wörterbuch** prüfen. Pro Sprache eine
Map `nomen → {genus, artikel}` (`problema → masculino → el`,
`Mädchen → neutrum → das`). Algorithmus: Artikel-Nomen-Bigramme im Kartentext
finden → Genus des Nomens nachschlagen → mit dem geschriebenen Artikel vergleichen.
→ `warning` mit Korrektur (`la problema → el problema`). Bewusst konservativ:
nur eindeutige Nomen mit einem einzigen Genus werden geprüft (homonyme wie
`el/la capital` werden übersprungen, um Fehlalarme zu vermeiden).

### 2.5 Antwort-Länge (Plausibilität)

Verdächtig kurze oder lange Antworten heuristisch markieren: Freitext-Accepts
unter ~2 Zeichen oder über einer Satzlänge, Matching-Begriffe mit nur einem
Zeichen, Cloze-Lücken die das halbe Wort sind. → `warning`. Fängt Tippfehler
(`"a"` statt `"agua"`) und versehentlich eingefügte Absätze.

### 2.6 Encoding (korrekte UTF-8 Umlaute/Akzente)

Auf **Mojibake** prüfen: doppelt-kodierte Sequenzen (`Ã¶`, `Ã©`, `Ã±`),
Ersetzungszeichen (`�` / U+FFFD), und — passend zur Projektregel „echte Umlaute
im Content" — ASCII-Transliterationen (`oe`/`ss`) in Sprachen, die Umlaute
erwarten. Deterministisch, sprach-unabhängig. → `error` bei Mojibake/U+FFFD,
`warning` bei Transliteration.

**Warum Stufe 1 zuerst:** kein API-Key, kein Netzwerk, deterministisch (CI-tauglich),
und sie deckt die häufigsten realen Fehler ab (Akzent + Artikel + Encoding). Die
Wortlisten sind das einzige neue Asset.

---

## 3. LLM-gestützte Prüfung (Stufe 2 — optional, teuer, Vision)

Was eine Wortliste nicht kann: beurteilen, ob eine **ganze Übersetzung im Kontext
stimmt** (`"Es gibt"` vs. `"Hay"` vs. `"Está"`), ob das **CEFR-Niveau** passt, ob
eine Wendung **idiomatisch** ist.

- **Mechanik:** jede Karte (oder Karten-Batch) durch ein LLM prüfen lassen —
  „Ist diese Übersetzung `{front}` → `{back}` für `{source}`→`{target}` korrekt und
  niveau-gerecht? Antworte mit Score + Begründung." Läuft über die bestehenden
  `ai_complete`-Provider, also Anthropic/OpenAI/Gemini.
- **Batch-Verarbeitung, nur bei Releases:** nicht pro Share, nicht in der PR-CI
  (Kosten + Nichtdeterminismus). Eher ein separater, manuell oder per
  Release-Workflow ausgelöster Lauf über das gesamte Content-Repo.
- **Ergebnis: Confidence-Score pro Karte** (z. B. 0–1) + Freitext-Begründung,
  abgelegt als Report-Artefakt. Niedrige Scores werden zu Review-Aufgaben für
  den Maintainer, **nicht** zu automatischen Änderungen — das LLM schlägt vor,
  ein Mensch entscheidet (wie die heutige `ai-content-validator.ts`, die nie blockt).
- **Warum Vision, nicht jetzt:** Kosten (jede Karte = ein Call), Nichtdeterminismus
  (kein CI-Gate), und die Halluzinationsgefahr (ein LLM, das eine korrekte
  Übersetzung als falsch markiert, erzeugt Rauschen). Erst sinnvoll, wenn Stufe 1
  die billigen Fehler schon weggeräumt hat.

---

## 4. Community-Review-Pipeline (Stufe 3 — menschlich, nach EXP-030)

Die letzte Instanz ist der Lernende selbst — er merkt als Erster, wenn eine Antwort
falsch ist.

- **Fehler-Melden-Button in der App (pro Karte):** in der Lektion/Review ein
  dezentes „Diese Antwort ist falsch"-Control je Karte. Baut auf der
  **EXP-028-Melde-Infrastruktur** (`eventRecorder`, „Report Issue") auf, die heute
  schon technische Fehler als GitHub-Issue formuliert.
- **Meldung → GitHub-Issue im Content-Repo:** die Meldung landet **nicht** im
  App-Repo, sondern als strukturiertes Issue im
  `adaptive-learner-content`-Repo, mit Set/Lektion/Karten-ID, gemeldetem vs.
  erwartetem Wert und Melde-Kontext (Sprachpaar, App-Version). Genau die
  „GitHub-Issue direkt actionable"-Disziplin, die das Projekt für Bugs schon hat.
- **Content-Maintainer reviewt und fixt:** das Issue ist die Queue; der Fix ist
  ein PR im Content-Repo, der die Stufe-1-CI durchläuft. Schließt den Kreis:
  gemeldeter Inhaltsfehler → Issue → PR → CI → neue Content-Version.
- **Warum nach EXP-030:** moderierte Community-Beiträge (Vertrauensstufen,
  Reputationsgewichtung, Schutz vor Spam-Meldungen) brauchen die Multi-User-Identität
  aus EXP-030. Der **anonyme** Melde-Button (Issue ohne Nutzerkonto) ist dagegen
  schon früher möglich und ein sinnvoller Zwischenschritt.

---

## 5. Roadmap (CQV-01 … CQV-05)

| ID | Titel | Stufe | Abhängig von | Priorität |
| --- | --- | --- | --- | --- |
| **CQV-01** | Encoding- + Antwortlängen-Checks in `validate_content.py` + Client-Validator | 1 | Ist-Validierung | Hoch |
| **CQV-02** | Sprachpaar-Konsistenz- + Duplikat-Check (Set-/Repo-Ebene) | 1 | CQV-01, `detect-language` | Hoch |
| **CQV-03** | Akzent- + Artikel-Wörterbücher (es/fr/pt/de) + Abgleich | 1 | CQV-01, Wortlisten-Asset | Hoch |
| **CQV-04** | Batch-LLM-Review mit Confidence-Score-Report (Release-Lauf) | 2 | `ai_complete`, CQV-03 | Mittel |
| **CQV-05** | Fehler-Melden-Button → Content-Repo-Issue (anonym; moderiert nach EXP-030) | 3 | EXP-028, (EXP-030) | Mittel |

Reihenfolge bewusst: CQV-01..03 sind deterministisch, CI-fähig und decken die
häufigsten realen Fehler ab; CQV-04 ist die teure Tiefenprüfung; CQV-05 schließt
den Loop mit dem Menschen.

---

## 6. Empfehlung

1. **Nächster Schritt: Wörterbuch-Abgleich (Akzente + Artikel), CQV-03 — plus die
   billigen CQV-01/02-Checks.** Deterministisch, kein API-Key, CI-tauglich, und sie
   fangen genau die Fehler, die heute durchrutschen und die ein Lernender als
   „falsch gelernt" verinnerlicht. Das einzige neue Asset sind frei lizenzierte
   Wortlisten.
2. **LLM-Review (CQV-04) als Vision.** Wertvoll für Idiomatik/Kontext/Niveau, aber
   teuer und nichtdeterministisch — erst sinnvoll, wenn Stufe 1 das Billige
   erledigt hat. Nie ein blockierendes Gate, immer Vorschlag-an-Mensch.
3. **Community-Review (CQV-05) nach Multi-User (EXP-030).** Der anonyme
   Melde-Button kann früher kommen; die moderierte, reputationsgewichtete Variante
   braucht die Identität aus EXP-030.

Leitsatz: **Form ist validiert, Wahrheit noch nicht.** Stufe 1 macht Wahrheit
billig und deterministisch prüfbar; Stufe 2 und 3 ergänzen, was nur ein Modell
oder ein Mensch beurteilen kann.

---

## 7. Offene Fragen

- **Wortlisten-Pflege:** woher die Genus-/Akzent-Listen, in welchem Lizenz-Rahmen,
  und wie groß dürfen sie im Repo / als Build-Artefakt werden, ohne den
  GH-Pages-Build aufzublähen?
- **Fehlalarm-Schwelle:** ab welcher Heuristik-Sicherheit wird ein Befund `error`
  (blockiert) statt `warning`? Ein zu strenger Artikel-Check blockiert legitime
  Sonderfälle (Eigennamen, Homonyme).
- **LLM-Kostenbudget:** ein Voll-Repo-Lauf bei N Karten = N Calls — pro Release
  tragbar, oder nur für geänderte Karten (Diff-getrieben)?
- **Melde-Missbrauch:** wie wird der anonyme Melde-Button gegen Spam/Trolling
  geschützt, bevor EXP-030 Identität liefert (Rate-Limit? clientseitiges
  Sammeln + Sammel-Issue?)?
- **Mehrwert-Überlapp mit der bestehenden `ai-content-validator.ts`:** CQV-04 und
  der heutige optionale AI-Review teilen sich Mechanik — eine Implementierung,
  zwei Auslöser (Share-Zeit vs. Release-Batch)?

---

## 8. Bezug zu anderen EXPs / Issues

- **EXP-013** (fehler-basierte adaptive Lektionen) liefert die sprach-spezifische
  Fehler-Klassifikation (`article_gender`, `spelling_accent`, …), die die
  Stufe-1-Checks spiegeln.
- **EXP-028** (User-Event-Recording) liefert die „Report Issue"-Infrastruktur, auf
  der CQV-05 aufsetzt.
- **EXP-030** (Multi-User-Strategie) ist Voraussetzung für die moderierte Variante
  von CQV-05.
- **EXP-002 / 003 / 005** (Content-Repository, Lektionsformat, Offline-Modus)
  definieren das Lektions- und Set-Schema, gegen das hier inhaltlich geprüft wird.
- Bestehende Validierung: `scripts/validate_content.py`,
  `frontend/src/lib/content/content-validator.ts`,
  `frontend/src/lib/content/ai-content-validator.ts`,
  `frontend/src/lib/content/duplicate-detection.ts`.
