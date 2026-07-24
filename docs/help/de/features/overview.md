# Feature-Übersicht

Diese Seite ist die kanonische Antwort auf die Frage "was kann Adaptive
Learner eigentlich alles?". Sie listet alle größeren nutzersichtbaren
Fähigkeiten der App, thematisch gruppiert, und wird mit jedem Release
aktuell gehalten. Andere Stellen (README, die einzelnen Hilfeseiten)
verweisen hierher, statt eigene Kopien dieser Liste zu pflegen.

## Lern-Kern

- **Sechs Lernmethoden** (deduktiv, induktiv, fehlerbasiert, dialogisch,
  kontextuell, KI-adaptiv) mit eigenen KI-Prompts pro Methode und
  Schritt.
- **Sieben-Schritt-Zyklus** pro Sitzung: Input, Fokus, Versuch,
  Feedback, Verfeinerung, Transfer, Integration. Ein
  Dual-Prompt-Evaluator bewertet jeden Turn und entscheidet über
  Voranschreiten, Wiederholen, Überspringen oder Zurückgehen.
- **Auto-Loop**: Ist ein Thema integriert, wählt die Sitzung ein neues
  Unterthema und startet einen frischen Zyklus (pro Sitzung begrenzt).
- **Methodenwechsel**: Stagnationserkennung empfiehlt eine andere
  Methode, wenn die Bewertungen abflachen; Annahme per Klick.
- **Einstufungs-Assessment** (optional, unterbrechbar und fortsetzbar)
  berechnet ein Sechs-Methoden-Lernprofil; ein Zwei-Felder-Schnellstart
  funktioniert auch ohne.

Siehe [Lernsitzungen](../user-guide/learning-session.md) und
[Die Lernmethode](../concept/philosophy.md).

## KI-Tutor-Chat

- **Sitzungs-Chat auf assistant-ui-Basis**: gestreamte
  Token-für-Token-Antworten, Markdown-Rendering, Theming und
  vollständige Lokalisierung.
- **Voice**: Mikrofon-Diktat in den Chat, Vorlesen der Antworten und
  ein eigener Aussprache-Übungsmodus.
- **Bring your own key**: Anthropic Claude, OpenAI GPT und Google
  Gemini als separate Provider-Plugins; Live-Modell-Discovery mit
  Empfohlen/Alle-Auswahl; Schlüsseltest pro Anbieter und ein
  Schlüssel-Tresor mit Rollback.
- **Importierte Unterhaltungen als Tutor-Sitzung fortsetzen**, mit
  ursprünglichem Thema und Analyse-Kontext.
- **"KI fragen"** zu Theorieblöcken und Übungen; KI-Antworten immer in
  der UI-Sprache des Lernenden.

## Übungstypen

Sechs Kern-Typen, die jedes Set nutzen kann, plus fünf Extension-Typen,
die ein Set mitbringen kann:

| Kern-Typ | Was der Lernende tut |
|---|---|
| Matching | Begriffe über zwei Spalten paaren (Start von beiden Seiten) |
| Bildauswahl | Das passende Bild wählen |
| Freitext | Antwort tippen (Tippfehler-Toleranz, mehrere akzeptierte Antworten, optionale KI-Zweitmeinung) |
| Lückentext (Cloze) | Lücken tippen, auswählen oder mehrfach auswählen |
| Wort-Kacheln | Antwort aus gemischten Kacheln zusammensetzen (Touch-Drag) |
| Multiple Choice | Einfach- oder Mehrfachantwort |

| Extension-Typ | Was der Lernende tut |
|---|---|
| Kategorisierung | Elemente in Gruppen sortieren |
| Fehlerkorrektur | Den Fehler im Satz finden und korrigieren |
| Leseverständnis | Text lesen, Fragen beantworten |
| Benoteter Quiz | Ein bewertetes Mini-Quiz |
| Audio-Diktat | Hören und tippen, was gesagt wurde |

- Übungen sind **richtungsbewusst** (erkennen vs. produzieren), zeigen
  einen **Schwierigkeits-Indikator pro Übung**, unterstützen **Code-
  und Formel-Inhalte** mit Syntax-Highlighting und bieten
  **Listen-First-Audio**-Varianten.
- Falsche Antworten bekommen **Token-Diff-Feedback**; Hinweise sind
  gestaffelt und kosten XP.

Siehe [Lektionen](../user-guide/lessons.md) für die Lernenden-Sicht.

## Lektionen und Lernmechanik

- **Sieben Arten, eine Lektion oder ein Set zu spielen**: Üben, Prüfung
  (verzögertes Feedback, Bestanden/Nicht-bestanden-Urteil, XP-Bonus),
  Auf Zeit, Reverse, Zufall (verschachtelt), Endlos und ein
  freigeschalteter "Fehler trainieren"-Modus, der nur das Falsche
  wiederholt.
- **Spaced Repetition (SRS)** auf fehlergranularer Historie:
  Wiederholungs-Warteschlange, richtungsbewusste Meisterschaft,
  Prüfungsmodus-Intervall-Boost und konfigurierbare Länge der
  Wiederholungssitzung.
- **Adaptive Lektionen** auf Abruf aus den eigenen Fehlermustern
  (regelbasiert, offline, ohne API-Schlüssel).
- **Fehler-Replay und eine Korrekturrunde** am Lektionsende üben genau
  die Wörter, die daneben gingen.
- **Lektions-Flusskontrolle**: pausieren, am exakten Schritt
  fortsetzen, Autosave und ein Widget für pausierte Lektionen auf dem
  Dashboard.
- 0-3-Sterne-Bewertung, Favoriten, Nächste-Schritte-Vorschläge,
  Auto-Teilung übergroßer Lektionen und Theorie-Rücksprünge aus
  Übungen.

## Lektionserstellung (Create-Lesson)

- **Ein Wizard ohne API-Schlüssel** baut eine vollständige, teilbare
  Lektion: Karten-Editor mit Drag-and-Drop und CSV-Import, Bild-Upload
  pro Karte, Vorlagen, Entwurfs-Autosave und Vorschau im echten
  Lektions-Player.
- **Jede Übung ist bearbeitbar**: alle Kern-Typen lassen sich nach der
  Generierung editieren, von Hand ergänzen und ausbalancieren; ein
  **Extension-Authoring-Assistent** deckt alle fünf Extension-Typen ab,
  inklusive Audio-Datei-Upload für das Diktat.
- **Buchtext-Ingestion**: Lehrbuchtext einfügen oder eine Buchdatei
  hochladen (EPUB, DOCX, TXT, Markdown) mit Kapitel-Auswahl,
  Mehrfachauswahl erkannter Abschnitte, automatischer
  Ausschluss-Heuristik für Vor- und Nachspann und
  Batch-Lektionsgenerierung pro Abschnitt.
- **KI-Übungsgenerierung** (eigener Schlüssel) mit deterministischem
  Quality-Gate, Regenerieren-mit-Feedback und Batch-Generierung für ein
  ganzes Set.
- **Eigene Lektionen verwalten**: jede Lektion eines Multi-Lektions-
  Sets über eine Lektionsauswahl bearbeiten, eigene Lektionen zu einem
  Set kombinieren und eine Inhalts-Domäne wählen (Sprachen plus
  Wissensdomänen).

Siehe [Lektionen erstellen](../content-creation/overview.md).

## Import und Analyse

- **Chat-Verlauf-Import** aus ChatGPT, Claude, Gemini sowie beliebigem
  Markdown oder eingefügtem Text.
- **KI-Analyse** extrahiert Thema, Schwächen, Fehlermuster, die
  empfohlene Methode, Vokabular und einen Lehrplan-Vorschlag.
- Ein Klick erzeugt ein **Curriculum**, startet eine **gezielte
  Sitzung** oder wandelt die Analyse in eine **wiederspielbare
  Offline-Lektion** um.

## Content-Verwaltung

- **Content-Hub** mit den Tabs Entdecken / Meine Inhalte / Import,
  Listen- oder Kachelansicht und einer Such-/Filterleiste (Sprache,
  Niveau, Domäne, Trust, KI-geprüft).
- **Herunterladbare Lektions-Sets** aus öffentlichen
  GitHub-Content-Repositories, offline gecacht; Sets lassen sich über
  ein Manifest-Sichtbarkeits-Flag ausblenden.
- **Föderierte Repositories**: mehrere eigene oder fremde Content-Repos
  verbinden (private Repos per Token), ein Bereich mit empfohlenen
  Repos und Trust-Badges pro Quelle.
- **Community-Sharing**: ein vierstufiger Share-Assistent öffnet einen
  echten Pull Request gegen ein Content-Repo, mit intelligenter
  Platzierung und Duplikat-Erkennung; Einladungscodes ermöglichen
  privates Teilen für Coaches.
- **Deep-Links und QR-Codes pro Set**, eine Lernpfad-Ansicht mit
  Meisterschaft pro Set, Buchempfehlungen pro Domäne und ein
  Buch-Begleiter-Bereich pro Set.

Siehe [Content-Browser](content-browser.md),
[Inhalte entdecken](discover.md) und
[Content-Repositories](content-repos.md).

## Gamification

- **XP und Level** mit sichtbarem XP-Badge und Belohnung pro Lektion.
- **Gestufter Badge-Katalog** (Bronze/Silber/Gold; gesperrte Badges
  bleiben sichtbar mit Freischalt-Hinweis).
- **Streaks** mit Heatmap und **tägliche Missionen** (bis zu drei
  adaptive Ziele pro Tag).
- **Celebrations**: verdientes, in der Intensität einstellbares Lob,
  Meilenstein-Overlays, optionale Sounds, alles
  reduced-motion-sicher.

## Exporte und Backup

- **Anki**: KI-extrahierte Karteikarten, in der App geprüft, als
  `.apkg` oder `.txt` exportiert.
- **NotebookLM**: ein ZIP mit Zusammenfassung, Vokabular, Regeln,
  Fehlern, Karteikarten und Sitzungen, plus Active-Recall-Fragen und
  Study-Guide.
- **Learning Repository**: Markdown-Artefakte pro Projekt (README,
  Statistiken, Spickzettel, Roadmap), als ZIP herunterladbar oder im
  Server-Modus per Git committet.
- **Fortschrittsberichte** als Markdown oder PDF; Lektionsergebnisse
  für KI-gestütztes Weiterüben exportierbar; natives Teilen-Sheet für
  Ergebnisse.
- **Backups**: `.alb`-ZIP-Backup über die gesamte Datenfläche,
  Speichern-auf-Datenträger, Wiederherstellung beim ersten Start,
  Online-zu-Lokal-Migration und ein separater, Passphrase-
  verschlüsselter `.alk`-Export für KI-Schlüssel.

Siehe [Backup und Wiederherstellung](backup.md).

## Plattform

- **Progressive Web App**: installierbar, offline-fähig,
  Service-Worker-Updates mit Update-Banner, läuft vollständig im
  Browser.
- **Zwei Speichermodi**: Local-First (alles im Browser-IndexedDB,
  KI-Calls gehen direkt zum Anbieter, kein Server nötig) oder
  Server-Modus (FastAPI-Backend mit SQLite, mehrere Geräte).
- **Lokales-Netzwerk-Sync** zwischen Geräten mit QR-Code-Pairing und
  Konfliktauflösung.
- **Desktop-Launcher** für Linux, macOS und Windows: Docker-basiertes
  Ein-Klick-Self-Hosting mit kontextbewusster Docker-Erkennung und
  Selbstdiagnose.
- **Elf UI-Sprachen**, vollständig übersetzt, mit durchsuchbarer
  Sprachauswahl.
- **Offenes Inhaltsformat**: Lektionen sind reines JSON, validiert
  gegen ein veröffentlichtes Schema; die App konsumiert die
  Content-Engine als Paket.

Siehe [Installation](../install/launcher.md).

## Barrierefreiheit und UX

- **WCAG-AA-geprüfte Themes** (hell, dunkel, farbige Presets,
  Betriebssystem-Automatik), abgesichert durch automatisierte
  Kontrast-Checks.
- **Tastatur zuerst**: globale Shortcuts mit Hilfe-Overlay, Enter
  schaltet in Lektionen weiter, Tab springt durch Lückentext-Lücken.
- **Screenreader-Unterstützung**: Landmarks, ARIA-Labels und
  Live-Regionen, Daten-Tabellen zu Diagrammen,
  Dialog-Fokus-Management.
- **Reduzierte Bewegung** wird überall respektiert; Vorlesen (TTS) für
  Lektionen und Chat.
- **Kontextsensitive In-App-Hilfe**: das Hilfe-Panel öffnet den Artikel
  zur aktuellen Ansicht; jeder Artikel verlinkt auf diese
  Dokumentations-Site.
