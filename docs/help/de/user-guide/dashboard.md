# Das Dashboard

Das Dashboard ist deine Startbasis. Es bündelt vier Datenscheiben:
wer du als Lernender bist (dein Profil), wie es gerade läuft
(Trend + Streak), was du zuletzt gemacht hast (jüngste Sessions
+ Methodenverteilung), und was als Nächstes ansteht
(Werkzeug- + Spaced-Empfehlungen).

## Profil-Radar

Der Radar-Chart oben zeigt dein 6-Methoden-Profil aus dem Test.
Gleiche Form wie der Chart auf der Lerntyp-Test-Seite. Die
dominante Methode wird unter dem Chart in einem farbigen Badge
hervorgehoben.

Wenn du den Test noch nicht gemacht hast, zeigt der Radar eine
Null-Form und verlinkt zum Test.

## Streak-Zähler + Session-Zähler

Zwei kompakte Kacheln neben dem Radar:

- **Streak-Tage** — aufeinanderfolgende Kalendertage mit
  mindestens einer beendeten Session. Setzt auf 0 zurück,
  wenn heute noch keine Session lief.
- **Sessions gesamt** — wie viele Sessions du jemals
  abgeschlossen hast. Zählt nur Sessions, die mit Bewertung
  beendet wurden (und so einen ProgressCommit erzeugt haben).

Der Streak folgt der Duolingo/Habitica-Logik: Heute verpasst
heißt Streak auf 0, sobald der Kalender umspringt.

## Fortschritts-Timeline

Ein Zwei-Linien-Chart unter dem Radar. Zwei Werte pro Session:
dein **Verständnis**-Rating und dein **Stress**-Rating, jeweils
von 1-5-Eingabe auf eine 0-1-Achse skaliert. Standardmäßig die
fünf jüngsten Sessions, von alt links nach neu rechts.

Worauf achten: eine steigende Verständnislinie ist genau das,
was du willst. Eine flache Verständnislinie bei steigendem
Stress ist das Signal, das die Methodenwechsel-Heuristik
verfolgt; sie wird dir einen Wechsel vorschlagen.

## Methodenverteilung

Ein horizontales Balkendiagramm, das zeigt, welche der 6
Methoden du genutzt hast. Die Länge jedes Balkens ist der
Prozentanteil der Sessions, die diese Methode nutzten. Balken
sortiert absteigend nach Anzahl; Gleichstände behalten die
kanonische Methodenreihenfolge.

Der Sinn ist nicht Wettbewerb mit sich selbst, sondern ein
Spiegel. Manche Lernenden fahren 80% deduktive Sessions, und
das ist okay. Andere entdecken, dass sie die kontextuelle
Methode nie genutzt haben, und wollen es ausprobieren.

## Letzte Sessions

Die letzten 5 Sessions als kompakte Liste: Methoden-Badge,
Verständnis-Rating der Session (als kleiner Balken) und Dauer
in Minuten. Klick auf eine Zeile springt zur Fortschritts-
Seite, gefiltert auf die Session — nützlich, wenn eine
bestimmte Session sich super oder schrecklich angefühlt hat
und du nachsehen willst, was passierte.

## Werkzeug- + Spaced-Empfehlungen

Zwei Empfehlungskarten am unteren Rand:

- **Werkzeuge** — 5 externe Tools (Anki, NotebookLM, Adaptive
  AI Prompt, Excalidraw, Obsidian), nach Relevanz zu deinem
  Profil sortiert. Jedes mit einem einzeiligen "Warum",
  angepasst an deine Sprache.
- **Spaced Repetition** — kurze "mach das als Nächstes"-Karten,
  getrieben davon, welche Methoden du zuletzt nicht geübt
  hast. Eine 5-Band-Logik (erstmals / Auffrischung /
  Wiederholung / Übung / Pflege) treibt die Intervall-
  Vorschläge.

Beide Listen aktualisieren sich bei jedem Dashboard-Aufruf —
sie sind günstig zu berechnen und spiegeln die letzte Session.

## Session starten

Der große Primärbutton oben: "Session starten". Öffnet die
Session-Seite mit einer neuen Session-Zeile, der aktiven
Methode aus deinem Profil und dem Zyklus auf Schritt 1.
