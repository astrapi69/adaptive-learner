# Adaptive Learner

**Lerne, wie du wirklich lernst.**

Adaptive Learner ist ein Open-Source-Lernbegleiter, der auf
einem forschungsgestützten Sechs-Methoden-Modell aufbaut. Du
machst einen 12-Fragen-Test, die App findet heraus, welche
Methoden zu dir passen, dann führen KI-gestützte Sessions
dich durch einen Sieben-Schritt-Lernzyklus. Die App passt an,
wie sie unterrichtet, basierend darauf, wie du tatsächlich
lernst. **v1.20.0**, 34 Entwicklungsphasen ausgeliefert.

[Jetzt ausprobieren](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }
[GitHub](https://github.com/astrapi69/adaptive-learner){ .md-button }

---

## Was es anders macht

### Sechs Methoden, nicht eine

Die meisten Lern-Apps wählen einen Ansatz — Karteikarten,
Video, gamifizierte Streaks — und unterstellen, dass alle
gleich lernen. Adaptive Learner liefert sechs Methoden
(deduktiv, induktiv, fehlerbasiert, dialogisch, kontextuell,
KI-adaptiv) und hilft dir, zwischen ihnen zu wechseln, wenn
du wächst.

[Die sechs Methoden →](concept/six-methods.md)

### Ein Sieben-Schritt-Lernzyklus

Jede Session läuft durch Input → Versuch → Fehler →
Feedback → Anpassen → Wiederholen → Integrieren. Eine
Dual-Prompt-KI bewertet pro Zug, ob du bereit bist
vorzurücken, zu bleiben oder zurückzugehen. Kein Förderband
— echtes kognitives Pacing.

[Der Sieben-Schritt-Zyklus →](concept/seven-steps.md)

### Local-first, KI-betrieben

Wechsle zwischen **Lokal-Modus** (alles im Browser, KI-
Aufrufe direkt an Anthropic / OpenAI / Gemini) und
**Server-Modus** (FastAPI-Backend). Bring deinen eigenen
KI-Schlüssel mit. Als PWA installierbar — funktioniert
offline für vergangene Sessions und das Dashboard.

[Erste Schritte →](user-guide/getting-started.md)

### Git fürs Lernen

Sessions sind Commits. Trends zeigen sich über Wochen.
Streaks zählen, sind aber nicht der Punkt. Der Punkt sind
Muster: welche Methode für welches Thema, wo du kognitive
Zeit verbringst, welcher Methodenwechsel Fortschritt
freigeschaltet hat.

[Tracking →](concept/tracking.md)

---

## Schnellstart

1. **Live-App öffnen** unter
   [astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/).
2. **Sprache wählen** + **Lernprojekt anlegen** (Thema,
   Ziel, Zeitrahmen).
3. **12-Fragen-Test machen** (~2 Minuten).
4. **KI-API-Schlüssel hinzufügen** (Anthropic, OpenAI oder
   Gemini — kostenlose Tiers reichen).
5. **Erste Session starten** vom Dashboard aus.

[Voller Erste-Schritte-Guide →](user-guide/getting-started.md)

---

## Dokumentation

- [**Benutzerhandbuch**](user-guide/getting-started.md) —
  für Lernende, die die App nutzen.
- [**Konzept**](concept/philosophy.md) — das pädagogische
  Denken dahinter.
- [**Entwickler-Doku**](developer/architecture.md) — für
  Contributors und Plugin-Autoren.
- [**API-Referenz**](api/overview.md) — für Integratoren.

---

## Status

Aktive Entwicklung. **v1.20.0 wurde am 2026-05-22
veröffentlicht** mit dateibasierter Schlüsselkonfiguration
über `secrets.yaml` für den Desktop-Launcher-Use-Case.
34 Entwicklungsphasen ausgeliefert.

- **2634 Tests** (786 Backend + 615 Plugins + 1233 Frontend
  Vitest + 16 Playwright-Smoke-Spec-Dateien)
- **8 Sprachen, alle voll übersetzt** (DE / EN / ES / FR /
  EL / PT / TR / JA)
- **10 Plugins** (Assessment / 3 KI-Anbieter / Session /
  Tracking / Tools / Gamification / Anki / NotebookLM)
- **25 SQLAlchemy-Modelle**, Sync-Oberfläche 28 Tabellen
- **2 Speichermodi** (Lokal IndexedDB / FastAPI-Backend),
  plus dem `secrets.yaml`-Overlay des Desktop-Launchers
- **MIT-lizenziert**

Quellcode, Issues und Beiträge:
[github.com/astrapi69/adaptive-learner](https://github.com/astrapi69/adaptive-learner).
