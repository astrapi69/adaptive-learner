# Onboarding

Nach der Sprachauswahl auf der Startseite sammelt das Onboarding
vier Pflichtfelder plus optionale Taxonomie:

1. **Thema** — was du lernen willst. "Spanische Grammatik",
   "Machine-Learning-Grundlagen", "Solo-Improvisation auf der
   Gitarre". Sei konkret; die KI nutzt das als Anker für jede
   Session.
2. **Ziel** — wie Erfolg aussieht. "B2-Prüfung bestehen",
   "Eine Empfehlungs-Engine end-to-end bauen", "Über einen
   12-Takt-Blues solieren ohne aus dem Takt zu fallen".
   Konkrete Ziele bringen bessere KI-Unterstützung.
3. **Zeitrahmen** — bis wann du das Ziel erreichen willst.
   "6 Wochen", "Bis Ende Sommer", "Bis Q3". Wird genutzt, um
   Erwartungen zu takten und das Streak-Tracking zu setzen.
4. **Minuten pro Tag** — wie viel Zeit du realistisch
   investieren kannst. 15-45 Minuten sind der Sweet Spot für
   adaptives Lernen; die App belohnt keine Marathon-Sessions.

Außerdem wählst du eine **Sprache** für das Projekt. Das ist
die Sprache, in der die KI in den Sessions antwortet; sie darf
von der UI-Sprache abweichen (du kannst die Oberfläche auf
Deutsch lassen und trotzdem Spanisch auf Spanisch lernen).

**Subject-Taxonomie** (optional, seit v1.9.0) — ein
Fuzzy-Suggester gleicht dein Thema mit dem geseedeten
80+-Knoten-Baum unter Sprachen / Mathematik / Programmierung /
Naturwissenschaften / Musik / Geisteswissenschaften /
Sozialwissenschaften / Skills ab. Wer ein Sprachen-Subject
wählt, schaltet später die Aussprache-Übung für das Projekt
frei.

**Tags** (optional) — komma-getrennte Freitext-Labels
(„prüfungsvorbereitung", „täglich", „self-paced"), die später
in der Dashboard-Filter-Leiste auftauchen.

Du kannst das Formular auch komplett überspringen — dann wird
ein Default-User angelegt und du landest direkt auf dem
Dashboard.

## Optional: aktuelles Problem

Im Feld "aktuelles Problem" kannst du eine offene Frage gleich
ins Projekt einbringen. Wenn du es ausfüllst, startet die erste
Session mit diesem konkreten Hindernis statt mit einem offenen
"woran willst du arbeiten?"-Prompt.

## Was als Nächstes passiert

Beim Absenden des Formulars geschehen drei Dinge in einem
Roundtrip:

1. Ein `User`-Datensatz wird angelegt (oder wiederverwendet —
   dein lokaler Browser behält denselben User über Sessions
   hinweg).
2. Ein `LearningProject`-Eintrag erhält dein Thema / Ziel /
   Zeitrahmen / Minuten / Sprache.
3. Der Lerntyp-Test öffnet sich automatisch. Du kannst ihn von
   hier aus überspringen; die App fällt dann auf die
   "deduktive" Methode zurück, bis du ihn nachholst.

## Projekt bearbeiten

Projekt-Details sind nicht in Stein gemeißelt. Auf der
Curriculum-Seite kannst du Thema und Ziel anpassen, sobald du
herausfindest, was du wirklich lernen willst. Sprache änderst
du in den Einstellungen.

## Was nicht gespeichert wird

- **Keine E-Mail**, kein Passwort, kein Konto.
- **Kein Analytics**, keine Drittanbieter-Tracker.
- **Keine Telemetrie** verlässt im Lokal-Modus dein Gerät.

Dein KI-Anbieter sieht deine Nachrichten (das ist ja der Sinn
der KI-Anfrage). Adaptive Learner selbst speichert nur, was du
tippst — lokal oder im FastAPI-Backend, je nachdem welcher
[Speichermodus](settings.md) eingestellt ist.
