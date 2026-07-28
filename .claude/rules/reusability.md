---
description: Reusability rules - props-driven components, barrel exports, generic naming, token-backed utilities, implementation hierarchy (language -> framework -> library -> self)
globs:
  - frontend/src/**/*.ts
  - frontend/src/**/*.tsx
  - backend/app/**/*.py
  - plugins/**/*.py
alwaysApply: false
---

# Reusability Rules

Vollständige Policy: docs/policies/REUSABILITY-POLICY.md

## Core Rules

- Props-driven: alle Daten/Callbacks über Props oder Seams
- Keine Seiteneffekte beim Import
- Barrel Exports (index.ts / __init__.py) für Modulgrenzen
- Generische Benennung (MatchingTile, nicht LessonMatchingTile)
- Token-backed Tailwind-Utilities, keine fixed-palette Klassen, keine Hardcodes
- Wiederverwendbare Teile in frontend/src/shared/ (app-unabhängig)
- TSDoc/Docstring mit Verwendungsbeispiel Pflicht
- App-spezifischer State nur über Props, nie direkt importieren

## Implementierungs-Hierarchie

Vor jeder neuen Utility die Hierarchie top-down durchgehen, bei der ersten passenden Stufe stoppen:

### 1. Sprache/Runtime zuerst (native APIs, keine Bundle-Kosten)

**JS/TS:** `Intl`, `crypto.subtle`, `URL`, `fetch`, `structuredClone`, `Array`/`Set`/`Map`, `IntersectionObserver`

**Python:** `pathlib`, `dataclasses`, `json`, `hashlib`, `functools`, `unicodedata`

### 2. Framework (was schon da ist)

**React:** Hooks/Context, Vite `define`/`import.meta.env`

**FastAPI:** `Depends`/`BackgroundTasks`

### 3. Library (npm/PyPI, nur wenn 1+2 nicht reichen)

- Bereits vorhandene Dependency vor neuer
- Neue muss > 1000 weekly downloads haben
- Letztes Release < 6 Monate
- < 100 kB für < 50 LOC
- Keine CVEs

### 4. Selbst schreiben (nur wenn 1-3 nicht passen)

- Library-Grade (keine App-Imports, eigene Typen, TSDoc, einzeln nutzbar)
- Kohäsion < 500 Zeilen / ein Concern
- Complexity cc < 20
- Eigene Tests
- PR dokumentiert WARUM selbst gebaut (welche Stufe, welcher Grund)

## Referenzen

- Vollständige Policy: docs/policies/VIBE-CODING-POLICY.md §7
- Worked reference: docs/audits/2026-06-17-library-first-audit.md
