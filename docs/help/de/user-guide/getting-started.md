# Erste Schritte

Adaptive Learner ist ein Lernbegleiter, der auf einem
forschungsgestützten Sechs-Methoden-Modell beruht. Du machst
einen kurzen Test, der herausfindet, welche Methoden zu dir
passen, und führst dann KI-gestützte Lern-Sessions durch einen
Sieben-Schritt-Zyklus. Die App lernt mit dir und passt an, wie
sie unterrichtet.

## Jetzt ausprobieren

Der schnellste Weg, Adaptive Learner kennenzulernen, ist die
öffentliche Online-Version:

[**App öffnen**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

Diese läuft im **Lokal-Modus** — alle deine Daten bleiben in
deinem Browser (IndexedDB), und KI-Aufrufe gehen direkt aus
der Seite an Anthropic, OpenAI oder Google Gemini mit deinem
eigenen API-Schlüssel. Kein Backend dazwischen.

## Als Progressive Web App installieren

Adaptive Learner ist installierbar, und der Weg dahin hängt von
deiner Plattform ab:

- **Android & Desktop (Chrome / Edge):** Der Browser löst eine
  Installations-Aufforderung aus, die die App in ein dezentes,
  schließbares **„App installieren"**-Banner umwandelt (nach dem
  Schließen erneut nach 7 Tagen angeboten). Du kannst auch
  jederzeit über **Einstellungen → Daten → App installieren**
  installieren.
- **iPhone / iPad (Safari):** iOS hat keine automatische
  Installations-Aufforderung, daher zeigt Adaptive Learner
  stattdessen einen kleinen **„Zum Home-Bildschirm
  hinzufügen"**-Hinweis: Tippe auf den **Teilen**-Knopf, dann auf
  **„Zum Home-Bildschirm"**. Der Hinweis erscheint nur in iOS
  Safari und nur, solange die App noch nicht installiert ist — nach
  der Installation taucht er nie wieder auf.

So oder so wird Adaptive Learner zu einer **eigenständigen App** auf
deinem Smartphone oder Desktop, startbar ohne Browser-Tab. (Läuft
sie bereits als installierte App, erscheint keiner der
Installations-Hinweise.)

Die App funktioniert offline für Dashboard und vergangene
Sessions. Neue KI-Sessions brauchen Internet, weil der
KI-Anbieter außerhalb des Browsers sitzt.

## Was du brauchst

- **Einen modernen Browser** (Chrome 100+, Firefox 100+, Safari
  17+, Edge 100+). Die App nutzt IndexedDB, Service-Worker und
  modernes JavaScript.
- **Einen KI-API-Schlüssel** für mindestens einen der drei
  unterstützten Anbieter (Anthropic, OpenAI oder Google Gemini).
  Die kostenlosen Kontingente reichen meist zum Einstieg; siehe
  [Einstellungen](settings.md) für die Schlüssel-Einrichtung.

## Die ersten fünf Minuten

1. **App öffnen** und Sprache wählen. Alle 11 UI-Sprachen
   sind voll übersetzt (DE, EL, EN, ES, FR, HI, ID, JA, KO,
   PT, TR).
2. **Onboarding: nur Name + Thema.** Der Schnellstart
   verlangt nur diese zwei Felder, alles andere nimmt
   Vorgaben. Danach kannst du „Direkt loslegen" wählen oder
   optional dein Profil im Assistenten genauer einrichten.
   Siehe [Onboarding](onboarding.md).
3. **Erste Lektion starten** — der schnellste Weg ohne
   KI-Schlüssel: Öffne den
   [Content Browser](../features/content-browser.md) unter
   `/content`, wähle einen Lektionssatz und starte eine
   Lektion. Du liest kurze Theorie und machst Übungen; am
   Ende siehst du dein Ergebnis mit Sternen. Siehe
   [Lektionen und Wiederholungen](lessons.md). **Tipp:** Am
   besten fängst du mit dem gebündelten Satz
   **„Adaptive Learner — App-Tutorial"** an — er bringt dir die
   App direkt als Lektionen bei. Siehe
   [App-Tutorial](app-tutorial.md).
4. **Optional: KI-Sessions.** Möchtest du stattdessen das
   geführte Sechs-Methoden-Lerngespräch, hinterlege einen
   **API-Schlüssel** (Einstellungen oder
   `~/.config/adaptive-learner/secrets.yaml`), mach den
   optionalen [Lerntyp-Test](assessment.md) und starte eine
   [Lern-Session](learning-session.md).
5. **Dein Ergebnis sichern.** Aus der Lektions-Zusammenfassung
   kannst du das Ergebnis als Markdown kopieren oder als Datei
   speichern, und unter **Einstellungen → Daten** ein
   [Backup](../features/backup.md) erstellen.

## Eigenen KI-Schlüssel mitbringen

Adaptive Learner ist **Bring-your-own-Key (BYOK)**. Ist kein
Schlüssel gesetzt, zeigt das Dashboard eine einzelne einladende
**„KI-Schlüssel hinzufügen"**-Karte, die zu den KI-Einstellungen
führt. Hinterlege einen Schlüssel für Claude, OpenAI oder Gemini, um
die KI-Funktionen freizuschalten (Tutor-Session, Chat-Analyse,
Übungsgenerierung). Deine Schlüssel werden **lokal** auf deinem
Gerät gespeichert.

## Wie es weitergeht

- [App-Tutorial](app-tutorial.md) — die App direkt im Programm üben (kein KI-Schlüssel nötig)
- [Lektionen und Wiederholungen](lessons.md) — der Lektionsablauf im Detail
- [Content Browser](../features/content-browser.md) — Lektionen finden und filtern
- [Mehrere Content-Repositories](../features/content-repos.md) — eigene Inhaltsquellen verbinden
- [Backup und Wiederherstellung](../features/backup.md)
- [Dein Dashboard verstehen](dashboard.md) — Fortschritt, Streak, XP, Badges
- [FAQ — häufige Fragen](faq.md)
- [Die pädagogische Idee hinter der App](../concept/philosophy.md)
