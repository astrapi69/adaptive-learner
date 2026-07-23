# Werkzeuge: die drei Säulen

AdaptiveLearner versucht nicht, dein einziges Lernwerkzeug
zu sein. Es versucht, der Orchestrator zu sein, der dich auf
das richtige externe Werkzeug für das verweist, was du
gerade tust. Fünf Werkzeuge sind im Katalog, abgebildet auf
drei Säulen.

## Die drei Säulen

### 1. Spaced Repetition

Die Kognitionsforschung ist sich einig: verteilte
Wiederholung schlägt geballte Wiederholung beim
Langzeitbehalten. Das Intervall zwischen Wiederholungen
zählt; Tools wie Anki machen daraus eine Disziplin.

**Empfohlenes Werkzeug**: [Anki](https://apps.ankiweb.net/).
Kostenlos auf Desktop, kostenpflichtig auf iOS, der
Scheduler-Algorithmus ist gut eingestellt, und es ist der
De-facto-Standard. Die meisten anderen Apps in diesem Raum
kopieren Ankis Intervalle.

**Wofür**: alles, was langfristig erinnert werden muss.
Vokabular, Formeln, Eigennamen, Fehlerkorrektur-Rezepte.
AdaptiveLearner-Sessions sind großartig fürs Verstehen; Anki
ist großartig fürs Nicht-Vergessen.

Das AdaptiveLearner-Profil gewichtet "deductive" und
"error_based" am stärksten in Richtung Anki, da beide
Methoden Material produzieren, das Karten-würdig ist.

### 2. Active Recall aus eigenen Quellen

Die zweite Säule ist Wissensaufbau aus Dokumenten, die du
bereitstellst. Moderne Tools lassen dich PDFs, Notizen,
Transkripte hochladen und dich dann selbst abfragen oder
Fragen stellen, die in diesem spezifischen Korpus verankert
sind.

**Empfohlenes Werkzeug**:
[NotebookLM](https://notebooklm.google.com/). Googles
Werkzeug, das deine Quellen in einen interaktiven
Wissensgraphen verwandelt. Besser als ChatGPT für diesen
Zweck, weil die KI-Antworten in den bereitgestellten
Dokumenten verankert sind.

**Auch nützlich**:
[Excalidraw](https://excalidraw.com/) zum Skizzieren der
Struktur deines Wissens,
[Obsidian](https://obsidian.md/) für verlinkte-Notizen-
Wissensgraphen, die über Monate wachsen.

**Wofür**: domain-spezifisches Lernen, wo du bereits
Material hast (Forschungspapiere, interne Docs, Kurs-Slides)
und Wissensstruktur daraus extrahieren willst.

### 3. Adaptive KI-Prompts

Die dritte Säule ist direkter KI-Zugang für einmalige
Fragen, die nicht in die anderen zwei Säulen passen. Manchmal
brauchst du einfach eine Erklärung. Manchmal willst du
brainstormen.

**Empfohlene Werkzeuge**:
[Claude](https://claude.ai/),
[ChatGPT](https://chat.openai.com/) oder
[Gemini](https://gemini.google.com/). AdaptiveLearner nutzt
intern dieselben APIs; du kannst auch direkt mit ihnen über
deren Web-UIs für weniger strukturierte Exploration sprechen.

**Wofür**: offene Fragen, Brainstorming, "erkläre diesen
Absatz", "gib mir drei verschiedene Rahmungen dieses
Problems". Der unstrukturierte Chat glänzt bei divergentem
Denken; AdaptiveLearner-Sessions glänzen bei fokussiertem
konvergentem Üben.

## Wie AdaptiveLearner Werkzeuge rankt

Die Tool-Empfehlungs-Karte im Dashboard nutzt eine einfache
Bewertung:

```
score(tool) = sum(profile_weight[k] for k in tool.weight_keys)
```

Jedes Werkzeug deklariert, welche 1-2 Methoden-Achsen es am
besten bedient:

| Werkzeug | Weight-Keys | Warum |
|---|---|---|
| Anki | deductive, error_based | Karten kodieren Regeln + Korrekturen |
| NotebookLM | inductive, contextual | Beispiele + situiertes Material |
| Adaptive AI Prompt | ai_adaptive, dialogic | Adaptive Konversation |
| Excalidraw | contextual, inductive | Visuelle Struktur aus Beispielen |
| Obsidian | deductive, inductive | Theorie + Beispiele in einem Graph |

Profil-Gewichte aus deinem Test werden über die Weight-Keys
jedes Werkzeugs summiert, und die gerankte Liste landet im
Dashboard. Das Ranking aktualisiert sich, wenn sich dein
Profil ändert (Test-Neuauswertung).

## Spaced-Empfehlungen

Eine zweite Tracking-Oberfläche im Dashboard: die
**Spaced**-Karte. Das sind KEINE Werkzeug-Empfehlungen; es
sind Aktions-Empfehlungen. Das System trackt, wie lange du
seit der letzten Session pro Methode keine mehr hattest, und
schlägt dann vor:

| Zeit seit letztem Commit | Karten-Typ | Intervall |
|---|---|---|
| Nie | erstmals | 1 Tag |
| > 14 Tage | Auffrischen | 1 Tag |
| 7-14 Tage | Wiederholen | 3 Tage |
| 3-7 Tage | Üben | 7 Tage |
| < 3 Tage | Pflegen | 14 Tage |

Eine Methode, die du seit zwei Wochen nicht angefasst hast,
bekommt eine "Auffrischen in 1 Tag"-Karte. Eine Methode, die
du gestern genutzt hast, bekommt "Pflegen in 14 Tagen" (oder
taucht gar nicht auf, weil die Liste auf 5 gedeckelt ist).

Die Karten sind nach Dringlichkeit sortiert (niedrigeres
Intervall × stärkeres Gewicht = höhere Priorität). Du musst
ihnen nicht folgen — sie sind Stupser, keine Befehle.

## First-Class ausgelieferte Integrationen

Drei Werkzeuge sind als eingebauter Export ausgeliefert statt
als externe Empfehlung:

- **Anki .apkg-Export** — auf der
  `/anki`-Seite KI-extrahierte Karteikarten prüfen, die
  gewünschten annehmen, Export klicken. Die `.apkg`-Datei
  wird client-seitig via sql.js + JSZip gebaut und
  funktioniert direkt in Anki-Desktop. Kein manueller
  Übergang.
- **NotebookLM-ZIP-Paket** — auf der
  Fortschritts-Seite das Studien-Paket herunterladen. Das
  ZIP enthält `summary.md`, `vocabulary.md`, `rules.md`,
  `errors.md`, `flashcards.md` und `sessions/*.md`,
  formatiert für den NotebookLM-Source-Upload.
- **Sprache (TTS + STT + Aussprache-Übung)** —
  Web-Speech-API-Integrationen direkt in
  Session + Assessment + eine eigene
  `/pronunciation`-Seite für Sprachprojekte. Kein externes
  Werkzeug nötig.

## Was NICHT im Katalog ist

Bewusst ausgelassen:

- **Duolingo / Babbel / ähnliche gamifizierte Apps** — sie
  widersprechen der Philosophie. Adaptive Learner liefert
  zwar XP + Abzeichen + Streaks, aber als
  Motivationsschicht über un-gamifiziertem Inhalt, nicht
  als primäre Schleife.
- **Khan Academy / Coursera** — sie sind kurs-
  abschluss-orientiert, nicht fertigkeits-erwerb-
  orientiert. Anderer Problemraum.
- **Memrise** — zu nah an Anki; der Katalog behält ein
  Werkzeug pro Nische.
- **Notion** — Overkill für die „verlinkte Notizen"-Nische;
  Obsidian passt sauber ohne Cloud-Lock-in.

Der Katalog ist absichtlich klein. Mehr hinzuzufügen würde
das Signal verdünnen.
