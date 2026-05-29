# Einstellungen

Die Einstellungen-Seite sammelt alles, was du ohne Code- oder
YAML-Eingriff anpassen kannst. Abschnitte, von oben nach unten:

1. **Sprache** — UI-Sprache (DE / EN / ES / FR / EL / PT /
   TR / JA, alle voll übersetzt).
2. **KI-Anbieter + Modell-Picker** — welcher Anbieter deine
   Nachrichten sieht und welches Modell zum Einsatz kommt.
3. **API-Schlüssel** — pro Anbieter mit Quellen-Attribution
   (Umgebung / `secrets.yaml` / Einstellungen).
4. **Speichermodus** — Server (FastAPI + SQLite) vs. Lokal
   (Browser-IndexedDB).
5. **Sync** — dieses Gerät über lokales Netz mit einem
   anderen koppeln.
6. **Backup** — Export / Import / Vergleich.
7. **Stimme** — TTS + STT + Aussprache-Toggles.
8. **Oberfläche** — Gesten + Theme + Dichte.
9. **Gamification** — XP- / Abzeichen-Benachrichtigungen +
   Wochenend-Modus.
10. **Über** — Version, Systeminfo, Credits, Spenden, Lizenz.

## Sprache

Tauscht jeden UI-String beim nächsten Render live aus via
`PATCH /api/settings/{user_id}`. Alle 8 Sprachen sind
First-Class — DE / EN / ES / FR / EL / PT / TR / JA — jede mit
einem voll übersetzten Katalog. Über `localStorage` persistent.

## KI-Anbieter + Modell-Picker

Das Anbieter-Dropdown schreibt `active_provider` in die
UserSettings; der nächste KI-Aufruf geht durch das Plugin des
neuen Anbieters (Server-Modus) oder den HTTP-Client des neuen
Anbieters (Lokal-Modus).

Der **Modell-Picker** (seit v1.11.0) ist ein durchsuchbares
Dropdown, gruppiert in Empfohlen / Alle, gefüllt aus dem
Live-`/v1/models`-Endpoint jedes Anbieters (1 h Cache). Jede
Zeile zeigt den Klarnamen + die Roh-ID + ein Kontext-Fenster-
Badge. Wenn die Liste nicht verfügbar ist (kein API-Key,
kein Netz), fällt der Picker auf die statischen Defaults
zurück und zeigt einen „Offline-Default"-Hinweis. Der Header
der Sitzung liest `<Anbieter>: <Modellname>`; volle ID +
Kontext-Fenster sitzen im Tooltip.

## API-Schlüssel (Phase 34 / v1.20.0)

Jeder Anbieter hat seine eigene Zeile: ein Schlüssel-
Eingabefeld, einen Speichern-Knopf, einen Entfernen-Knopf,
das Aktiv-Anbieter-Badge — plus das neue **Quellen-
Attributions**-Badge:

- **Schlüssel aus: Einstellungen** — der Schlüssel ist
  Fernet-verschlüsselt in der DB gespeichert (Server-Modus)
  oder im Klartext in IndexedDB (Lokal-Modus). Speichern /
  Entfernen frei nutzbar.
- **Schlüssel aus: secrets.yaml** — der Schlüssel ist in
  `~/.config/adaptive-learner/secrets.yaml` konfiguriert. Der
  Speichern-Knopf ist deaktiviert; bearbeite die Datei direkt,
  um ihn zu ändern. Ein Info-Banner unter der Zeile erinnert
  an den Pfad.
- **Schlüssel aus: Umgebungsvariable** — der Schlüssel ist
  über die `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`-Umgebungs-
  variable gesetzt. Speichern deaktiviert; die Env-Variable
  ist die Quelle der Wahrheit.
- **Kein Schlüssel konfiguriert** — nichts ist irgendwo
  gesetzt. Tippen und auf Speichern klicken, um zu beginnen.

Auflösungskette (höchste Priorität gewinnt): Umgebung >
`secrets.yaml` > DB. Siehe
[die Konfigurations-Doku](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md) für die
volle Aufschlüsselung.

## Speichermodus

Der Schalter zwischen **Server** und **Lokal (Browser)**:

- **Server** — jeder Lese- und Schreibvorgang geht ans
  FastAPI-Backend. Setzt ein laufendes Backend voraus. Am
  besten für Multi-Device-Nutzung mit Backend-seitigem Sync.
- **Lokal (Browser)** — jeder Lese- und Schreibvorgang geht
  an IndexedDB in diesem Browser. KI-Aufrufe gehen direkt an
  den Anbieter. Kein Backend nötig. Am besten für ein
  privates, geräte-lokales Setup.

Modus-Wechsel speichert nach `localStorage` und zeigt eine
„Neu laden nötig"-Meldung. Daten werden NICHT zwischen
Modi synchronisiert.

## Sync

Kopple dieses Gerät mit einem anderen über dein lokales Netz
per QR-Code-Scanner (Rückkamera) oder eingefügte Pairing-
URL. Nach dem Pairing tauschen Push- + Pull-Knöpfe Daten
bidirektional aus. Konflikte gehen durch einen KI-Merge-
Resolver auf dem Backend.

Eingeschränkter-Browser-Fallback: Lade einen Screenshot des
QR-Codes vom anderen Gerät hoch (`Html5Qrcode.scanFile`).

## Backup

Drei Dinge in einem Abschnitt: **Export** (Download eines
zeitgestempelten JSONs), **Import** (Wiederherstellen aus
Datei) und **Vergleich** (Side-by-Side-Diff gegen aktuellen
Zustand). API-Schlüssel werden aus jedem Export entfernt.

Restore ist ein MERGE, kein Overwrite: neue Zeilen fügen
ein, mutable Zeilen aktualisieren bei neuerem `updated_at`,
History-Zeilen (Sessions / Commits / Ratings) deduplizieren
über UUID. Die Vergleichs-Vorschau zeigt pro Tabelle
hinzugefügt / entfernt / geändert, bevor du auf
Wiederherstellen klickst; das Knopf-Label liest dann
„Wiederherstellen (N hinzugefügt, M aktualisiert)".

Im Lokal-Modus zeigt der Abschnitt zusätzlich den
**Auto-Backup**-Block: ein rollender Ring aus 3 Snapshots in
einer separaten IndexedDB-DB, läuft alle 10 Sessions ODER
alle 7 Tage (je nachdem, was zuerst eintritt). Jeder Snapshot
hat eigene Wiederherstellen- + Löschen- + Vergleich-als-A/B-
Knöpfe.

## Stimme

Drei Toggles (seit v1.18.0):

- **TTS aktiviert** — fügt einen ▶-Knopf neben KI-Antworten
  + Assessment-Ergebnissen ein, der sie laut vorliest. Wählt
  die sprach-passende Stimme, wenn verfügbar; Rate + Pitch
  auf [0,5; 2,0] geklemmt.
- **Auto-Wiedergabe KI** — spricht jede KI-Antwort
  automatisch (Standard AUS — überraschendes Audio ist
  selten, was man will).
- **STT aktiviert** — fügt einen 🎤-Knopf zum Sitzungs-
  Eingabefeld hinzu, der Sprache aufnimmt und das Textarea
  mit Zwischen-Transkripten füllt, bevor du absendest.
- **Aussprache-Übung aktiviert** — bringt die
  `/pronunciation`-Seite vom Dashboard-Quick-Start für
  Sprachen-getaggte Projekte zum Vorschein.

Der Stimme-Abschnitt blendet sich aus, wenn weder die
Web-Speech-API-Synthese noch die -Erkennung vom Browser
unterstützt wird.

## Darstellung (Phase 58 / v1.41.0)

Der **Farbschema**-Picker unter *Allgemein > Darstellung* bietet
sechs Themes plus einen automatischen Modus:

- **Hell** - der Standard, hell und kontrastreich.
- **Dunkel** - gedämpfte Flächen für die Nutzung bei wenig Licht.
- **Ozean** - tiefe Blautöne, ruhig und nachts augenschonend.
- **Wald** - warme Grün- und Bernsteintöne, erdig.
- **Hoher Kontrast** - barrierefreiheit zuerst: Schwarz, Weiß und
  kräftige Signalfarben mit klaren Kartenrändern. Für maximale
  Lesbarkeit.
- **Sepia** - warme Papiertöne, angenehm beim langen Lesen.
- **Automatisch (System)** - folgt der Hell-/Dunkel-Einstellung deines
  Betriebssystems und wechselt automatisch mit.

Wähle ein Theme über seine Vorschaukarte; die Änderung greift sofort
ohne Neuladen und deine Wahl wird über Besuche hinweg gemerkt. Jedes
Theme erfüllt den WCAG-2.1-AA-Kontrast, sodass Text, Diagramme,
Plaketten und Übungs-Feedback überall lesbar bleiben.

## Oberfläche

Der **Gesten-Toggle** (seit v1.10.0, Standard EIN auf touch-fähigen
Geräten) umfasst Assessment-Swipe-Navigation,
Curriculum-Topic-Swipe-to-Reveal und Sitzungs-Zyklus-Peek. Ebenfalls
hier: Button-Tooltips und der Entwicklermodus.

## Gamification

Toggles für XP- / Badge- / Level-Up-Benachrichtigungen
(Aus stoppt Toasts, das System speichert den Zustand
trotzdem), **Wochenend-Modus** (Sa/So-Lücken in der
Streak-Heatmap überspringen), tägliches Sessions-Ziel
(1..10) und **Fortschritt zurücksetzen** (doppelte
Bestätigung; löscht `user_xp` + `user_badges` +
`user_streaks`-Zeilen).

## Über

Fünf Read-Only-Blöcke: **Version** (kanonische Version aus
`pyproject.toml`, Build-Hash, Build-Datum), **System**
(Speichermodus, Daten-Verzeichnis, DB-Pfad im Server-Modus,
Python + Plattform-Info), **Credits** (Autor, Abhängigkeits-
Danksagungen), **Entwicklung unterstützen** (Liberapay /
GitHub Sponsors / Ko-fi-Links), **Lizenz & Ressourcen**
(MIT-Link, Repo, Doku, Issue-Tracker).

Im Lokal-Modus blendet das Panel die Zeilen aus, die nur bei
laufendem Backend Sinn ergeben (Python-Version,
FastAPI / SQLAlchemy / Pydantic / PluginForge-Versionen,
DB-Pfad).
