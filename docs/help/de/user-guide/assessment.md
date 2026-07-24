# Der Lerntyp-Test

Der Test besteht aus 12 Fragen darüber, wie du an neuen Stoff
herangehst. Jede Frage dauert 5-10 Sekunden; der ganze Test
unter zwei Minuten.

## Wie er funktioniert

Jede Frage zeigt 3-4 Antwortmöglichkeiten. Die meisten Fragen
sind **Einfachauswahl** (Radio-Buttons - eine wählen). Einige
sind **Mehrfachauswahl** (Checkboxen - alles wählen, was
passt). Die App zeigt dir an, welcher Typ jeweils gilt.

Auf Mobil und Touch-Geräten **wischst du nach links oder
rechts**, um zwischen Fragen zu navigieren. Auf dem Desktop
machen das die Pfeiltasten. Ein einmaliger Hinweis auf der
ersten Frage erklärt das.

Hinter jeder Antwort liegt ein Gewicht: wie stark sie dich in
Richtung einer der sechs Lernmethoden (deduktiv, induktiv,
fehlerbasiert, dialogisch, kontextuell, KI-adaptiv) zieht.
Der Rechner summiert die Gewichte, normalisiert auf die
Fragenzahl und erzeugt ein 6-Methoden-Profil.

## Die sechs Methoden auf einen Blick

| Methode | Stärke |
|---|---|
| Deduktiv | Erst Regel, dann Beispiele - theoriegetrieben |
| Induktiv | Erst Beispiele, dann Regel - mustergetrieben |
| Fehlerbasiert | Fehler provozieren und daraus lernen - reibungsgetrieben |
| Dialogisch | Entspanntes Gespräch - austauschgetrieben |
| Kontextuell | Alltagsszenarien - situationsgetrieben |
| KI-adaptiv | Die KI wählt pro Zug - meta-getrieben |

[Die sechs Methoden im Detail](../concept/six-methods.md)

## Dein Profil

Nach der letzten Frage siehst du einen **Radar-Chart**: sechs
Achsen, das Gewicht jeder Methode als Punkt auf ihrer Achse.
Die Form sagt viel:

- **Eine weit herausragende Spitze** = eine dominante Methode.
  Die App stützt sich darauf standardmäßig.
- **Eine runde Form** = ausgeglichener Lerntyp. Die App
  startet mit der "deduktiv"-Vorgabe, ist aber zwischen
  Sessions wechselwilliger.
- **Eine flache Form** bei niedrigen Werten = du hast keine
  starken Präferenzen gepickt. Auch in Ordnung; die
  KI-adaptive Methode greift hier besonders gut.

Die **dominante Methode** (höchstes Gewicht, alphabetischer
Tie-Break) steht explizit über dem Chart. Ein
**Text-to-Speech**-Button neben dem Ergebnis liest die
Zusammenfassung vor (Web Speech API; funktioniert in
modernen Browsern).

## Mehrfachauswahl

Wenn eine Frage mehrere Antworten zulässt, wird das Gewicht
jeder Auswahl durch die Anzahl der Picks geteilt. Zwei
Antworten zu wählen trägt insgesamt genauso viel bei wie eine -
so kannst du den Test nicht durch "alles ankreuzen"
verzerren.

## Test wiederholen

Wie du dich beim Lernen siehst, ändert sich mit der Zeit. Die
Lerntyp-Test-Seite ist immer über den "Test wiederholen"-Link
im Dashboard erreichbar. Eine Neuauswertung erhöht das
`version`-Feld deines Profils und überschreibt die alten
Gewichte; das KI-Verhalten ändert sich ab der nächsten
Session.

## Test überspringen

Wenn du den Test überspringst, nutzt die App **deduktiv** als
Standardmethode und die Sessions sind trotzdem nützlich. Mach
den Test, wenn du soweit bist - es gibt keine Strafe für ein
spätes Nachholen.
