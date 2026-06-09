# Onboarding

Seit **v1.64.0** ist der Einstieg bewusst kurz: Der
**Schnellstart** verlangt nur zwei Felder.

1. **Name** — wie die App dich ansprechen soll.
2. **Thema** — was du lernen willst. „Spanische Grammatik",
   „Machine-Learning-Grundlagen", „Solo-Improvisation auf der
   Gitarre". Sei konkret; das ist der Anker für dein Projekt.

Alles Weitere (Ziel, Zeitrahmen, Minuten pro Tag, Sprache)
nimmt sinnvolle **Vorgaben** an, die du jederzeit ändern kannst.

## Direkt loslegen oder Profil einrichten

Nach dem Absenden bietet dir die App zwei Wege:

- **Direkt loslegen** — du landest sofort auf dem Dashboard und
  kannst eine Lektion oder Session starten.
- **Profil einrichten** — öffnet den **Onboarding-Assistenten**:
  eine Frage pro Bildschirm (Ziel → Zeitrahmen → Minuten pro Tag
  → aktuelles Problem → optionaler Lerntyp-Test), jede mit
  Vorbelegung, sodass „Weiter" immer funktioniert, dazu
  Fortschrittsbalken und „Zurück". Die Antworten werden in beiden
  Speichermodi gespeichert.

Der **Lerntyp-Test ist nicht mehr verpflichtend** — er ist nur
noch über den letzten Schritt des Assistenten erreichbar. Mehr
dazu unter [Lerntyp-Test](assessment.md).

## Fortsetzbares Assessment

Brichst du den Lerntyp-Test mittendrin ab, merkt sich die App
den Zwischenstand (aktuelle Frage, bisherige Antworten,
Startzeit) projektbezogen, sodass du **dort weitermachst, wo du
aufgehört hast**. Dashboard und Einstellungen laden dich aktiv
ein, das Lernprofil **fortzusetzen, zu erstellen oder neu zu
machen**. Sobald das Profil berechnet ist, wird der
Zwischenstand verworfen.

## Optional: aktuelles Problem

Im Schritt „aktuelles Problem" kannst du eine offene Frage gleich
ins Projekt einbringen. Wenn du es ausfüllst, startet die erste
KI-Session mit diesem konkreten Hindernis statt mit einem offenen
„woran willst du arbeiten?"-Prompt.

## Subjects und Tags

Du kannst deinem Projekt optional ein **Subject** (Fachgebiet
aus dem geseedeten Taxonomie-Baum) und **Tags** (komma-getrennte
Freitext-Labels) zuordnen. Beide tauchen später in der
Dashboard-Filter-Leiste auf; der Subject-Filter listet nur deine
eigenen Subjects, nach häufigster Nutzung sortiert. Wer ein
Sprachen-Subject wählt, schaltet die Aussprache-Übung frei.

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
