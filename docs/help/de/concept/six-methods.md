# Die sechs Lernmethoden

Jede Methode hat eine Haltung, eine Stärke, eine Schwäche und
einen charakteristischen Stil, den die KI in Sessions
einnimmt. Die 42-Zellen-Prompt-Matrix (6 Methoden × 7
Schritte) implementiert diese Haltungen pro Zyklus-Schritt.

## Deduktiv

**Haltung**: Theorie zuerst. Regel vollständig nennen,
mit Beispielen demonstrieren, dann den Lerner anwenden
lassen.

**Stark wenn**: das Thema saubere, formulierbare Regeln hat
(formale Grammatik, mathematische Beweise, Typsysteme). Der
Lerner akzeptiert bereits, dass Regeln das Feld regieren und
will sie effizient verinnerlichen.

**Schwach wenn**: die Regeln unscharf, umstritten oder
kontextabhängig sind. Reines deduktives Lehren von "gutem
Geschmack" oder "Klarheit" verpufft — der Lerner muss viele
Beispiele sehen, bevor sich das implizite Muster kristallisiert.

**KI-Stil**: präzise, strukturiert, vollständig. Buchstabiert
die Regel in klarer Sprache, demonstriert mit prototypischen
Beispielen, fragt dann nach einer frischen Anwendung.

## Induktiv

**Haltung**: Beispiele zuerst. Drei bis vier sorgfältig
gewählte Beispiele desselben Phänomens zeigen und den
Lerner die Regel selbst ableiten lassen. Die Regel erst
enthüllen, nachdem der Lerner eine Hypothese gebildet hat.

**Stark wenn**: Mustererkennung genau die kognitive
Fertigkeit ist, die der Lerner aufbauen muss.
Sprachlernen, Musiktheorie, Schach-Taktik, Machine-Learning-
Intuition — alle profitieren von induktiver Übung.

**Schwach wenn**: Geschwindigkeit zählt. Der induktive Weg
ist langsamer als der deduktive, wenn die Regel einfach und
eindeutig ist. "Speicher immer freigeben" braucht keine drei
Beispiele; einfach sagen.

**KI-Stil**: präsentiert Beispiele nebeneinander, hält sich
mit Erklärungen zurück, fragt "welches Muster siehst du?"
oder "was ist das nächste Element in dieser Reihe?".

## Fehlerbasiert

**Haltung**: Fehler provozieren, dann daraus lernen. Aufgaben
stellen, die den Lerner gezielt in die klassischen Fallen
des Themas locken. Dann erklären, *warum* die Falle so
verführerisch ist.

**Stark wenn**: das Thema bekannte Fallen hat (Subjekt-Verb-
Kongruenz in langen Sätzen, Off-by-one-Fehler in Schleifen,
verbreitete Fehlschlüsse in Argumentationen). Der Lerner
profitiert davon, den Zug der Falle zu spüren, bevor er den
Korrekturmechanismus versteht.

**Schwach wenn**: der Lerner fragil, ängstlich oder neu ist.
Die "produktive Frustration" kann in "ich kann das nicht"
umschlagen ohne sorgfältige Rahmung. Der `Schritt 3
(Fehler)`-Prompt der KI in dieser Methode sagt explizit
"präzise diagnostizieren ohne Polster" — das ist eine
Lehrentscheidung, kein Persönlichkeitsdefekt.

**KI-Stil**: konfrontativ beim Fehler, dann tief erklärend zu
seinem Mechanismus. "Das ist die typische Falle X — du bist
hineingelaufen, weil Y. Hier ist, warum sie so verführerisch
ist."

## Dialogisch

**Haltung**: Gesprächs-Austausch, niedriger Druck. Aufgaben
als Einladungen rahmen, nicht als Tests. Richtiges explizit
bestätigen, bevor Korrekturen kommen. Den Lerner mitsteuern
lassen.

**Stark wenn**: der Lerner Angst hat, fragiles Selbstvertrauen
oder gegen eine Wand gelaufen ist. Der entspannte Ton stellt
Handlungsfähigkeit wieder her. Auch stark, wenn das Thema
selbst gesprächig ist (Rhetorik, Debatte, Präsentations-
fähigkeiten).

**Schwach wenn**: der Lerner direkte Anweisungen will und
sich am "Magst du es probieren?"-Rahmen reibt. Manche
Lerner lesen dialogische Prompts als ausweichend.

**KI-Stil**: warm, neugierig, niedrig in Dichte. Fragt "was
hat dich dahin geführt?" vor der Korrektur. Bestätigt
Teilrichtiges explizit. Schlägt Tempo- oder Fokus-Wechsel
vor.

## Kontextuell

**Haltung**: reale Szenarien zuerst. Eine konkrete Situation
aufstellen, in der das Thema unmittelbar gebraucht wird;
Theorie kommt erst, nachdem der Lerner versucht hat, im
Szenario zu handeln.

**Stark wenn**: das Thema angewandt oder domain-spezifisch
ist (Geschäftskommunikation, klinisches Schlussfolgern,
Engineering-Trade-offs). Der Lerner muss den situativen
Druck spüren, um zu verstehen, welcher theoretische Knopf
tatsächlich zählt.

**Schwach wenn**: das Thema genuin abstrakt ist
(Mengenlehre, formale Logik, Musiktheorie im Vakuum). Ein
Szenario zu erzwingen lässt die Lektion gekünstelt wirken.

**KI-Stil**: szenisch. "Du stehst vor der Tür zum
Kundentermin und sie fragen…". Fragt nach der nächsten
konkreten Handlung. Zeigt Konsequenzen im Szenario.

## KI-adaptiv

**Haltung**: die KI wählt pro Zug. Liest das Profil und die
Session-Historie; wählt diejenige der anderen fünf Methoden,
die zu *diesem Austausch* passt. Begründet die Wahl in einem
Satz.

**Stark wenn**: der Lerner ein ausgewogenes Profil hat (keine
dominante Methode) oder in einer Session ist, wo mehrere
Methoden funktionieren könnten. Auch stark für fortgeschrittene
Lerner, die artikulieren können, wann eine Methode nicht
greift.

**Schwach wenn**: der Lerner einen stabilen, vorhersagbaren
Lehrstil will. Der ständige Methodenwechsel kann zappelig
wirken, wenn nicht pro Zug gut begründet.

**KI-Stil**: meta-bewusst. Benennt die gewählte Methode
("Lass mich induktiv versuchen..."), führt diese Methode
treu aus und wechselt, wenn das Signal sagt, sie greift
nicht.

## Wie auswählen

Dein Test liefert dir ein 6-Methoden-Profil. Die dominante
Methode ist, womit neue Sessions starten. Aber:

- Der **Session-Bewerter** kann pro Zyklus-Schritt
  vorschlagen, zu bleiben, vorzurücken oder — selten —
  zurückzugehen.
- Die **Methodenwechsel-Heuristik** erkennt Stagnation (drei
  Sessions flaches Verständnis + hoher Stress) und blendet
  ein "willst du [andere Methode] probieren?"-Banner ein.
- Du kannst auf der Session-Seite über den Start-Button
  **manuell** eine Methode wählen. Sinnvoll, wenn du weißt,
  dass das Thema eine bestimmte Methode verlangt.

Methodenwechsel ist das Ziel, nicht Methodentreue. Ein
Lerner, der in seiner AdaptiveLearner-Historie fünf der
sechs Methoden genutzt hat, hat ein reicheres mentales
Werkzeug als jemand, der für immer auf deduktiv festgenagelt
ist.
