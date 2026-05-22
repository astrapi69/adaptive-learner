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
2. **Lernprojekt anlegen**: Thema, Ziel, Zeitrahmen, Minuten
   pro Tag plus optionale Subject-Taxonomie und Tags. Siehe
   [Onboarding](onboarding.md).
3. **Den 12-Fragen-Test machen**, damit die App weiß, auf
   welche Methoden sie setzen soll. Auf Mobil swipest du
   links/rechts zwischen den Fragen. Siehe
   [Lerntyp-Test](assessment.md).
4. **API-Schlüssel hinterlegen** in den Einstellungen ODER
   in `~/.config/adaptive-learner/secrets.yaml`, falls du
   den Desktop-Launcher nutzt. Die Einstellungs-UI zeigt
   pro Anbieter, aus welcher Schicht der Schlüssel kommt.
5. **Deine erste Session starten**. Der „Session starten"-
   Button im Dashboard öffnet ein Lern-Gespräch. Die
   KI-Antworten streamen Token für Token; der Dual-Prompt-
   Evaluator entscheidet pro Zyklus-Schritt. Siehe
   [Lern-Session](learning-session.md).

## Wie es weitergeht

- [Der 7-Schritte-Lernzyklus erklärt](learning-session.md)
- [Dein Dashboard verstehen](dashboard.md)
- [FAQ — häufige Fragen](faq.md)
- [Die pädagogische Idee hinter der App](../concept/philosophy.md)
