# Fortschritt

Die Fortschritts-Seite ist die Detailansicht deiner Lerndaten
— alles, was das Dashboard verdichtet, hier mit Charts und
Tabellen zum Tiefer-Bohren.

## Was du siehst

Vier Abschnitte, von oben nach unten:

1. **Trend-Insights** — mittleres Verständnis, mittlerer
   Stress, Gesamt-Minuten, Streak-Tage. Zahlen, die das
   Dashboard kompakt anzeigt, werden hier zu beschrifteten
   Zeilen.
2. **Methodenverteilung** — dasselbe horizontale
   Balkendiagramm wie im Dashboard, mit Hover-Tooltips für
   die exakte Anzahl pro Methode.
3. **Schritt-Auswertungs-Insights** — liest die
   StepEvaluation-Zeilen, die der Session-Route
   produziert.
4. **Commit-Historie** — jede ProgressCommit-Zeile
   chronologisch, neueste oben.

## Schritt-Auswertungs-Insights

Die Dual-Prompt-Architektur schreibt eine `StepEvaluation`-
Zeile pro KI-Roundtrip mit dem Urteil des Bewerters (advance,
confidence, suggested_step, fallback_used, reason). Der
Tracking-Aggregator liest sie und liefert vier Zahlen, die
einen Blick wert sind:

- **Bewertungen gesamt** — jeder Roundtrip produziert eine.
  Ein länger laufendes Projekt hat schnell Hunderte.
- **Mittlere Konfidenz** — über alle Bewertungen. Ein
  niedriger Durchschnitt (< 0.5) heißt, die KI ist selten
  sicher, dass du bereit für den nächsten Schritt bist — meist
  ein Signal, dass der Stoff genuin schwer ist. Nicht
  schlimm, sondern Information.
- **Wiederholungen** — wie oft der Bewerter dich auf dem
  Schritt belassen hat. Wiederholungs-lastige Phasen sind
  normal, wenn der Stoff dicht ist.
- **Fallback-Zahl** — wie oft das JSON der KI nicht parsbar
  war und der deterministische +1-Advance einsprang. Hohe
  Werte (> 10% der Bewertungen) heißen, die KI hat mit dem
  JSON-Format zu kämpfen — meist ein Modell-Problem, nicht
  deins.

## Zeit-pro-Schritt

Ein Balkendiagramm mit der Gesamtzeit (Sekunden) pro
Zyklusschritt für das Projekt. Der Aggregator schneidet
Lücken über 2 Stunden ab (du warst weg vom Bildschirm — keine
echte Lernzeit), damit einzelne Übernacht-Sessions die
Durchschnitte nicht dominieren.

Wo du am meisten Zeit verbringst, sagt viel. Viel Zeit auf
Schritt 3 (Fehler) heißt, der Stoff hat viele Fallen — vielleicht
genau das, wofür du dich entschieden hast. Viel Zeit auf
Schritt 1 (Input) heißt, der Stoff ist dicht und du liest
langsam.

## Commit-Historie

Jede Zeile ist ein ProgressCommit: Methode, Verständnis-
Rating, Stress-Rating, Dauer in Minuten, committed_at-
Zeitstempel plus die Rich-Text-Sitzungsnotiz inline (Read-
Only-TipTap). Die Liste ist nach Datum oder nach Verständnis
sortierbar.

Gerenderte Notizen zeigen fett / kursiv / Listen / Code-
Blöcke mit Syntax-Highlighting / Links — exakt das, was im
Bewertungsdialog am Sitzungsende getippt wurde.
Ältere Plain-Text-Notizen werden unverändert
durchgereicht.

## Exporte

Drei Export-Typen über Einstellungen → Export, alle in
identischer Shape über beide Speichermodi:

- **Fortschrittsbericht** — die ganze Fortschritts-Seite
  als Markdown- oder PDF-Dokument verpackt.
- **Sitzungsdetail** — Transkript einer einzelnen Session
  + Bewertung + Schritt-Evaluationen.
- **Curriculum-Übersicht** — der Themenbaum + Lektions-
  Zusammenfassungen eines einzelnen Curriculums.

Markdown wird client-seitig erzeugt; PDF nutzt den Browser-
Druck-zu-PDF (versteckter Iframe mit druckoptimiertem
Stylesheet, dann `contentWindow.print()`). Keine externe
PDF-Bibliothek, kein Roundtrip zum Backend.

## Filter

Ein einfacher Filter-Streifen erlaubt:

- **Methode** — nur Commits einer Methode (z.B. deduktiv).
- **Zeitraum** — letzte 7 / 30 / 90 Tage oder alles.

Filter wirken auf alle vier Abschnitte.

## Datenschutz-Erinnerung

Im Lokal-Modus liest die Fortschritts-Seite aus IndexedDB und
zeigt dir, was du in diesem Browser persistiert hast. Im
Server-Modus liest sie aus der SQLite-Datenbank des FastAPI-
Backends. In beiden Fällen wird nichts hier jemals an einen
Drittanbieter-Analytics-Dienst geschickt.
