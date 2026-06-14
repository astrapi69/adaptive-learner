# Reusability Rules

Vollstaendige Policy: docs/REUSABILITY-POLICY.md

- Props-driven: alle Daten/Callbacks ueber Props oder Seams
- Keine Seiteneffekte beim Import
- Barrel Exports (index.ts / __init__.py) fuer Modulgrenzen
- Generische Benennung (MatchingTile, nicht LessonMatchingTile)
- Token-backed Tailwind-Utilities, keine fixed-palette Klassen, keine Hardcodes
- Wiederverwendbare Teile in frontend/src/shared/ (app-unabhaengig)
- TSDoc/Docstring mit Verwendungsbeispiel Pflicht
- App-spezifischer State nur ueber Props, nie direkt importieren
