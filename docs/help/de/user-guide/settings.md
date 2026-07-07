# Einstellungen

Die Einstellungen-Seite sammelt alles, was du ohne Code- oder
YAML-Eingriff anpassen kannst. Sie ist als **Tab-Seite** aufgebaut:
Wähle einen Tab und sein Panel öffnet sich, du scrollst also nicht
eine lange Liste von oben nach unten. Die Tab-Gruppen sind:

- **Allgemein**: UI-Sprache, Darstellung / Theme und
  Oberflächen-Optionen (Gesten, Tooltips, Entwicklermodus).
- **KI**: Anbieter- + Modell-Picker, API-Schlüssel pro Anbieter mit
  Quellen-Attribution und die Anbieter-Übersicht.
- **Lernen**: wie Lektionen ablaufen (Standardmodus,
  Bestehensschwelle, Zeit-Schwierigkeit, Hinweise, Erinnerungen,
  Enter-Kürzel, Übungsrichtung), die Inhalts-Ansicht und die
  Reihenfolge der Inhalte-Tabs.
- **Daten**: Speichermodus, Sync, Backup (Export / Import /
  Vergleich) und der verschlüsselte Schlüssel-Export.
- **Stimme**: TTS- / STT- / Aussprache-Toggles.
- **Gamification**: XP- / Abzeichen-Benachrichtigungen,
  Wochenend-Modus, Tagesziel und Fortschritt zurücksetzen.
- **Über**: Version, Systeminfo, Credits, Spenden, Lizenz.

## Sprache

Tauscht jeden UI-String beim nächsten Render live aus via
`PATCH /api/settings/{user_id}`. Alle 11 Sprachen sind
First-Class — DE / EL / EN / ES / FR / HI / ID / JA / KO / PT /
TR — jede mit einem voll übersetzten Katalog. Über
`localStorage` persistent.

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

## API-Schlüssel

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

Schlüssel-Eingaben nutzen ein maskiertes **Secret-Eingabefeld**
(mit Anzeigen/Verbergen-Umschalter) und lösen den Passwort-Manager
des Browsers nicht aus.

API-Schlüssel sind aus dem normalen Backup (`.alb`) bewusst
**ausgeschlossen**. Um deine Schlüssel auf ein anderes Gerät oder
einen anderen Browser zu übertragen, nutze den dedizierten
**verschlüsselten Schlüssel-Export (`.alk`)** — hier im KI-Tab
findest du dazu einen **Verweis-Knopf**, der direkt zum Export im
**Daten-Tab** springt (siehe *Verschlüsselter Schlüssel-Export*
unter [Backup](#backup)).

## Konfigurierte Anbieter

Eine **Anbieter-Übersicht** listet die eingerichteten KI-Anbieter,
jeweils mit einer **maskierten Schlüssel-Vorschau**, sodass du auf
einen Blick siehst, welche Anbieter bereit sind. Jede Zeile hat
einen **Test-Knopf**, der den Modell-Listen-Endpunkt des Anbieters
aufruft und ok / ungültiger Schlüssel / Rate-Limit / Netzwerkfehler
meldet — ein sicherer Check, der keine Generierungs-Tokens
verbraucht.

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

### Verschlüsselter Schlüssel-Export (.alk)

Das normale Backup entfernt deine API-Schlüssel — sicher, aber bei
einem Geräte- oder Browser-Wechsel müsstest du sonst jeden
Schlüssel von Hand neu eingeben. Der **verschlüsselte
Schlüssel-Export** schließt diese Lücke mit einer separaten,
passphrasen-geschützten Datei:

- Sie enthält **nur** die sensiblen Zugangsdaten — deine
  **API-Schlüssel** plus die Anbieter-Einstellungen (aktiver
  Anbieter, Modell-Overrides). NICHT den Rest deiner App-Daten (der
  bleibt im `.alb`-Backup).
- **Export** fragt nach einer Passphrase (plus Bestätigung) und
  lädt eine dedizierte **`.alk`**-Datei herunter. Die Schlüssel
  darin werden mit **AES-GCM-256** verschlüsselt, der Schlüssel
  dazu via **PBKDF2** aus deiner Passphrase abgeleitet — die Datei
  enthält nie einen Schlüssel im Klartext.
- **Import** liest eine `.alk`, fragt die Passphrase, entschlüsselt
  und schreibt die Schlüssel + Anbieter-Einstellungen in denselben
  sicheren Speicher wie die manuelle Eingabe (vorhandene Anbieter
  werden überschrieben, fehlende bleiben unangetastet).
- Eine **falsche Passphrase oder eine manipulierte Datei** wird
  sauber mit einer einzigen Meldung abgewiesen — **kein
  Teil-Import**, nichts wird halb geschrieben.
- Die Passphrase-Felder prüfen sich **direkt beim Tippen** — eine
  zu kurze Passphrase oder eine nicht passende Bestätigung wird
  gleich am Feld angezeigt (und der Absende-Knopf bleibt
  deaktiviert) statt nach dem Klick als Fehler-Toast. Wie die
  API-Schlüssel-Felder lösen diese Passphrase-Felder **nicht** den
  Passwort-Manager des Browsers aus.

Dieser Export lebt im **Daten-Tab**, neben dem normalen Backup; der
**KI-Tab** trägt nur einen Verweis-Knopf, der hierher führt. Im
**Lokal-Modus (Browser)** liegen die Schlüssel in IndexedDB, der
Export ist also voll verfügbar (und der Hauptanwendungsfall). Im
**Server-Modus** liegen die Schlüssel serverseitig und der Client
sieht den Klartext nie, daher ist der Eintrag **deaktiviert mit
einem Hinweis**. Der Export ist außerdem deaktiviert, solange kein
exportierbarer Schlüssel konfiguriert ist.

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

Der Standard des **Entwicklermodus** hängt vom Build-Strang ab: Er
ist **standardmäßig EIN auf dem Latest-Strang (Vorschau)** und **AUS
auf Haupt**, damit Vorschau-Tester volle technische Fehlerdetails
sehen, während Produktionsnutzer freundliche Meldungen bekommen. Du
kannst ihn jederzeit umschalten.

## Lernen

Der **Lernen**-Tab bündelt, wie Lektionen ablaufen: den
**Standard-Lernmodus** (Üben / Prüfung / Auf Zeit / Reverse / Zufall
/ Endlos), die Bestehensschwelle der Prüfung, die Zeit-Schwierigkeit
(siehe [Lektionen und Wiederholungen](lessons.md)), Hinweise,
Erinnerungen, das Enter-Tastenkürzel, die bevorzugte Übungsrichtung
und die im Inhaltsbaum gezeigten Quellsprachen.

Hier liegt auch die **Inhalts-Ansicht** — die globale Einstellung
*Liste ⇄ Kacheln* für den Content-Hub (Standard **Liste**). Es ist
dieselbe Einstellung wie der Ansicht-Umschalter in den Tabs *Meine
Inhalte* / *Entdecken*, eine Änderung an einer Stelle hält also
beide synchron.

Außerdem lässt sich hier die **Reihenfolge der Inhalte-Tabs**
(Entdecken / Meine Inhalte / Importieren) festlegen, sodass der Hub
auf dem von dir am häufigsten genutzten Tab öffnet.

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

### Build-Strang: Haupt vs. Latest

Adaptive Learner läuft auf zwei Deployment-Strängen, und der
Über-Tab sagt dir jetzt, auf welchem du bist:

- **Haupt** — die stabile Production-Seite
  (`https://astrapi69.github.io/adaptive-learner/`). Als dezentes
  Badge dargestellt, ohne Warnoptik.
- **Latest** — die Preview-/Staging-Seite, gebaut aus `develop`
  (`https://astrapi69.github.io/adaptive-learner-content-test/`).
  Als deutliches **Testversion**-Badge dargestellt, damit du weißt,
  dass sie Fehler enthalten kann.

Das Badge zeigt den Strang zusammen mit dem Branch und dem kurzen
Commit-Hash. Es speist sich aus der zur Build-Zeit eingebackenen
Build-Info; eine URL-Heuristik ist nur ein klar markierter
Fallback, und fehlende Info liest sich als „unbekannt" statt zu
raten.

### App teilen

Der Über-Tab hat einen **App teilen**-Eintrag, der einen scannbaren
**QR-Code** der öffentlichen App-URL zeigt, mit Kopieren- /
PNG-Laden- / Nativ-Teilen-Aktionen — praktisch, um die App aufs
Handy zu bringen.

Bist du auf dem **Latest**-Strang, bietet das Teilen die
Preview-URL **nur als Link an — keinen QR-Code** — zusammen mit
einer Instabilitäts-Warnung, damit ein gescannter Code niemand
unbemerkt auf die instabile Testversion schicken kann. Auf
**Haupt** funktioniert das Teilen wie bisher mit QR-Code für die
Production-URL.

### Nach Updates suchen

Ein **Nach Updates suchen**-Knopf vergleicht deine Version mit dem
neuesten GitHub-Release. Der Desktop-Build führt zusätzlich eine
**Auto-Update-Prüfung** über die GitHub-Releases-API durch und
meldet, wenn eine neuere Version verfügbar ist. Nach einem
PWA-Update bleibt das „Neue Version verfügbar"-Banner verschwunden,
sobald du es akzeptierst (es taucht nicht bei jedem Reload wieder
auf).
