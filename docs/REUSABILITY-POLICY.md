# Wiederverwendbarkeits-Richtlinie (Adaptive Learner)

> Maximale Wiederverwendbarkeit von Frontend- und Backend-Modulen
> ueber Projektgrenzen hinweg, ohne die bestehende Projektstruktur
> aufzubrechen.

---

## 1. Prinzipien

### 1.1 Dependency Injection ueber Props und Seams

Alle externen Abhaengigkeiten (Storage, API, Navigation, i18n)
werden ueber Props, Hooks oder explizite Seams injiziert.

**Erlaubt:**
```tsx
// Props-driven, wiederverwendbar
function ExerciseTimer({ duration, onTimeout }: TimerProps) { ... }

// Hook mit injiziertem Storage
function useLessonProgress(storage: IStorageService) { ... }
```

**Verboten:**
```tsx
// Direkter Import von app-spezifischem Storage
import { dexieDb } from '../storage/db';
function ExerciseTimer() {
  const settings = dexieDb.settings.get('autosave'); // Seam-Verletzung
}
```

Bestehende Seams nutzen: `IStorageService`, `guardedFetch`,
Repository-Injection. Keine neuen Bypass-Pfade.

### 1.2 Keine Seiteneffekte beim Import

Das Importieren eines Moduls darf keine Netzwerkrequests,
DOM-Manipulationen, Timer oder globale State-Aenderungen ausloesen.
Seiteneffekte gehoeren in explizite Init-Funktionen oder Hooks.

### 1.3 Explizite Abhaengigkeiten

Jedes Modul deklariert seine Abhaengigkeiten sichtbar (Imports,
Props-Interface, Hook-Parameter). Keine implizite Nutzung von
Bibliotheken die nur im Host-Projekt installiert sind.

### 1.4 Barrel Exports fuer Modul-Grenzen

Wenn ein Verzeichnis eine logische Einheit bildet, exportiert
eine `index.ts` bzw. `__init__.py` die oeffentliche API.
Interne Dateien duerfen nicht direkt von aussen importiert werden.

Bereits umgesetzt: `storage/types/index.ts` (17 Module + Barrel).
Gleiches Pattern fuer neue extrahierte Module anwenden.

### 1.5 Generische Benennung und Schnitt

Extrahierte Komponenten tragen generische Namen die den Zweck
beschreiben, nicht den Kontext der ersten Verwendung.

| Statt | Besser |
|-------|--------|
| LessonMatchingTile | MatchingTile |
| AdaptiveLearnerTimer | ExerciseTimer |
| ALContentSearch | SearchableList |
| lessonEventRecorder | eventLogger |

### 1.6 Dokumentation mit Verwendungsbeispiel

Jede wiederverwendbare Komponente/Funktion hat TSDoc (Frontend)
oder Google-Style Docstring (Backend) mit mindestens:
- Kurzbeschreibung (eine Zeile)
- Props/Parameter-Beschreibung
- Ein Verwendungsbeispiel

---

## 2. Strukturregeln (angepasst an Adaptive Learner)

### 2.1 Frontend: bestehende Verzeichnisstruktur beibehalten

Die aktuelle Struktur (`pages/`, `components/`, `hooks/`, `storage/`,
`lib/`) bleibt. KEINE Migration zu `src/modules/<feature>/`.

Wiederverwendbare Teile werden in bestehende Verzeichnisse einsortiert.
Das real etablierte Verzeichnis fuer generische, app-unabhaengige Teile
ist `frontend/src/shared/`. Aktuell ausgelieferte Primitives (Stand
v1.79.0):

| Primitive | Eingefuehrt | Zweck |
|-----------|-------------|-------|
| `ListRow` | #460 | generische Listenzeile (Icon + Label + Aktion) |
| `ProgressBar` | #462 | props-getriebener Fortschrittsbalken |
| `LessonStepNav` | #476 | Schritt-Navigation (Prev/Next/Index) |
| `XpBadge` | #510 | generisches XP-/Punkte-Badge |
| `IconBadge` | #522 | Icon-+-Label-Badge (a11y, token-backed) |
| `MenuToggleButton` | — | generischer Toggle-Button fuer Menues |

Alle sind props-getrieben, ohne app-spezifische Imports, mit TSDoc +
Verwendungsbeispiel + Unit-Test (Reusability-Policy). Weitere generische
Teile landen ebenfalls hier:

| Typ | Ort | Beispiel |
|-----|-----|---------|
| Generische UI-Komponenten | `frontend/src/shared/` | MatchingTile, ExerciseTimer |
| Generische Hooks | `frontend/src/shared/` | useDebounce, useTimer |
| Generische Utilities | `frontend/src/lib/` | eventLogger, formatDuration |
| Exercise-Widgets | `frontend/src/components/exercises/` | MatchingExercise, ClozeExercise |
| Feature-spezifisch | `frontend/src/components/<feature>/` | BackupCompare, ShareWizard |

`frontend/src/shared/` enthaelt ausschliesslich Komponenten/Hooks
die KEINE app-spezifischen Imports haben.

### 2.2 Backend: Plugin-Struktur ist das Modul-Pattern

Jedes Plugin unter `plugins/<name>/` IST bereits ein eigenstaendiges
Python-Package. Die heutige Ist-Struktur:

```
plugins/adaptive-learner-plugin-<name>/
  adaptive_learner_<name>/
    plugin.py          # Plugin-Registration (PluginForge), Hooks
    routes.py          # HTTP-Mapping, delegiert nur
    <module>.py        # Business-Logik
  tests/
  pyproject.toml       # Entry-Point
```

**Ziel (noch nicht erreicht):** die strikte Service/Repository-Schichtung
(`services/` + `repositories/` mit ABC-Interfaces) wie in
`backend/app/repositories/` (Core, EXP-024 Phase 1). Plugins nutzen
heute noch direkten `Session`-Zugriff; ihre Migration auf das
Repository-Pattern ist **EXP-024 Phase 2 und noch offen**. Neue
Backend-Module sollen das Repository-Pattern von Anfang an anstreben.

### 2.3 Styling: Design Tokens

Styling ueber Design Tokens (CSS Custom Properties).
Wiederverwendbare Komponenten nutzen token-backed
Tailwind-Utilities (`bg-accent` -> `var(--accent)`) oder
`var(--token, fallback)` direkt. Keine fixed-palette
Tailwind-Klassen (`bg-blue-500`), keine hardcodierten
Farben/Pixel, kein Verlassen auf `global.css` des Hosts.
Portabilitaet kommt aus den Tokens, nicht aus dem
Verzicht auf Tailwind.

```css
/* Richtig: portabel ueber Tokens mit Fallback */
.exercise-timer {
  color: var(--fg-primary, #1a1a1a);
  background: var(--bg-surface, #ffffff);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-4, 16px);
}
```

### 2.4 Globaler State: Context fuer Infrastruktur erlaubt

i18n-Context und Theme-Context sind Infrastruktur-Concerns
die projektuebergreifend gelten. Wiederverwendbare Komponenten
duerfen `useTranslation()` und Theme-Tokens nutzen.

NICHT erlaubt: app-spezifischer globaler State (User-Session,
Lesson-Progress, Feature-Flags) als direkte Abhaengigkeit
in wiederverwendbaren Komponenten. Diese gehen ueber Props.

---

## 3. Pruefkriterien (fuer Code-Review und Audits)

Bei jeder Extraktion oder neuen Komponente pruefen:

1. **Import-Check:** Hat die Komponente Imports aus `pages/`,
   `storage/` (ausser Typen), oder app-spezifischen Hooks?
   Wenn ja: nicht wiederverwendbar, gehoert nicht in `shared/`.

2. **Props-Check:** Kommen alle Daten und Callbacks ueber Props
   oder injizierte Seams? Oder greift die Komponente direkt
   auf app-internen State zu?

3. **Barrel-Check:** Exportiert das Modul-Verzeichnis eine
   `index.ts` mit der oeffentlichen API? Werden interne
   Dateien von aussen direkt importiert?

4. **Styling-Check:** Nutzt die Komponente token-backed
   Tailwind-Utilities bzw. CSS Variables mit Fallbacks? Oder
   fixed-palette Klassen / hardcodierte Werte / globale Klassen?

5. **Seiteneffekt-Check:** Loest der Import der Komponente
   Netzwerk-Calls, Timer oder DOM-Manipulationen aus?

6. **Naming-Check:** Ist der Name generisch genug fuer
   Wiederverwendung in anderen Projekten?

7. **Doku-Check:** Hat die Komponente TSDoc/Docstring mit
   Verwendungsbeispiel?

---

## 4. Kompatibilitaet mit bestehenden Regeln

Diese Richtlinie ergaenzt und widerspricht nicht:

| Bestehende Regel | Verhaeltnis |
|------------------|-------------|
| DESIGN-TOKEN-ARCHITECTURE | Bestaetigt (token-backed Tailwind + CSS Variables) |
| Vibe-Coding-Policy | Bestaetigt (Schichtarchitektur, DI) |
| FUNKTION-NICHT-VERFUEGBAR | Kompatibel (Props-driven Features) |
| SYNC-UI-GATE | Kompatibel (Seam-basiert) |
| Kohaesions-Watcher | Kompatibel (Barrel = saubere Module) |
| 44px Touch Targets | Kompatibel (Komponenten-intern) |
| IStorageService Seam | Bestaetigt (DI, kein direkter Zugriff) |
