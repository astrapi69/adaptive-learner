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

Adaptive Learner ist installierbar. Moderne Browser zeigen beim
ersten Besuch eine "Installieren" oder "Zum Startbildschirm
hinzufügen"-Aufforderung. Akzeptiere sie und Adaptive Learner
wird zu einer eigenständigen App auf deinem Smartphone oder
Desktop, startbar ohne Browser-Tab.

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

1. **App öffnen** und Sprache wählen. Alle 8 UI-Sprachen
   sind voll übersetzt (DE, EN, ES, FR, EL, PT, TR, JA).
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
   [Lektionen und Wiederholungen](lessons.md).
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

## Wie es weitergeht

- [Lektionen und Wiederholungen](lessons.md) — der Lektionsablauf im Detail
- [Content Browser](../features/content-browser.md) — Lektionen finden und filtern
- [Mehrere Content-Repositories](../features/content-repos.md) — eigene Inhaltsquellen verbinden
- [Backup und Wiederherstellung](../features/backup.md)
- [Dein Dashboard verstehen](dashboard.md) — Fortschritt, Streak, XP, Badges
- [FAQ — häufige Fragen](faq.md)
- [Die pädagogische Idee hinter der App](../concept/philosophy.md)
