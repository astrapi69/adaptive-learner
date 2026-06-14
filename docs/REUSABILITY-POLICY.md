# Wiederverwendbarkeits-Richtlinie (Adaptive Learner)

> Maximale Wiederverwendbarkeit von Frontend- und Backend-Modulen
> ueber Projektgrenzen hinweg, ohne die bestehende Projektstruktur
> aufzubrechen.

---

## 1. Prinzipien

### 1.1 Dependency Injection ueber Props und Seams

Alle externen Abhaengigkeiten (Storage, API, Navigation, i18n)
werden ueber Props, Hooks oder explizite Seams injiziert.

Bestehende Seams nutzen: IStorageService, guardedFetch,
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
eine index.ts bzw. __init__.py die oeffentliche API.
Interne Dateien duerfen nicht direkt von aussen importiert werden.

### 1.5 Generische Benennung und Schnitt

Extrahierte Komponenten tragen generische Namen die den Zweck
beschreiben, nicht den Kontext der ersten Verwendung.

### 1.6 Dokumentation mit Verwendungsbeispiel

Jede wiederverwendbare Komponente/Funktion hat TSDoc (Frontend)
oder Google-Style Docstring (Backend) mit mindestens:
Kurzbeschreibung, Parameter-Beschreibung, Verwendungsbeispiel.

## 2. Strukturregeln

### 2.1 Frontend: bestehende Verzeichnisstruktur beibehalten

Die aktuelle Struktur (pages/, components/, hooks/, storage/,
lib/) bleibt. KEINE Migration zu src/modules/.

Wiederverwendbare Teile in:
- components/shared/ (generische UI-Komponenten)
- hooks/shared/ (generische Hooks)
- lib/ (generische Utilities)
- components/exercises/ (Exercise-Widgets)

shared/ Verzeichnisse enthalten ausschliesslich Komponenten
die KEINE app-spezifischen Imports haben.

### 2.2 Backend: Plugin-Struktur ist das Modul-Pattern

Jedes Plugin unter plugins/<name>/ IST bereits ein eigenstaendiges
Python-Package. Neue Backend-Module folgen diesem Pattern.

### 2.3 Styling: Design Tokens, nicht Tailwind

CSS Custom Properties (Design Tokens) als Single Source.
Wiederverwendbare Komponenten nutzen CSS Variables mit Fallbacks.
Keine hardcodierten Farben oder Pixel-Werte.

### 2.4 Globaler State: Context fuer Infrastruktur erlaubt

i18n-Context und Theme-Context sind erlaubt.
App-spezifischer State (User-Session, Lesson-Progress,
Feature-Flags) geht ueber Props, nie als direkte Abhaengigkeit.

## 3. Pruefkriterien

1. Import-Check: Keine Imports aus pages/, storage/ in shared/
2. Props-Check: Alle Daten ueber Props oder injizierte Seams
3. Barrel-Check: index.ts als oeffentliche API
4. Styling-Check: CSS Variables mit Fallbacks
5. Seiteneffekt-Check: Kein Netzwerk/Timer/DOM beim Import
6. Naming-Check: Generisch genug fuer andere Projekte
7. Doku-Check: TSDoc/Docstring mit Beispiel
