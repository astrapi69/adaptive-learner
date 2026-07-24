# Das Dashboard

Das Dashboard ist deine Startbasis. Es bündelt mehrere
Datenscheiben in eine Ansicht: wer du als Lernender bist
(Profil + XP + Abzeichen), wie es gerade läuft
(Streak-Heatmap + Session-Zähler), was du zuletzt gemacht
hast (jüngste Sessions + Methodenverteilung), und was als
Nächstes ansteht (Werkzeug- + Spaced-Empfehlungen).

Ganz oben sitzt die **Subjects + Tags Filter-Leiste** -
wähle ein Subject (z. B. Sprachen → Spanisch) oder ein Tag,
um jedes Widget unten auf Projekte mit dieser Klassifizierung
zu beschränken. Filter sind über URL-Query-Params teilbar.

## Profil-Radar

Der Radar-Chart oben zeigt dein 6-Methoden-Profil aus dem Test.
Gleiche Form wie der Chart auf der Lerntyp-Test-Seite. Die
dominante Methode wird unter dem Chart in einem farbigen Badge
hervorgehoben.

Wenn du den Test noch nicht gemacht hast, zeigt der Radar eine
Null-Form und verlinkt zum Test.

## XP + Streak + Abzeichen

- **XP-Widget** - aktuelles Level + XP gesamt + ein
  Fortschrittsbalken zum nächsten Level. Levels folgen
  einer Exponentialkurve
  (`threshold(n) = 50 * n * (n - 1)`); Level 1-5 liegen
  bei 0 / 100 / 300 / 600 / 1000 XP. 50 XP Basis pro
  beendeter Session, plus Pro-Zyklus-Boni + First-Method-
  Bonus + Streak-Multiplikator (bis 2,75× bei 7-Tage-Streak).
- **Streak-Heatmap** (GitHub-Stil) - 365 Tage Aktivität in
  Wochenspalten Mo..So. Fünf Tier-Farben via `color-mix`
  auf `var(--accent)`. Wochenend-Modus in den Einstellungen
  überspringt Sa/So-Lücken; Freeze-Vorrat (1 pro 7
  Streak-Tage, max. 3) wirkt als Pause-statt-Reset bei
  einem verpassten Werktag.
- **Badge-Vitrine** - 24 Abzeichen in 5 Kategorien
  (Einstieg 3, Konsistenz 4, Methoden-Entdecker 7, Tiefe 7,
  Polyglott 3). Verdiente sind farbig + datiert; gesperrte
  bleiben grau.
- **Session-Zähler** - Kacheln für Sessions, Minuten,
  aktueller Streak, Durchschnitts-Verständnis, Durchschnitts-
  Stress.

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
Seite, gefiltert auf die Session - nützlich, wenn eine
bestimmte Session sich super oder schrecklich angefühlt hat
und du nachsehen willst, was passierte.

## Werkzeug- + Spaced-Empfehlungen

Zwei Empfehlungskarten am unteren Rand:

- **Werkzeuge** - externe Tools nach Relevanz zu deinem
  Profil sortiert. Anki + NotebookLM sind jetzt First-Class
  mit ausgelieferten Exporten (kein manueller Übergang).
  Jedes mit einem einzeiligen „Warum", in deiner UI-Sprache.
- **Spaced Repetition** - kurze "mach das als Nächstes"-Karten,
  getrieben davon, welche Methoden du zuletzt nicht geübt
  hast. Eine 5-Band-Logik (erstmals / Auffrischung /
  Wiederholung / Übung / Pflege) treibt die Intervall-
  Vorschläge.

Beide Listen aktualisieren sich bei jedem Dashboard-Aufruf -
sie sind günstig zu berechnen und spiegeln die letzte Session.

## Session starten

Der große Primärbutton oben: "Session starten". Öffnet die
Session-Seite mit einer neuen Session-Zeile, der aktiven
Methode aus deinem Profil und dem Zyklus auf Schritt 1.
