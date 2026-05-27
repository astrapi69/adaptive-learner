# Inhaltslektionen und Wiederholungen

Eine **Inhaltslektion** ist eine kleine, handgefertigte
Lerneinheit (meist 5–10 Minuten), die aus einem öffentlichen
Lektionssatz heruntergeladen wird. Sie läuft in einem
eigenen Viewer, nicht in der KI-Chat-Session. Nach der
Lektion merkt sich die App genau, welche Wörter, Paare oder
Phrasen du falsch beantwortet hast, und plant sie für eine
gezielte Wiederholungssitzung später ein.

Lektionen sind ein **alternativer Lernweg**, der keinen
KI-API-Schlüssel benötigt — ideal zum Ausprobieren der App
oder für Inhalte, bei denen kuratiertes Material besser
funktioniert als freier Chat.

---

## Woher Lektionen kommen

Lektionen leben in **Inhaltssätzen** — kleinen Bündeln, die
in öffentlichen GitHub-Repos veröffentlicht sind. Der
**Set-Browser** unter `/content` listet jeden verfügbaren
Satz auf; klicke einen an, um ihn herunterzuladen. Der Satz
wird lokal zwischengespeichert (im Dateisystem bei Backend-
Betrieb, in IndexedDB im reinen Browser-Modus), sodass du
nach dem ersten Download offline lernen kannst.

Der Pilot-Satz aus v1.27.0 ist **Französisch A1** (2
Lektionen, 14 Karten, 9 Übungen, die alle vier Übungstypen
abdecken). Jedes Release seither bringt neue hinzu — siehe
das
[Set-Repo](https://github.com/astrapi69/adaptive-learner-content)
für den aktuellen Katalog.

---

## Der Lektionsablauf

Öffne einen Satz, wähle eine Lektion, und der
**Lektions-Viewer** führt dich Schritt für Schritt durch
jede Karte und Übung:

1. **Karten** präsentieren Material zum Lesen. Klick auf
   "Weiter", wenn du bereit bist.
2. **Übungen** prüfen, was du dir gemerkt hast. Vier Typen
   sind verfügbar:
   - **Zuordnen** — ziehe Paare (Wort ↔ Übersetzung).
   - **Bildauswahl** — wähle das Bild, das zum Hinweis
     passt.
   - **Freitext** — tippe die Antwort.
   - **Wort-Kacheln** — setze einen Satz aus Kacheln
     zusammen.

Eine Fortschrittsanzeige oben verfolgt, wie weit du in der
Lektion bist. Du kannst jederzeit aufhören — dein
Fortschritt wird pro Schritt gespeichert und setzt dort
fort, wo du aufgehört hast.

### Die Zusammenfassung

Wenn die letzte Übung abgeschlossen ist, erscheint die
**Lektions-Zusammenfassung**:

- Eine **Sterne-Bewertung von 0–3** basierend auf deinem
  Ergebnis:
  - **3 Sterne** ≥ 90 % richtig
  - **2 Sterne** ≥ 75 %
  - **1 Stern** ≥ 50 %
  - **0 Sterne** unter 50 %
- Eine **Übungs-für-Übung-Aufschlüsselung**, die zeigt,
  welche Übungen du bestanden hast und welche Fehler
  enthielten (mit der richtigen Antwort für die falschen).
- **Nächste Lektion**, **Wiederholen** und **Zurück zum
  Satz** als Schaltflächen, damit die nächste Aktion einen
  Klick entfernt ist.

Schaffst du 3 Sterne beim ersten Versuch, spielt eine
kleine Feieranimation. (Wenn du die OS-Einstellung
"Bewegungen reduzieren" aktiviert hast, respektiert die
Animation das.)

---

## Element-genaue Fehlerverfolgung

Jede falsche Antwort in jedem Übungstyp schreibt eine Zeile,
die auf das **konkrete Element, das du verfehlt hast**,
verweist — das einzelne Wort, Paar oder die Phrase. Die App
merkt sich NICHT nur "du hast 6/10 in Lektion 3 erreicht";
sie merkt sich "du hattest besonders mit *bonjour* und
*merci* zu kämpfen".

Wenn du dasselbe Element **3 Mal hintereinander** richtig
beantwortest, wird es als **gemeistert** markiert — und aus
der Wiederholungs-Warteschlange entfernt. Wenn du ein
gemeistertes Element später falsch beantwortest, **rutscht
es zurück** in die Warteschlange. Eine verfehlte Meisterung
ist eine vergessene Meisterung.

---

## Die Wiederholungs-Warteschlange

Wenn du eines oder mehrere Elemente hast, die eine
Wiederholung brauchen, erscheint die **Wiederholungs-Karte**
auf dem Dashboard. Sie zeigt:

- Wie viele Elemente fällig sind
- Wie viele **überfällig** sind (nach dem geplanten
  Wiederholungsdatum)
- Eine Schaltfläche **Jetzt wiederholen**, die eine
  fokussierte Mini-Session unter `/review/:setId` öffnet

Die Planung verwendet drei Stufen, basierend darauf, wie
oft du das Element hintereinander richtig beantwortet hast:

| Korrekte Serie | Nächste Wiederholung |
|---|---|
| 0 | 1 Tag später |
| 1 | 3 Tage später |
| 2 | 7 Tage später |
| 3 (gemeistert) | aus der Warteschlange entfernt |

Innerhalb der Warteschlange sortieren die Einträge sich:
**überfällige zuerst**, dann nach **Fehleranzahl absteigend**,
dann nach **jüngstem Fehler zuerst**. So steigen die
Elemente, mit denen du am meisten kämpfst, nach oben.

---

## Wiederholungssitzungen

Eine Wiederholungssitzung unter `/review/:setId`
synthetisiert eine **Mini-Lektion im Flug** aus den obersten
Einträgen deiner Warteschlange. Sie spielt die **genau
gleichen Übungen** wieder ab, bei denen du ursprünglich
gescheitert bist — keine KI-Generierung, keine
Karteikarten, keine erfundenen Inhalte. Wenn du ein Wort in
einer Zuordnungsübung verfehlt hast, machst du diese
Zuordnungsübung erneut (mit frischer Mischung, damit es
kein reines Muskelgedächtnis ist).

Wenn du eine Wiederholungssitzung abschließt, läuft dieselbe
Bewertungs- + Sterne- + Element-Verfolgungs-Maschinerie.
Meistere 50 Elemente durch Wiederholungen und du verdienst
das Abzeichen **Wiederholungsmeister**.

---

## XP und Abzeichen

Jede abgeschlossene Lektion verdient XP nach einer
Sterne-Formel:

- **30 XP** Basis
- **+10 XP pro Stern** erreicht (0 → 0, 1 → +10, 2 → +20,
  3 → +30)
- **+20 XP Bonus**, wenn du 3 Sterne beim ersten Versuch
  erreichst (jeder Schritt mit Versuche = 1, keine
  Wiederholungen)
- Derselbe **tägliche Serien-Multiplikator** wie bei
  Chat-Sessions (+25 % pro Tag in Folge, bei 7 Tagen
  gedeckelt)

Vier neue Abzeichen schalten sich rund um Lektionen frei:

- **Erste Lektion** — schließe deine erste Inhaltslektion
  ab.
- **10 Lektionen abgeschlossen** — schließe 10
  Inhaltslektionen ab.
- **3-Sterne-Serie** — erreiche drei Lektionen in Folge mit
  3 Sternen.
- **Wiederholungsmeister** — beherrsche 50 Elemente durch
  verteilte Wiederholung.

Lektionsabschlüsse zählen auch für deine **tägliche Serie**,
sodass das Lernen mit Inhaltslektionen die Heatmap auf
dieselbe Weise füllt wie Chat-Sessions.

---

## Speichermodi

Lektionen funktionieren in **beiden** Speichermodi — API
(Backend) und Dexie (nur Browser / GitHub Pages).
Element-genaue Fehlerverfolgung und SRS-Planung laufen
identisch gegen IndexedDB im reinen Browser-Modus, sodass
Nutzer:innen, die die öffentliche GitHub-Pages-Seite
besuchen, die volle Wiederholungsschleife ohne Backend
bekommen.

Was im Nur-Browser-Modus *anders* ist: Die
XP-Vergabe- / Abzeichen-Verdienst-Seiteneffekte feuern nur
im API-Modus (sie brauchen die Gamification-Hooks des
Backends). Im Dexie-Modus verdienst du weiterhin XP und
Abzeichen über den Chat-Session-Pfad; der Lektionsabschluss
trägt nur noch nicht dazu bei.

---

## Datenschutz

Alle Lektionsfortschritte, Element-Fehler-Zeilen,
Wiederholungs-Warteschlangen-Zustände und Planungsdaten
bleiben **auf deinem eigenen Gerät** — im Dateisystem
(API-Modus) oder im Browser (IndexedDB). Nichts darüber,
mit welchen Wörtern du kämpfst, wird irgendwohin gesendet.
