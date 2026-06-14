# Reusability Rules

Vollstaendige Policy: docs/REUSABILITY-POLICY.md

- Props-driven: alle Daten/Callbacks ueber Props oder Seams
- Keine Seiteneffekte beim Import
- Barrel Exports (index.ts / __init__.py) fuer Modulgrenzen
- Generische Benennung (MatchingTile, nicht LessonMatchingTile)
- CSS Variables mit Fallbacks, kein Tailwind, keine hardcodierten Werte
- Wiederverwendbare Teile in components/shared/ oder hooks/shared/
- TSDoc/Docstring mit Verwendungsbeispiel Pflicht
- App-spezifischer State nur ueber Props, nie direkt importieren
