# Eine Lern-Session

Eine Session ist ein fokussiertes Gespräch mit der KI durch
den 7-Schritt-Zyklus. Sessions sind kurz — 15-45 Minuten sind
typisch. Der "Session starten"-Button im Dashboard legt eine
neue an; die App wählt die Lernmethode (deine dominante aus
dem Test) und den Startschritt (meist 1 = Input).

Eine *Session* ist nicht dasselbe wie eine *Lesson*: Eine
Session ist dieses KI-Gespräch durch den 7-Schritt-Zyklus,
während eine Lesson eine Reihe von 8-12 Übungen aus einem
heruntergeladenen Content-Set ist, gespielt in ihrem eigenen
Viewer ohne KI-Chat. Siehe
[Inhaltslektionen und Wiederholungen](lessons.md).

## Die sieben Schritte

| # | Schritt | Was passiert |
|---|---|---|
| 1 | Input | Die KI stellt neuen Stoff im Stil der aktiven Methode vor |
| 2 | Versuch | Du wendest das Gelernte an — die KI stellt eine Aufgabe |
| 3 | Fehler | Ein Fehler taucht auf; die KI markiert ihn präzise |
| 4 | Feedback | Die KI erklärt die Korrektur ausführlich |
| 5 | Anpassen | Du justierst dein Vorgehen; die KI rahmt evtl. um |
| 6 | Wiederholen | Eine neue Aufgabe zu demselben Konzept |
| 7 | Integrieren | Die KI verknüpft den Stoff mit weiterem Kontext |

Der Zyklus ist ein *Rahmen*, kein Förderband. Schritte können
sich wiederholen, vorwärts springen oder sogar zurückgehen,
wenn dein letzter Zug Verwirrung zeigt. Die KI bewertet pro
Roundtrip und der Fortschrittsbalken aktualisiert sich
entsprechend.

[Der Zyklus im Detail](../concept/seven-steps.md)

## Wie die KI dich begleitet

Jede Nachricht löst bis zu drei KI-Aufrufe aus:

1. **Die Lernantwort** — streamt Token für Token via SSE.
   Du siehst den Inline-Cursor (▍) während die KI denkt;
   die Tokens landen im Bubble, sobald sie ankommen (kein
   „Denke nach…"-Platzhalter). Der System-Prompt setzt
   sich aus einer 42-Zellen-Matrix zusammen (6 Methoden × 7
   Schritte), sodass ein deduktives Input sich deutlich
   anders anfühlt als ein kontextuelles Wiederholen.
2. **Der Schritt-Bewerter** — ein zweiter KI-Aufruf liest
   den Austausch und entscheidet, ob du für den nächsten
   Schritt bereit bist. Er liefert `advance`, `confidence`,
   `reason`, `suggested_step`. Die App wendet den Vorschlag
   bei Konfidenz ≥ 0.6 an.
3. **Der Topic-Transition-Bewerter** (nur bei Schritt 7) —
   ein dritter KI-Aufruf entscheidet, ob das Thema
   integriert ist. Wenn ja UND `continue_recommended`,
   startet automatisch ein neuer Zyklus mit einem frischen
   Unterthema (Auto-Loop, max. 5 Zyklen pro Session).

Das Urteil erscheint dezent über dem Chat als „Schritt von
X nach Y verschoben, weil…", wenn es greift. Zyklus-Übergänge
rendern als Karten mit gestricheltem Rand und „Zyklus N"-
Beschriftung im Chat-Verlauf.

**Stimme an/aus** — ein TTS-Knopf (▶) neben jeder
KI-Antwort liest sie laut vor; ein Mikrofon-Knopf (🎤) am
Eingabefeld lässt dich diktieren; Zwischen-Transkripte
füllen das Textarea, sodass du vor dem Absenden noch
lesen kannst. Beides Web Speech API; in den Einstellungen
unter Stimme an/abschaltbar.

## Zyklus-Fortschrittsanzeige

Am oberen Rand der Session-Seite sitzt ein Streifen aus 7
Kreisen. Der aktuelle Schritt ist in der Akzentfarbe gefüllt;
absolvierte Schritte sind blasser; kommende Schritte sind
leer. Wenn der Bewerter dich vorwärts (oder rückwärts!) setzt,
animiert der Streifen den Übergang.

Auf Mobile (≤768px) wird der Streifen zu einer einzigen
horizontalen Reihe kleiner Kreise, um Vertikalplatz zu sparen.

## Methodenwechsel-Empfehlungen

Manchmal greift die aktive Methode einfach nicht. Nach drei
Sessions, in denen dein "Verständnis"-Rating nicht wächst und
dein "Stress"-Rating hoch bleibt, blendet die App ein
**MethodSwitchBanner** ein: "Willst du für die nächste Session
[andere Methode] probieren?". Annehmen — und die nächste
Session startet mit der neuen Methode.

Die Empfehlung liest dein Profil und bevorzugt deine
zweitstärkste Methode, die du zuletzt nicht genutzt hast.
Bannerhinweis lässt sich schließen; er kommt wieder, wenn das
Stagnationsmuster weiterläuft.

Beide Speichermodi (Server + Lokal) unterstützen
Methodenwechsel-Empfehlungen.

## Bewerten + Session beenden

Die Session-Seite hat einen „Session beenden"-Button. Vor
dem Schließen füllst du eine kurze Bewertung aus:
Verständnis, Stress, Methoden-Passung auf einer 1-5-Skala
plus eine optionale **Rich-Text-Notiz** (TipTap: fett,
kursiv, Listen, Code-Blöcke mit Syntax-Highlighting, Links).
Die Notiz gehört dir — die KI liest sie nicht.

Aus den Bewertungen plus der Multi-Cycle-Zusammenfassung
wird ein `ProgressCommit` — der Git-artige Schnappschuss
einer Session. Eine abgeschlossene Session bringt XP
(50 Basis × Streak-Multiplikator, plus Pro-Zyklus-Boni),
prüft auf neu verdiente Abzeichen und aktualisiert deinen
Streak. Siehe [Fortschritt](progress.md),
[Dashboard](dashboard.md) und das
[Tracking-Konzept](../concept/tracking.md).
