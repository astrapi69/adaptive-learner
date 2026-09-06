# Einstellungen

Die Einstellungen-Seite sammelt alles, was du ohne Code- oder
YAML-Eingriff anpassen kannst. Sie ist als **Tab-Seite** aufgebaut:
Wähle einen Tab und sein Panel öffnet sich, du scrollst also nicht
eine lange Liste von oben nach unten. Die Tab-Gruppen sind:

- **Allgemein**: Profil (Anzeigename + Avatar), UI-Sprache,
  Darstellung / Theme und Oberflächen-Optionen (Gesten, Tooltips,
  Entwicklermodus).
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

## Profil

Unter *Allgemein > Profil* legst du deinen **Anzeigenamen** fest und
gestaltest deinen **Avatar**:

- **Bild hochladen** öffnet den Zuschnitt-Dialog; das Ergebnis
  erscheint oben rechts in der Navigation.
- **Oder wähle eine Figur**: acht vorgefertigte Figuren als
  Alternative zum eigenen Foto - ein Klick genügt. Ist gerade ein
  hochgeladenes Foto aktiv, fragt ein Dialog nach, bevor die Figur es
  ersetzt; das Foto wandert dabei in einen Zwischenspeicher und lässt
  sich über **Foto wiederherstellen** jederzeit zurückholen (bis ein
  neues Foto hochgeladen wird).
- **Avatar-Rahmen**: dekorative Ringe um den Avatar. Bronze, Silber
  und Gold schaltest du über dein Level frei, die Flamme über das
  3-Tage-Serien-Abzeichen; Stern und Akzent tauschst du gegen XP ein
  (zweistufige Bestätigung, die Kosten stehen auf dem Knopf).
  Gesperrte Rahmen zeigen ihre Bedingung an.

Auswahl und gekaufte Rahmen bleiben erhalten und wandern mit ins
[Backup](backup.md).

## Sprache

Tauscht jeden UI-String beim nächsten Render live aus via
`PATCH /api/settings/{user_id}`. Alle 11 Sprachen sind
First-Class - DE / EL / EN / ES / FR / HI / ID / JA / KO / PT /
TR - jede mit einem voll übersetzten Katalog. Über
`localStorage` persistent.

## KI-Anbieter + Modell-Picker

Das Anbieter-Dropdown schreibt `active_provider` in die
UserSettings; der nächste KI-Aufruf geht durch das Plugin des
neuen Anbieters (Server-Modus) oder den HTTP-Client des neuen
Anbieters (Lokal-Modus).

Der **Modell-Picker** ist ein durchsuchbares
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
das Aktiv-Anbieter-Badge - plus das neue **Quellen-
Attributions**-Badge:

- **Schlüssel aus: Einstellungen** - der Schlüssel ist
  Fernet-verschlüsselt in der DB gespeichert (Server-Modus)
  oder im Klartext in IndexedDB (Lokal-Modus). Speichern /
  Entfernen frei nutzbar.
- **Schlüssel aus: secrets.yaml** - der Schlüssel ist in
  `~/.config/adaptive-learner/secrets.yaml` konfiguriert. Der
  Speichern-Knopf ist deaktiviert; bearbeite die Datei direkt,
  um ihn zu ändern. Ein Info-Banner unter der Zeile erinnert
  an den Pfad.
- **Schlüssel aus: Umgebungsvariable** - der Schlüssel ist
  über die `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`-Umgebungs-
  variable gesetzt. Speichern deaktiviert; die Env-Variable
  ist die Quelle der Wahrheit.
- **Kein Schlüssel konfiguriert** - nichts ist irgendwo
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
**verschlüsselten Schlüssel-Export (`.alk`)** - hier im KI-Tab
findest du dazu einen **Verweis-Knopf**, der direkt zum Export im
**Daten-Tab** springt (siehe *Verschlüsselter Schlüssel-Export*
unter [Backup](#backup)).

## Konfigurierte Anbieter

Eine **Anbieter-Übersicht** listet die eingerichteten KI-Anbieter,
jeweils mit einer **maskierten Schlüssel-Vorschau**, sodass du auf
einen Blick siehst, welche Anbieter bereit sind. Jede Zeile hat
einen **Test-Knopf**, der den Modell-Listen-Endpunkt des Anbieters
aufruft und ok / ungültiger Schlüssel / Rate-Limit / Netzwerkfehler
meldet - ein sicherer Check, der keine Generierungs-Tokens
verbraucht.

## Speichermodus

Der Schalter zwischen **Server** und **Lokal (Browser)**:

- **Server** - jeder Lese- und Schreibvorgang geht ans
  FastAPI-Backend. Setzt ein laufendes Backend voraus. Am
  besten für Multi-Device-Nutzung mit Backend-seitigem Sync.
- **Lokal (Browser)** - jeder Lese- und Schreibvorgang geht
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

Das normale Backup entfernt deine API-Schlüssel - sicher, aber bei
einem Geräte- oder Browser-Wechsel müsstest du sonst jeden
Schlüssel von Hand neu eingeben. Der **verschlüsselte
Schlüssel-Export** schließt diese Lücke mit einer separaten,
passphrasen-geschützten Datei:

- Sie enthält **nur** die sensiblen Zugangsdaten - deine
  **API-Schlüssel** plus die Anbieter-Einstellungen (aktiver
  Anbieter, Modell-Overrides). NICHT den Rest deiner App-Daten (der
  bleibt im `.alb`-Backup).
- **Export** fragt nach einer Passphrase (plus Bestätigung) und
  lädt eine dedizierte **`.alk`**-Datei herunter. Die Schlüssel
  darin werden mit **AES-GCM-256** verschlüsselt, der Schlüssel
  dazu via **PBKDF2** aus deiner Passphrase abgeleitet - die Datei
  enthält nie einen Schlüssel im Klartext.
- **Import** liest eine `.alk`, fragt die Passphrase, entschlüsselt
  und schreibt die Schlüssel + Anbieter-Einstellungen in denselben
  sicheren Speicher wie die manuelle Eingabe (vorhandene Anbieter
  werden überschrieben, fehlende bleiben unangetastet).
- Eine **falsche Passphrase oder eine manipulierte Datei** wird
  sauber mit einer einzigen Meldung abgewiesen - **kein
  Teil-Import**, nichts wird halb geschrieben.
- Die Passphrase-Felder prüfen sich **direkt beim Tippen** - eine
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

### Aufräumen

Zwei Einstellungen zum Daten-Lebenszyklus liegen im Daten-Tab direkt
neben dem Speicher, den sie betreffen:

- **Maximale Lektionsgröße** (direkt unter *Offline-Cache*): Wird eine
  lange Chat-Analyse als Offline-Lektion gespeichert, werden Lektionen
  mit mehr als dieser Anzahl an Schritten in mehrere Teile aufgeteilt.
  *Schritte pro Teil* nimmt 5 bis 20 an; Standard ist 10.
- **Pausierte Lektionen aufbewahren** (direkt über der Bereinigung
  *Nicht verbundene Inhalte*, die nur erscheint, wenn es etwas zu
  bereinigen gibt): Pausierte Lektionen, die älter sind als dieser
  Zeitraum, werden beim nächsten Laden des Dashboards automatisch
  aufgegeben. Zur Wahl stehen 7, 14, 30 oder 60 Tage oder *Nie*;
  Standard sind 30 Tage. Bis zu 10 pausierte Lektionen bleiben
  unabhängig vom Alter erhalten.

Beide Werte werden in diesem Browser gespeichert und gelten im Server-
wie im Lokal-Modus.

## Sprachausgabe

Drei Toggles:

- **TTS aktiviert** - fügt einen ▶-Knopf neben KI-Antworten
  + Assessment-Ergebnissen ein, der sie laut vorliest. Wählt
  die sprach-passende Stimme, wenn verfügbar; Rate + Pitch
  auf [0,5; 2,0] geklemmt.
- **Auto-Wiedergabe KI** - spricht jede KI-Antwort
  automatisch (Standard AUS - überraschendes Audio ist
  selten, was man will).
- **STT aktiviert** - fügt einen 🎤-Knopf zum Sitzungs-
  Eingabefeld hinzu, der Sprache aufnimmt und das Textarea
  mit Zwischen-Transkripten füllt, bevor du absendest.
- **Aussprache-Übung aktiviert** - bringt die
  `/pronunciation`-Seite vom Dashboard-Quick-Start für
  Sprachen-getaggte Projekte zum Vorschein.

Die Karte **Sprachausgabe** liegt im **Lernen**-Tab im Bereich
*Vorlesen und Diktieren*. Unterstützt der Browser weder die
Web-Speech-API-Synthese noch die -Erkennung, fehlt der ganze Bereich
samt Überschrift.

## Darstellung

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

Ebenfalls in dieser Karte: die **Ansicht der Inhalte** - die globale
Einstellung *Liste / Kacheln* für den Content-Hub (Standard **Liste**).
Es ist dieselbe Einstellung wie der Ansicht-Umschalter in den Tabs
*Meine Inhalte* / *Entdecken*, eine Änderung an einer Stelle hält also
beide synchron. Direkt unter der Karte legst du die **Reihenfolge der
Inhalte-Tabs** (Entdecken / Meine Inhalte / Importieren) fest, sodass
der Hub auf dem von dir am häufigsten genutzten Tab öffnet.

## Oberfläche

Zwei Einstellungen: **Button-Tooltips anzeigen** (ein Hover-Tooltip auf
Icon-Buttons; Screenreader-Beschriftungen bleiben unabhängig davon an)
und die **Menüposition** auf dem Handy (oben als Menü-Button, der
Standard, oder unten als daumennahe Tab-Leiste). Wischgesten sind eine
Lektions-Einstellung und liegen unter *Lernen > In der Lektion >
Interaktion*.

Der **Entwicklermodus** (im Tab **Diagnose & Support**): sein Standard
hängt vom Build-Strang ab: Er
ist **standardmäßig EIN auf dem Latest-Strang (Vorschau)** und **AUS
auf Haupt**, damit Vorschau-Tester volle technische Fehlerdetails
sehen, während Produktionsnutzer freundliche Meldungen bekommen. Du
kannst ihn jederzeit umschalten.

## Lernen

Der **Lernen**-Tab gruppiert seine Karten in fünf beschriftete Bereiche,
in der Reihenfolge, in der eine Lektion abläuft. Jeder Bereich hat eine
kleine Überschrift und eine einzeilige Beschreibung; die Karten darin
behalten ihre eigenen Titel.

Eine **Bereichsleiste** über den Bereichen listet sie als Chips: ein Klick
springt zum jeweiligen Bereich. Am Desktop bleibt die Leiste beim Scrollen
unter der App-Kopfzeile sichtbar; am Handy scrollt sie mit der Seite, und
die Zeile lässt sich seitlich wischen. Die Leiste spiegelt die Adresse:
`/settings?tab=learning&section=review` öffnet den Tab gescrollt zu *Nach
der Lektion* (Kennungen: `basics`, `lessons`, `voice`, `review`,
`motivation`), und ein Klick auf einen Chip aktualisiert die Adresse, ohne
einen Verlaufseintrag anzulegen. Ein Wechsel in einen anderen Tab verwirft
den Bereich wieder. Ein nicht gerenderter Bereich (Vorlesen und Diktieren
in einem Browser ohne Web Speech) hat keinen Chip, eine unbekannte Kennung
wird ignoriert. Beim Scrollen folgt der hervorgehobene Chip dem Bereich,
der gerade im Bild ist.

### Grundlagen

Wer lernt, und in welchen Sprachen.

- **Lernprofil** - das Lernprofil hinter den Sechs-Methoden-Gewichten
  anlegen, fortsetzen oder neu durchlaufen.
- **Weitere Ausgangssprachen** - welche Ausgangssprachen der Inhaltsbaum
  neben deiner App-Sprache zeigt.

### In der Lektion

Wie sich Übungen beim Beantworten verhalten.

- **Lektionsmodus** - der **Standardmodus** (Üben / Prüfung / Auf Zeit),
  die **Bestehens-Grenze** der Prüfung und die
  **Zeitmodus-Schwierigkeit** (Schnell, Normal, Entspannt); siehe
  [Lektionen und Wiederholungen](lessons.md).
- **Tipps** - ob bei jeder Übung ein gestufter Tipp-Button erscheint,
  und die **XP-Kosten pro Tipp** (0 = kostenlos).
- **Interaktion** - **Wischgesten** (Wischen zum Navigieren in
  Assessment, Session und Curriculum; Standard EIN auf touch-fähigen
  Geräten), **Tastenkürzel in Lektionen** (Eingabetaste prüft die
  Antwort, erneut drücken geht weiter), **bei richtiger Antwort
  automatisch weiter** und ob der Button **KI fragen** angezeigt wird.
- **Bevorzugte Übungsrichtung** - in welcher Richtung Übungen mit
  Richtung starten.
- **Auflösungs-Effekt** - der Effekt, mit dem eine gelöste
  Zuordnungs-Übung aufgelöst wird.

### Vorlesen und Diktieren

Stimmen, Tempo, Mikrofon und Ausspracheübung.

- **Sprachausgabe** - die oben unter *Sprachausgabe* beschriebenen
  Schalter: Vorlesen, Auto-Wiedergabe, Spracherkennung und
  Aussprache-Übung.

Dieser Bereich erscheint nur, wenn der Browser mindestens eine Seite der
Web Speech API unterstützt (Synthese oder Erkennung). Sonst fehlt er
samt Überschrift, und *Nach der Lektion* folgt direkt auf *In der
Lektion*.

### Nach der Lektion

Wiederholungen, die Zusammenfassung und das Nachholen von Fehlern.

- **Wiederholung** - die automatisch erzeugten Fehler-Erklärungen und
  die Zahl der Fragen pro Wiederholungs-Sitzung. Die Karte endet mit dem
  schreibgeschützten Block **Verteilte Wiederholung**: der Intervall-Plan
  (richtige Antworten in Folge gegen die Tage bis zur nächsten
  Wiederholung), ab wann ein Element als beherrscht gilt, und ein Link
  zur Lernmethode.
- **Zusammenfassung nach Lektionen** - welche Abschnitte die
  Zusammenfassung am Lektionsende zeigt, und in welcher Reihenfolge.
- **Fehler wiederholen** - welche Fehler die Nachhol-Runde aufgreift.

### Motivation und Routine

Spielmodus, Feedback, tägliche Missionen und Erinnerungen.

- **Spielmodus** - spielerische Lektionen, samt **Maskottchen-Variante**,
  den Farbwelten des Lernfunke, die du über Level und Abzeichen
  freischaltest oder gegen XP eintauschst (gesperrte Varianten zeigen
  ihre Bedingung, Käufe fragen zweistufig nach). Was der Spielmodus im
  Einzelnen ändert, steht unter [Lob und Belohnungen](celebrations.md).
- **Feedback** - Feedback-Intensität und Töne (Lautstärke, Test-Knopf).
- **Tägliche Missionen** - ob Missionen laufen, wie viele pro Tag, die
  Schwierigkeits-Mischung und das Neumischen der heutigen Missionen.
- **Erinnerungen** - die Erinnerungszeit und die Tage, an denen sie gilt.
- **Gamification** - XP- und Abzeichen-Toasts, Wochenend-Modus, das
  tägliche Sessions-Ziel und *Fortschritt zurücksetzen*; die letzte
  Karte, siehe unten.

Die Spielmodus-Karte zeigt den Hauptschalter, die Spielmodus-Sounds und
eine Statuszeile, wie viele der Extras an sind. **Details zum Spielmodus**
(Herzen, Countdown, Arcade, Sonderrunden, Tickets, Bonus-Lektionen,
Serien-XP und Maskottchen) ist eingeklappt und merkt sich deine Wahl;
solange **Spielerische Lektionen** aus ist, sind die Optionen darin
ausgegraut.

Der Tab endet mit **Gamification** (unter einer Trennlinie, weil diese
Karte *Fortschritt zurücksetzen* enthält). Die beiden Aufräum-Einstellungen -
*Pausierte Lektionen aufbewahren* und *Maximale Lektionsgröße* -
betreffen den Daten-Lebenszyklus und liegen im **Daten**-Tab (siehe
*Aufräumen* unter Backup).

Die **Ansicht der Inhalte** (Liste / Kacheln) und die **Reihenfolge der
Inhalte-Tabs** liegen im **Allgemein**-Tab unter *Darstellung*.

### Gamification

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

- **Haupt** - die stabile Production-Seite
  (`https://astrapi69.github.io/adaptive-learner/`). Als dezentes
  Badge dargestellt, ohne Warnoptik.
- **Latest** - die Preview-/Staging-Seite, gebaut aus `develop`
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
PNG-Laden- / Nativ-Teilen-Aktionen - praktisch, um die App aufs
Handy zu bringen.

Bist du auf dem **Latest**-Strang, bietet das Teilen die
Preview-URL **nur als Link an - keinen QR-Code** - zusammen mit
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
