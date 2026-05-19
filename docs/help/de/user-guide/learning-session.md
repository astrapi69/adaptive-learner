# Eine Lern-Session

Eine Session ist ein fokussiertes Gespräch mit der KI durch
den 7-Schritt-Zyklus. Sessions sind kurz — 15-45 Minuten sind
typisch. Der "Session starten"-Button im Dashboard legt eine
neue an; die App wählt die Lernmethode (deine dominante aus
dem Test) und den Startschritt (meist 1 = Input).

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

Jede Nachricht löst zwei KI-Aufrufe nacheinander aus:

1. **Die Lernantwort** — die KI antwortet im Stil der aktiven
   Methode beim aktuellen Schritt. Der System-Prompt setzt
   sich aus einer 42-Zellen-Matrix zusammen (6 Methoden × 7
   Schritte), sodass ein deduktives Input sich deutlich
   anders anfühlt als ein kontextuelles Wiederholen.
2. **Der Schritt-Bewerter** — ein zweiter KI-Aufruf liest den
   Austausch und entscheidet, ob du für den nächsten Schritt
   bereit bist. Er liefert ein Urteil: `advance`, `confidence`,
   `reason`, `suggested_step`. Die App wendet den Vorschlag
   nur an, wenn die Konfidenz hoch genug ist (Standardwert
   0.6).

Das Urteil erscheint dezent über dem Chat als "Schritt von X
nach Y verschoben, weil…", wenn es tatsächlich angewendet
wird.

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

(Im Lokal-Modus wird die Switch-Heuristik gerade portiert —
das Banner gibt dort aktuell "keine Empfehlung" zurück.)

## Bewerten + Session beenden

Die Session-Seite hat einen "Session beenden"-Button. Vor dem
Schließen füllst du eine kurze Bewertung aus: Verständnis,
Stress, Methoden-Passung auf einer 1-5-Skala. Diese
Bewertungen steuern die Dashboard-Trendlinien UND die
Methodenwechsel-Heuristik.

Aus den Bewertungen wird ein `ProgressCommit` — der
Git-artige Schnappschuss einer Session. Siehe
[Fortschritt](progress.md) und das
[Tracking-Konzept](../concept/tracking.md).
