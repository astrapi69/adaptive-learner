# Philosophie

> Die beste Lernmethode ist keine feste Methode.

Das ist die These im Kern von AdaptiveLearner. Die meisten
"Lern-Apps" wählen einen Ansatz — Karteikarten, Videolektion,
gamifizierte Streaks — und unterstellen, dass alle gleich
lernen. Das tun sie nicht.

## Warum eine Methode nicht reicht

Verschiedene Themen verlangen verschiedene Methoden. Selbst
das *gleiche* Thema in *verschiedenen Meisterungs-Stadien*
verlangt verschiedene Methoden:

- Du gehst eine neue Grammatik-Regel nicht so an wie das
  Polieren deiner Aussprache.
- Du wiederholst für eine wichtige Prüfung nicht so wie du
  ein Thema aus Neugier erforschst.
- Du fängst dich nach einem Rückschlag nicht so wie du einen
  Streak aufrechterhältst.

Ein Lerner, der fließend zwischen Methoden wechseln kann,
lernt schneller, behält länger und brennt seltener aus. Der
Sinn von AdaptiveLearner ist nicht, deine Eine Wahre Methode
zu finden — er ist, Methodenwechsel billig, natürlich und
pädagogisch gerechtfertigt zu machen.

## Die sechs Methoden

Wir haben sechs Methoden gewählt, die die Hauptachsen
abdecken, wie Menschen tatsächlich lernen:

| Methode | Kern-Haltung |
|---|---|
| Deduktiv | Theorie zuerst — Regeln, dann Beispiele |
| Induktiv | Beispiele zuerst — Regeln aus Mustern ableiten |
| Fehlerbasiert | Fehler provozieren und daraus lernen |
| Dialogisch | Gespräch, niedriger Druck |
| Kontextuell | Alltagsszenarien, situierte Praxis |
| KI-adaptiv | Die KI wählt pro Zug |

Die ersten fünf sind pädagogisch klassisch. Die sechste ist
das ehrliche Eingeständnis, dass KI etwas kann, was Menschen
zuvor nicht konnten: pro *einzelnem Austausch* eine Methode
wählen, basierend darauf, was der Lerner gerade getan hat.

[Methoden im Detail](six-methods.md)

## Der Sieben-Schritt-Zyklus

Jede Session durchläuft einen 7-Schritt-Zyklus: Input,
Versuch, Fehler, Feedback, Anpassen, Wiederholen,
Integrieren. Das meiste Lernen passiert zwischen Fehler und
Feedback (Schritte 3-4) — dort lebt die eigentliche
kognitive Arbeit. Die anderen Schritte sind da, damit Fehler
etwas haben, woran sie sich reiben, und einen Platz, an dem
sie landen.

Der Zyklus ist kein Förderband. Schritte wiederholen,
springen oder gehen zurück, je nachdem, ob du den Stoff
wirklich erfasst hast. Die Dual-Prompt-KI-Architektur (siehe
[Der Sieben-Schritt-Zyklus](seven-steps.md)) entscheidet pro
Roundtrip.

## Git für's Lernen

Wir leihen Gits mentales Modell fürs Tracking:

- **Commit** = der Schnappschuss einer Session (Methode,
  Bewertungen, Dauer).
- **Diff** = die Veränderung zur letzten Session im selben
  Thema.
- **Branch** = ein Methodenwechsel (du bist bei Session 7
  von deduktiv zu dialogisch gewechselt).
- **Verlauf** = deine vollständige Lernspur, abfragbar +
  visualisierbar.

Wir nutzen Git nicht wörtlich; wir nutzen seine Disziplin von
versioniertem, wiederherstellbarem, vergleichbarem Zustand.
ChatGPT vergisst deine Konversation beim Schließen des Tabs.
AdaptiveLearner hält einen strukturierten Schnappschuss jeder
Session, sodass Trends über Wochen und Monate sichtbar
werden.

[Tracking](tracking.md)

## Die drei Säulen

Drei externe Werkzeug-Kategorien stehen neben AdaptiveLearner-
Sessions — wir versuchen nicht, sie neu zu erfinden:

1. **Spaced Repetition** (Anki) — für langfristiges
   Behalten von Regeln + Fehlerkorrekturen.
2. **Active Recall** (NotebookLM) — für Wissensaufbau aus
   eigenen Quellen.
3. **Adaptive KI-Prompts** (Claude / ChatGPT / Gemini) —
   für einmalige Erklärungen + flexible Befragung.

Die Tool-Empfehlungs-Karte im Dashboard rankt diese fünf
Tools (plus Excalidraw + Obsidian) gegen dein Profil, sodass
du siehst, worauf du dich für deine aktuelle Lernform stützen
solltest.

[Werkzeuge](tools.md)

## Warum das wichtig ist

Die Medium-Artikelserie *Von Theorie zur Praxis* ist das
intellektuelle Fundament. AdaptiveLearner ist die ingenieurs-
mäßige Übersetzung: ein Werkzeug, das die Argumente des
Artikels in eine tägliche Praxis übersetzt. Die Artikel
erklären, WARUM sechs Methoden, WARUM sieben Schritte, WARUM
adaptives Wechseln. Diese App gibt dir einen Ort, wo du es
tatsächlich tun kannst.

Die Artikel sind keine Pflichtlektüre. Aber wenn du
verstehen willst, warum wir es so gebaut haben, ist das die
Quelle. Links im README.
