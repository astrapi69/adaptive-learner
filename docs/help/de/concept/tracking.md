# Tracking: Git fürs Lernen

Die meisten Lern-Apps tracken "Prozent abgeschlossen" oder
"Streak-Tage". Diese Zahlen sind leicht zu berechnen, sagen
aber fast nichts darüber, wie du tatsächlich lernst.
AdaptiveLearner leiht stattdessen Gits mentales Modell.

## Die Git-Analogie

| Git | Lernen |
|---|---|
| Commit | Schnappschuss einer Session (Methode, Bewertungen, Dauer) |
| Diff | Delta zur vorherigen Session im selben Thema |
| Branch | Ein Methodenwechsel (deduktiv → dialogisch) |
| Log | Volle chronologische Historie der Commits |
| Blame | Welche Session ein bestimmtes Muster eingeführt hat |
| Bisect | Die Session finden, in der Verständnis aufhörte zu wachsen |

Wir nutzen Git nicht wörtlich. Wir nutzen seine Disziplin
von versioniertem, wiederherstellbarem, vergleichbarem
Zustand. Sessions sind dauerhaft; sie verschwinden nicht beim
Schließen des Tabs. Du kannst zurückschauen, vergleichen und
Muster finden.

## Was committet wird

Jede Session, die mit einer Bewertung endet, erzeugt eine
`ProgressCommit`-Zeile:

| Spalte | Was sie erfasst |
|---|---|
| method | Welche der sechs Methoden diese Session nutzte |
| understanding | Deine 1-5-Bewertung, skaliert auf 0.0-1.0 |
| stress | Gleiche Skalierung |
| error_rate | 0.0-1.0 (aktuell immer 0.0; reserviert für eine zukünftige Pro-Schritt-Fehlerquote) |
| duration_minutes | Verstrichene Zeit zwischen started_at und ended_at |
| committed_at | Wann der Commit geschrieben wurde |
| project_id | Welches Lernprojekt |
| session_id | Welche Session |

Das war's. Sieben Felder, keine NULLs (Rating-Werte sind
Pflicht zum Beenden). Eine Handvoll Bytes pro Session.

## Was du damit machen kannst

### Trendlinien

Die Progress-Timeline im Dashboard plottet deine letzten 5
Verständnis- + Stress-Bewertungen. Fünf Punkte reichen, um
Richtung zu erkennen:

- Beide steigen: Fortschritt + Selbstvertrauen beide hoch.
  Weitermachen.
- Verständnis steigt, Stress steigt: du streckst dich. Gut,
  aber nur eine Weile nachhaltig.
- Verständnis flach, Stress steigt: Stagnation. Die
  Methodenwechsel-Heuristik schlägt hier an.
- Verständnis fällt: etwas hat sich geändert. Thema
  schwieriger? Methode passt nicht mehr? Zeit, in die
  Historie zu schauen.

### Methodenverteilung

Welche Methoden hast du tatsächlich genutzt? Viele Lerner
entdecken, dass sie auf eine Methode zurückgreifen (oft
deduktiv) und die anderen nie probieren. Das Balkendiagramm
im Dashboard ist ein Spiegel — kein Wettbewerb.

### Streak

Aufeinanderfolgende Kalendertage mit mindestens einer
Session. Setzt zurück, sobald ein Tag ohne Session
vergeht. Das ist die einzige "Gamification"-Kennzahl in
AdaptiveLearner und sie ist bewusst zurückhaltend. Die
andere Seite des Charts ist wichtiger.

### Schritt-Bewertungs-Aggregate

Der Dual-Prompt-Bewerter schreibt eine `StepEvaluation`-
Zeile pro KI-Roundtrip. Der Tracking-Aggregator macht
daraus:

- **Mittlere Konfidenz** — wie sicher die KI im Schnitt
  ist, dass du für den nächsten Schritt bereit bist.
  Niedrig (< 0.5) heißt, der Stoff ist genuin schwer für
  dich. Das ist Information, kein Urteil.
- **Wiederholungs-Zahl** — wie oft der Bewerter "bleib
  hier" sagte. Wiederholungs-lastige Phasen sind normal
  für dichte Themen.
- **Zeit pro Schritt** — gesamte Wandzeit-Sekunden, die
  du pro Schritt im Projekt verbracht hast (gedeckelt
  für Lücken > 2h). Der Schritt mit der meisten Zeit ist,
  wo bei dir gerade die kognitive Arbeit passiert.

Die Fortschritts-Seite rendert all das als Balkendiagramme.

## Was wir bewusst nicht tracken

- **Keine Engagement-Metriken** — keine "Minuten pro
  Tag"-Schuld, keine Notifications, keine täglichen
  Erinnerungen. AdaptiveLearner kämpft nicht um deine
  Aufmerksamkeit.
- **Kein Vergleich mit anderen Usern** — du bist allein in
  deinen Daten (Lokal-Modus) oder allein mit dem Backend
  (Server-Modus). Keine Bestenlisten, kein
  Peer-Vergleich.
- **Keine "abgeschlossenen Lektionen"** — es gibt kein
  fixes Curriculum zum Abschließen. Du setzt dein eigenes
  Thema.
- **Keine "Meisterungs-Prozent"** — was würde 100% bei
  einem Lernthema überhaupt heißen? Meisterschaft ist
  eine Haltung, keine Ziellinie.

## Datenschutz

Im Lokal-Modus liegen die Daten in IndexedDB auf deinem
Gerät. Lies sie über die Browser-DevTools oder exportiere
sie für Backup. Niemand sonst sieht sie, außer mit Zugriff
auf dieses Browser-Profil.

Im Server-Modus liegen die Daten in SQLite auf dem Backend-
Host. Verschlüsselte API-Keys ausgenommen, sind die
Zeilendaten im üblichen Sinn nicht sensibel — nur Methoden-
namen, ganzzahlige Bewertungen, Zeitstempel. Aber sie sind
*deine*. AdaptiveLearner sendet nichts davon an einen
Drittanbieter-Analytics- oder Telemetrie-Dienst.

## Warum das fürs Lernen wichtig ist

Streak-Zähler in den meisten Apps sind süchtigmachend, aber
flach. Aus einem 90-Tage-Duolingo-Streak lernst du nichts
darüber, *was* du gelernt hast. Das Git-Modell gibt dir
Muster:

- "Ich bin am 10. Mai von deduktiv zu dialogisch
  gewechselt, und meine Verständnislinie ist diese Woche
  hochgeschossen."
- "Ich habe 40% meiner Zeit auf Schritt 3 (Fehler)
  verbracht. Das Thema hat mehr Fallen als ich erwartet
  hatte."
- "Ich hatte drei Wochen keine kontextuelle Session; die
  Spaced-Empfehlungskarte hat recht, mich zu schubsen."

Das sind die Fragen, die ein ernsthafter Lerner sich selbst
stellt. AdaptiveLearner gibt dir das Substrat, sie zu
stellen.
