# Inhaltslektionen und Wiederholungen

Eine **Inhaltslektion** ist eine kleine, handgefertigte
Lerneinheit (meist 5–10 Minuten), die aus einem öffentlichen
Lektionssatz heruntergeladen wird. Sie läuft in einem
eigenen Viewer, nicht in der KI-Chat-Session. Nach der
Lektion merkt sich die App genau, welche Wörter, Paare oder
Phrasen du falsch beantwortet hast, und plant sie für eine
gezielte Wiederholungssitzung später ein.

Lektionen sind ein **alternativer Lernweg**, der keinen
KI-API-Schlüssel benötigt - ideal zum Ausprobieren der App
oder für Inhalte, bei denen kuratiertes Material besser
funktioniert als freier Chat.

---

## Woher Lektionen kommen

Lektionen leben in **Inhaltssätzen** - kleinen Bündeln, die
in öffentlichen GitHub-Repos veröffentlicht sind. Der
**Set-Browser** unter `/content` listet jeden verfügbaren
Satz auf; klicke einen an, um ihn herunterzuladen. Der Satz
wird lokal zwischengespeichert (im Dateisystem bei Backend-
Betrieb, in IndexedDB im reinen Browser-Modus), sodass du
nach dem ersten Download offline lernen kannst.

Die gebündelte Bibliothek wächst über mehrere Content-Sprachen
und Domänen; den aktuellen Bestand zeigt der Set-Browser.
Jedes Release bringt neue Sets hinzu - siehe
das
[Set-Repo](https://github.com/astrapi69/adaptive-learner-content)
für den aktuellen Katalog.

---

## Lernmodi

Du kannst eine einzelne Lektion - oder einen ganzen Satz -
in verschiedenen **Modi** spielen. Der gewählte Modus wird
als deine Voreinstellung gemerkt und auf dem Versuch
gespeichert, sodass Fortschritt und Statistik wissen, wie
du geübt hast:

- **Üben (Practice)** - der entspannte Standardmodus. Alle
  Lernhilfen bleiben an: Hinweise, die Theorie-Wiederholung,
  das Vorlesen und das Aufdecken der Lösung.
- **Prüfung (Exam)** - Abruf unter realistischen
  Bedingungen. Hinweise, Theorie-Wiederholung, Vorlesen und
  das Aufdecken der Lösung sind ausgeblendet; das Feedback
  kommt gebündelt am Ende, mit einer eigenen
  **Ergebnisansicht**, einem **Bestanden/Nicht-bestanden-
  Urteil** gegen eine konfigurierbare **Bestehensschwelle**
  und einem **Bonus-XP** für das Bestehen.
- **Auf Zeit (Timed)** - ein Countdown pro Übung. Die
  Schwierigkeit ist wählbar: **Entspannt** (2× Zeit),
  **Normal** oder **Schnell** (0,7× Zeit). Läuft die Zeit
  ab, wird die Antwort gesperrt; am Ende erhältst du
  Zeit-Statistiken (in der Zeit beantwortet, Durchschnitt /
  schnellste / langsamste).
- **Fehler trainieren** - wiederholt nur die Übungen, die
  du zuvor falsch hattest. Der Einstieg ist gesperrt und
  erscheint, sobald du Fehler zum Trainieren hast.
- **Reverse (Umgekehrt)** - dreht die Übungsrichtung um
  (z. B. produzieren statt erkennen). Übungstypen, die sich
  nicht umkehren lassen, werden in ihrem Originalformat
  gezeigt.
- **Zufall (Shuffle)** - mischt und verschachtelt die
  Reihenfolge, damit du dich nicht auf reines
  Muskelgedächtnis verlassen kannst.
- **Endlos (Endless)** - liefert fortlaufend Übungen für
  einen offenen Übungslauf.

Einen **Standardmodus** (samt Bestehensschwelle der Prüfung
und Zeit-Schwierigkeit) kannst du unter
**Einstellungen → Lernen** festlegen.

---

## Der Lektionsablauf

Öffne einen Satz, wähle eine Lektion, und der
**Lektions-Viewer** führt dich Schritt für Schritt durch
jede Karte und Übung:

1. **Karten** präsentieren Material zum Lesen. Klick auf
   "Weiter", wenn du bereit bist.
2. **Übungen** prüfen, was du dir gemerkt hast. Die
   Kern-Typen:
   - **Zuordnen** - ziehe Paare (Wort ↔ Übersetzung). Beide
     Kacheln eines gefundenen Paares teilen sich eine
     **eigene Farbe** und ein **Nummern-Badge**, sodass die
     Zuordnung farbenblind-sicher erkennbar ist (nicht nur
     über Farbe), und das Auflösen eines Paares spielt eine
     kurze **Animation**, damit die Verbindung leicht zu
     verfolgen ist.
   - **Bildauswahl** - wähle das Bild, das zum Hinweis
     passt.
   - **Freitext** - tippe die Antwort.
   - **Wort-Kacheln** - setze einen Satz aus Kacheln
     zusammen.
   - **Lückentext** - fülle eine Lücke im Satz (entsteht
     gezielt aus deinen Fehlern, siehe unten).
   - **Multiple Choice** - wähle eine oder (je nach Aufgabe)
     mehrere richtige Antworten.

   Dazu kommen **Erweiterungs-Typen**, die ein Set mitbringen
   kann: Kategorisierung, Fehlerkorrektur, Leseverständnis,
   benoteter Quiz und **Audio-Diktat** (hören, dann
   transkribieren).

Trägt eine Übung eine vom Autor vergebene **Schwierigkeit**,
zeigt ein kleines Badge die Stufe (**Leicht / Mittel /
Schwer**). Es ist reine Transparenz: Du siehst, warum der
adaptive Generator eine Karte früher oder häufiger
vorschlagen kann - an Bewertung oder Reihenfolge ändert das
Badge nichts.

Eine **Lückentext**-Lücke gibt es in drei Spielarten: Antwort
*eintippen*, eine Option aus einer Liste *auswählen*, oder - wenn
mehrere Antworten richtig sind - **„Alle zutreffenden
auswählen"** (eine Mehrfachauswahl-/Checkbox-Lücke, die nur dann
als richtig gewertet wird, wenn du genau die korrekte Menge
ankreuzt - nicht mehr und nicht weniger). Mit der
Mehrfach-Antwort-Variante können Autoren Fragen wie *„Welche davon
sind Primzahlen? 2, 4, 5, 9"* schreiben, ohne einen eigenen
„Multiple-Choice"-Übungstyp.

Eine Fortschrittsanzeige oben verfolgt, wie weit du in der
Lektion bist. Du kannst jederzeit aufhören - dein
Fortschritt wird pro Schritt gespeichert und setzt dort
fort, wo du aufgehört hast.

### Enter-Shortcut

Du kannst die ganze Lektion über die Tastatur bedienen:
**Enter** prüft eine beantwortete Übung und geht dann zum
nächsten Schritt; Freitext- und Lückentext-Felder senden auf
Enter ab (kein Zeilenumbruch). Steuerelemente, die Enter
selbst brauchen, behalten Vorrang. Der Shortcut ist in
**Einstellungen → Lernen** umschaltbar (standardmäßig an) und
gilt auch im Fehler-Replay („Fehler wiederholen").

### Beispiel- und Theorie-Links

- **Beispiel ansehen:** Ein Theorieschritt kann einen
  optionalen Link zu einem ausführlichen Beispiel tragen, der
  als „Beispiel ansehen"-Schaltfläche erscheint.
- **Theorie nochmal lesen:** Eine Übung zeigt einen dezenten
  Link zur nächstgelegenen vorangehenden Theorie; von dort
  bringt dich „Zurück zur Übung" wieder an die Aufgabe. So
  schlägst du eine Regel nach, ohne den Faden zu verlieren.

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

### Die Zusammenfassung anpassen

Wähle, welche Bereiche die Abschluss-Zusammenfassung zeigt und in
welcher Reihenfolge, unter **Einstellungen → Lernen**. Die Bereiche
sind: Ergebnis und Statistik, XP-Belohnung, Favoriten-Hinweis,
Ergebnis teilen, Antwort-Übersicht, Ergebnis-Export und
Nächste-Schritte-Vorschläge. Die „Weiter"-Aktionen bleiben stets
sichtbar.

### Ergebnis exportieren

Die Zusammenfassung bietet **„Ergebnis kopieren"** und
**„Als Datei speichern"**. Beide erzeugen einen
**Markdown-Report** mit deinem Punktestand, einer
Fehler-für-Fehler-Aufschlüsselung (deine Antwort + die
richtige Antwort) und den noch schwachen Bereichen. Der
Report eignet sich zum Einfügen in einen KI-Assistenten, der
dir gezielt weiterhelfen soll. Der Export ist ein reiner
Erzeuger ohne Backend und funktioniert in beiden
Speichermodi.

---

## Element-genaue Fehlerverfolgung

Jede falsche Antwort in jedem Übungstyp schreibt eine Zeile,
die auf das **konkrete Element, das du verfehlt hast**,
verweist - das einzelne Wort, Paar oder die Phrase. Die App
merkt sich NICHT nur "du hast 6/10 in Lektion 3 erreicht";
sie merkt sich "du hattest besonders mit *bonjour* und
*merci* zu kämpfen".

Wenn du dasselbe Element **3 Mal hintereinander** richtig
beantwortest, wird es als **gemeistert** markiert - und aus
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

### Prüfungsmodus-Bonus

Ein Element im **Prüfungsmodus** richtig zu beantworten ist ein
stärkerer Beleg für Behalten als ein Treffer in entspanntem Üben -
du hast es unter Druck und ohne sofortiges Feedback abgerufen.
Daher verdient ein im Prüfungsmodus bestandenes Element ein
**längeres nächstes Wiederholungs-Intervall** als dieselbe richtige
Antwort im Übungsmodus. (Das ist das Spiegelbild zur Hinweis-
Nutzung, die das Intervall *verkürzt*.) Der Bonus greift in beiden
Speichermodi, sodass auch reine Browser-Lernende dieselbe Planung
bekommen.

---

## Wiederholungssitzungen

Eine Wiederholungssitzung unter `/review/:setId`
synthetisiert eine **Mini-Lektion im Flug** aus den
obersten Einträgen deiner Warteschlange. Gemischte
Strategie:

- Hast du ein Wort ursprünglich in einer **Zuordnungs**-
  oder **Bild-Auswahl**-Übung verfehlt, machst du genau
  diese Übung erneut (mit frischer Mischung - kein reines
  Muskelgedächtnis).
- Hast du etwas in **Freitext** oder **Wortkacheln**
  verfehlt, versucht die Wiederholung, eine **Lückentext**-
  Übung zu erzeugen, die exakt das verfehlte Wort
  anvisiert. Dasselbe Wissen in anderer Form -
  Flexibilität wird trainiert, nicht nur das Wiederholen
  eines speziellen Übungsformats.
- Falls für ein Element kein sauberer Lückentext gebaut
  werden kann (z. B. wenn der Original-Prompt die Antwort
  nicht im Satz enthielt), spielt die Wiederholung
  geräuschlos die Originalübung ab. Du bekommst nie einen
  kaputten oder leeren Schritt.

Wenn du eine Wiederholungssitzung abschließt, läuft
dieselbe Bewertungs- + Sterne- + Element-Verfolgungs-
Maschinerie. Meistere 50 Elemente durch Wiederholungen und
du verdienst das Abzeichen **Wiederholungsmeister**.

## Korrektur-Runde am Lektionsende

Wenn du eine Lektion mit Fehlern
abschließt, zeigt die Zusammenfassungsseite eine kleine
**Korrektur-Runde** zwischen deinem Punktestand und dem
"Nächste Lektion"-Button. Sie nimmt bis zu fünf konkrete
Fehler aus dieser Lektion und bietet jeden als frischen
Lückentext an, der genau das verfehlte Wort / den
verfehlten Artikel anvisiert.

- **Jederzeit überspringbar.** Der "Nächste Lektion"-
  Button bleibt sichtbar - die Korrektur-Runde ist
  freiwillige Übung, kein Gate.
- **Erscheint nur, wenn es etwas zu korrigieren gibt.**
  Lektionen mit perfektem Punktestand überspringen sie
  vollständig. Lektionen, deren Fehler sich nicht zu einem
  sauberen Lückentext umformen lassen (selten), ebenfalls.
- **Jeder abgeschlossene Lückentext zählt zur
  Beherrschung.** Die Korrektur-Runde schreibt dieselben
  Element-Verfolgungs-Datensätze wie die Hauptlektion;
  dein Streak auf diesen Elementen rückt Richtung
  3-richtig-Beherrschungsschwelle.

Am Ende erscheint eine kurze "{n} Elemente verbessert"-
Zeile, damit du den Effekt deiner zusätzlichen Übung
siehst.

## Visuelles Diff-Feedback

Falsche Freitext- und
Wortkachel-Antworten zeigen jetzt eine **Token-genaue
Diff** zwischen deiner Eingabe und der kanonischen
Antwort. Drei Farben, nie nur Farbe allein:

- **Rot durchgestrichen** - was du geschrieben hast und
  nicht hingehört (mit einem ×-Marker für Screenreader
  und farbenblinde Nutzer:innen).
- **Grün** - was die kanonische Antwort enthält und du
  übersehen hast (mit einem +-Marker).
- **Gelb** mit Pfeil → - ein leicht falsches Wort,
  dargestellt als `dein-wort` → `erwartet`.

Dieselbe Diff erscheint in der Zusammenfassung der
Lektion in der Aufschlüsselung jeder Übung - für jede
Freitext- oder Wortkachel-Antwort, deren Nutzer-Eingabe
der Speicher kennt.

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

- **Erste Lektion** - schließe deine erste Inhaltslektion
  ab.
- **10 Lektionen abgeschlossen** - schließe 10
  Inhaltslektionen ab.
- **3-Sterne-Serie** - erreiche drei Lektionen in Folge mit
  3 Sternen.
- **Wiederholungsmeister** - beherrsche 50 Elemente durch
  verteilte Wiederholung.

Lektionsabschlüsse zählen auch für deine **tägliche Serie**,
sodass das Lernen mit Inhaltslektionen die Heatmap auf
dieselbe Weise füllt wie Chat-Sessions.

---

## Speichermodi

Lektionen funktionieren in **beiden** Speichermodi - API
(Backend) und Dexie (nur Browser / GitHub Pages).
Element-genaue Fehlerverfolgung und SRS-Planung laufen
identisch gegen IndexedDB im reinen Browser-Modus, sodass
Nutzer:innen, die die öffentliche GitHub-Pages-Seite
besuchen, die volle Wiederholungsschleife ohne Backend
bekommen.

Auch die Gamification ist angeglichen: Im
reinen Browser-Modus verdienst du für abgeschlossene
Lektionen **dieselben XP und Lektions-Abzeichen** wie im
Server-Modus - die Stern-, Streak- und Abzeichen-Logik ist
in TypeScript portiert und gegen identische Goldwerte
abgesichert. Es gibt keinen Funktionsunterschied mehr
zwischen den Modi beim Lektionsabschluss.

---

## Datenschutz

Alle Lektionsfortschritte, Element-Fehler-Zeilen,
Wiederholungs-Warteschlangen-Zustände und Planungsdaten
bleiben **auf deinem eigenen Gerät** - im Dateisystem
(API-Modus) oder im Browser (IndexedDB). Nichts darüber,
mit welchen Wörtern du kämpfst, wird irgendwohin gesendet.
