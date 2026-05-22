# Der Sieben-Schritt-Zyklus

Jede Session läuft durch einen 7-Schritt-Lernzyklus. Die
Schritte kommen aus der Artikel-Serie *Von Theorie zur
Praxis* und spiegeln den tatsächlichen kognitiven Bogen
beim Erwerb einer neuen Fertigkeit.

## Der Bogen

| # | Schritt | Was kognitiv passiert |
|---|---|---|
| 1 | Input | Erste Begegnung mit dem Stoff |
| 2 | Versuch | Anwendung versuchen |
| 3 | Fehler | Erkennen, dass die Anwendung danebenging |
| 4 | Feedback | Verarbeiten, warum der Fehler passierte |
| 5 | Anpassen | Mentales Modell anpassen |
| 6 | Wiederholen | Mit angepasstem Modell üben |
| 7 | Integrieren | Mit dem weiteren Kontext verknüpfen |

## Warum diese Reihenfolge

Sie ist nicht nur bequem — jeder Schritt hängt vom
vorherigen ab:

- **Input → Versuch** ist nicht trivial. Viele Lerner
  überspringen Versuch und gehen direkt vom Input zu "ich
  probier's später." Diese Verzögerung erodiert den
  Abruf. Schritt 2 erzwingt sofortige Anwendung.
- **Versuch → Fehler** ist die produktive Reibung. Der
  Fehler ist *Information*. Eine Lern-Session, die Fehler
  durch nur einfache Fragen vermeidet, sagt dir nichts
  über dein Verständnis.
- **Fehler → Feedback** ist, wo das tiefste Lernen
  passiert. Derselbe Fehler sofort erklärt, mit Bezug auf
  deinen konkreten Versuch, landet; derselbe Fehler eine
  Stunde später aus dem Lehrbuch nicht.
- **Feedback → Anpassen** ist intern. Die KI kann diesen
  Schritt nicht sehen passieren; du machst ihn im Kopf.
  Schritt 5 im KI-Prompt lädt dich bewusst dazu ein, zu
  artikulieren, was du an deinem Vorgehen geändert hast.
- **Anpassen → Wiederholen** verifiziert die Anpassung.
  Die neue Übungsaufgabe nutzt dasselbe Prinzip in
  leicht anderer Form, sodass die Anpassung
  generalisieren muss.
- **Wiederholen → Integrieren** hebt die Fertigkeit aus
  isolierter Übung und verknüpft sie mit anderem
  Wissen. Das macht Lernen haltbar.

## Was, wenn du einen Schritt überspringst

Jeder übersprungene Schritt kostet dich:

- **Input überspringen**: du versuchst, etwas anzuwenden,
  das du nie erklärt bekommen hast. Fühlt sich wie
  Rumfuchteln an.
- **Versuch überspringen**: du liest die Regel und
  unterstellst, dass du sie verstehst. Monate später
  merkst du, dass nicht.
- **Fehler überspringen**: du produzierst keinen Fehler,
  den die KI diagnostizieren kann. Lernen versickert.
- **Feedback überspringen**: du hattest einen Fehler, hast
  aber die Erklärung nicht verarbeitet. Bei der nächsten
  Session machst du denselben Fehler.
- **Anpassen überspringen**: du hast zum Feedback genickt,
  aber dein mentales Modell nicht wirklich geändert. Der
  nächste Versuch deckt es auf.
- **Wiederholen überspringen**: du hast einmal angepasst,
  aber nicht verifiziert, dass die Anpassung
  generalisiert. Die Fertigkeit überträgt sich nicht in
  eine andere Oberflächenform.
- **Integrieren überspringen**: die Fertigkeit bleibt in
  einem Silo. Du schaffst sie in Übungsaufgaben, aber
  nicht in einer realen Situation.

Der Dual-Prompt-KI-Bewerter beobachtet deine Austausche und
kann vorschlagen, auf dem aktuellen Schritt zu bleiben, wenn
du einen kognitiven Takt übersprungen hast. Darum existieren
"Bleib hier"-Vorschläge — sie sind nicht die KI, die
nervt.

## Wie die KI entscheidet

Nach jeder `user`-Nachricht + KI-Antwort feuert ein zweiter
KI-Aufruf mit diesem System-Prompt (sinngemäß):

> Lies den Austausch. Hat der Lerner den aktuellen Zyklus-
> Schritt abgeschlossen? Liefere JSON: `{advance,
> confidence, reason, suggested_step}`.

Das Schema erzwingt ein einzelnes JSON-Objekt; wenn die KI
nicht parsbaren Text liefert, springt ein deterministisches
+1-Fallback (gedeckelt auf Schritt 7).

`suggested_step` kann sein:

- `current + 1` — normaler Vorschub (am häufigsten).
- `current` — bleiben; der Lerner braucht hier mehr Zeit.
- Sprung vorwärts (z.B. 1 → 3) — der Lerner hat den Input
  schon erfasst.
- Schritt zurück (z.B. 4 → 2) — der Lerner ist
  verwirrt und muss erneut versuchen.

Die Route wendet den Vorschlag nur an, wenn
`confidence >= 0.6` (Standard von
`step_evaluation.confidence_threshold` in app.yaml).
Fallback-Urteile wenden den +1-Advance immer an.

## Warum Dual-Prompt statt Single

Derselbe KI-Aufruf könnte sowohl die Lernantwort ALS AUCH
das Schritt-Urteil liefern. Tun wir nicht, weil:

1. **Trennung der Anliegen** — der Lern-Prompt ist pro
   (Methode, Schritt) komponiert. Der Bewerter-Prompt ist
   methoden-bewusst, aber schritt-agnostisch.
2. **Token-Budgets** — die Lernantwort profitiert von 1024
   Tokens; das Urteil braucht nur 256.
3. **JSON-Parse-Robustheit** — die KI zu bitten, Prosa UND
   ein JSON-Schwänzchen in einer Antwort zu liefern, ist
   fragil. Wir fragen zweimal, parsen sauber.
4. **Replay-Fähigkeit** — wenn etwas merkwürdig läuft,
   haben wir die zwei Antworten getrennt geloggt und
   können auditieren.

Der Preis sind zwei API-Calls pro Roundtrip. Bei
billig-Tier-Preisen (claude-haiku, gpt-4o-mini,
gemini-flash) ein Bruchteil eines Cents pro Austausch.

## Zyklus-Fortschrittsanzeige

Die Session-Seite rendert oben einen 7-Kreise-Streifen.
Gefüllt = erledigt; der aktuelle Schritt-Kreis ist in der
Akzentfarbe des Projekts und pulsiert leicht während die KI
nachdenkt. Bei Schritt-Übergängen (vor oder zurück)
animiert der Streifen, sodass sich der Zyklus lebendig
anfühlt.

Auf Mobile (≤768px) wird der Streifen zu einer einzigen
horizontalen Reihe kleiner Kreise, um Vertikalplatz zu
sparen. Swipe-to-Peek auf dem Streifen blendet ein
Informations-Overlay ein, das den vorherigen / nächsten
Zyklus-Schritt beschreibt.

## Auto-Loop (v1.4.0) + Thema-Übergänge

Schritt 7 ist keine Sackgasse mehr. Sobald der Schritt-
Bewerter dich mit `advance=true` auf Schritt 7 bringt,
feuert ein dritter KI-Aufruf — der Thema-Übergangs-
Bewerter — und entscheidet, ob das Thema integriert ist
und ob ein neuer Zyklus starten soll.

Bei `integrated=true ∧ continue_recommended=true`:
`cycle_step` springt auf 1, `cycle_count` erhöht sich um 1,
ein neues Unterthema wird gewählt. Hartcap `max_cycles=5`
pro Session verhindert Endlosschleifen. Ein deterministischer
Fallback erhält das v0.5.0-Cap-bei-7-Verhalten bei jedem
KI- / Parse-Fehler.

Der Chat rendert Zyklus-Übergänge als „Zyklus N"-Karten
mit gestricheltem Rand im Sitzungsverlauf. Der
Bewertungsdialog fasst die Multi-Cycle-Reise zusammen, wenn
`cycle_count > 1`.

## Parallele Zyklus-Grenz-Bewertung (v1.5.0)

Beim Schritt-6→7-Übergang feuern Schritt-Bewerter und
Thema-Übergangs-Bewerter parallel via `asyncio.gather`
(`async_evaluation: true` in `app.yaml`). Das spart ~T₂ an
Latenz an der Zyklus-Grenze.

Die Message-Response trägt einen `timings`-Block mit
`learning_ms` / `evaluation_ms` / `topic_transition_ms` /
`total_ms` / `parallel_saved_ms`.
