# Einstellungen

Die Einstellungen-Seite sammelt alles, was du ohne Code- oder
YAML-Eingriff anpassen kannst. Sie ist als **Tab-Seite** aufgebaut:
Wähle einen Tab und sein Panel öffnet sich, du scrollst also nicht
eine lange Liste von oben nach unten. Auf einem breiten Bildschirm
stehen die Tabs in einer Seitenleiste links; am Handy öffnest du sie
über einen Menü-Knopf über dem Panel. Die Adresse nennt den offenen
Tab (`/settings?tab=data`), sodass ein Link oder ein Neuladen auf
demselben Tab landet; ohne Angabe öffnet die Seite **Allgemein**.

Die Tabs sind in vier Gruppen sortiert:

- **Allgemein**
    - **Allgemein**: Profil (Anzeigename, Avatar, Avatar-Rahmen),
      Darstellung (Theme, Ansicht der Inhalte, Reihenfolge der
      Inhalte-Tabs), Anzeigesprache, Oberfläche (Button-Tooltips,
      Menüposition am Handy), Speichermodus, Update-Einstellungen,
      App-Installation und die Modus-Anzeige.
- **Lernen & KI**
    - **Lernen**: wie Lektionen sich verhalten, in fünf Bereichen vom
      Lernprofil bis zu Motivation und Routine, samt Sprachausgabe und
      Gamification.
    - **KI**: Anbieter- + Modell-Picker, API-Schlüssel pro Anbieter mit
      Quellen-Attribution und die Anbieter-Übersicht.
    - **Plugins**: die installierten Plugins und die Einstellungen des
      Lern-Repositorys.
- **Daten & Integrationen**
    - **Daten**: Inhaltsquellen, Synchronisation, Offline-Inhalte,
      Sichern und Exportieren (samt verschlüsseltem Schlüssel-Export),
      Aufräumen und die Gefahrenzone, mit einer Bereichsleiste oben.
    - **Integrationen**: die GitHub-Integration (der Token, mit dem du
      Lektionen als Pull Request teilst).
- **Info**
    - **Hilfe**: das durchsuchbare integrierte Glossar.
    - **Diagnose & Support**: der Fehlerbericht, der Entwicklermodus
      und die Tipp- und Viewport-Sonde.
    - **Über**: Version, Systeminfo, Credits, App teilen, Spenden,
      Lizenz.

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
[Backup](../features/backup.md).

## Darstellung

Der **Farbschema**-Picker unter *Allgemein > Darstellung* ordnet die
Themes in zwei Tabs:

- **Empfohlen** - Catppuccin Latte, Supabase und Graphite (hell),
  Catppuccin Mocha, **Soft Pop** und Amethyst Haze (dunkel). Neue
  Nutzer starten mit **Soft Pop**, und der Picker öffnet auf diesem
  Tab.
- **Klassisch** - die ursprünglichen Themes: Hell, Dunkel, Ozean,
  Wald, Hoher Kontrast (Schwarz, Weiß und kräftige Signalfarben mit
  klaren Kartenrändern, für maximale Lesbarkeit) und Sepia (warme
  Papiertöne für langes Lesen). Ist dein aktives Theme ein
  klassisches, öffnet der Picker stattdessen auf diesem Tab.

Beide Tabs bieten außerdem **Automatisch (System)**, das der
Hell-/Dunkel-Einstellung deines Betriebssystems folgt und automatisch
mitwechselt.

Wähle ein Theme über seine Vorschaukarte; die Änderung greift sofort
ohne Neuladen und deine Wahl wird über Besuche hinweg gemerkt. Jedes
Theme erfüllt den WCAG-2.1-AA-Kontrast, sodass Text, Diagramme,
Plaketten und Übungs-Feedback überall lesbar bleiben.

Ebenfalls in dieser Karte: die **Ansicht der Inhalte** - die globale
Einstellung *Liste / Kacheln* für den Content-Hub (Standard **Liste**).
Es ist dieselbe Einstellung wie der Ansicht-Umschalter in den Tabs
*Meine Inhalte* / *Entdecken*, eine Änderung an einer Stelle hält also
beide synchron. Direkt unter der Karte legst du die **Reihenfolge der
Inhalte-Tabs** (Entdecken / Meine Inhalte / Importieren /
Erstellen) fest, sodass
der Hub auf dem von dir am häufigsten genutzten Tab öffnet.

## Sprache

*Allgemein > Sprache* tauscht jeden UI-String beim nächsten Render
live aus via `PATCH /api/settings/{user_id}`. Alle 11 Sprachen sind
First-Class - DE / EL / EN / ES / FR / HI / ID / JA / KO / PT /
TR - jede mit einem voll übersetzten Katalog. Über
`localStorage` persistent.

## Oberfläche

*Allgemein > Oberfläche* hat zwei Einstellungen: **Button-Tooltips
anzeigen** (ein Hover-Tooltip auf Icon-Buttons;
Screenreader-Beschriftungen bleiben unabhängig davon an) und die
**Menüposition** auf dem Handy (oben als Menü-Button, der Standard,
oder unten als daumennahe Tab-Leiste). Wischgesten sind eine
Lektions-Einstellung und liegen unter *Lernen > In der Lektion >
Interaktion*. Der Entwicklermodus liegt im Tab **Diagnose & Support**
(siehe unten).

## Speichermodus

*Allgemein > Speicher-Modus* schaltet zwischen **Server** und
**Lokal (Browser)** um:

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

Die öffentliche Web-Version und die installierte Web-App haben kein
Backend; dort fehlt die Karte, und die App nutzt immer Lokal (Browser).

## Updates und App-Installation

Der Rest des Tabs **Allgemein** betrifft, wie die App läuft:

- **Updates** (nur im Server-Modus): **Automatische Update-Prüfung**
  und das **Prüfintervall** (täglich, wöchentlich, monatlich oder nie),
  dazu der Zeitpunkt der letzten Prüfung und die aktuelle Version. Den
  Knopf **Auf Updates prüfen** findest du im Tab **Über**.
- **App installieren**: installiert Adaptive Learner als eigenständige
  App (eigenes Fenster, Symbol auf dem Startbildschirm, Start auch ohne
  Netz). Nach der Installation zeigt der Knopf **Bereits installiert**.
- **Modus**: Der Solo-Modus ist aktiv; der Mehrspieler-Modus ist als
  „Kommt bald" markiert.

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
- **Zuordnungsübung** - **Korrektur als eigene Ansicht** (Standard AN):
  nach dem Prüfen zeigt "Meine Antworten" nur deine eigenen Paare mit den
  Fehlern, die richtigen Antworten stehen unter "Korrektur", die Lösung
  unter "Auflösen". Aus: die richtige Antwort steht direkt unter jedem
  Fehler in "Meine Antworten". Dazu der **Auflösungs-Effekt**, mit dem
  eine gelöste Zuordnungs-Übung aufgelöst wird.

### Vorlesen und Diktieren

Stimmen, Tempo, Mikrofon und Ausspracheübung. Der Bereich enthält die
Karte **Sprachausgabe**:

- **Sprechschaltflächen anzeigen** - fügt neben KI-Antworten und
  Assessment-Ergebnissen einen Lautsprecher-Knopf ein, der sie
  vorliest.
- **KI-Antworten automatisch vorlesen** - spricht jede KI-Antwort
  automatisch (Standard AUS - überraschendes Audio ist selten, was man
  will).
- **Stimme** - die Vorlese-Stimme; der Standard wählt die beste
  Übereinstimmung für deine Projektsprache.
- **Tempo** und **Tonhöhe** - Schieberegler von 0,5 bis 2.
- **Mikrofon-Schaltfläche anzeigen** - fügt dem Sitzungs-Eingabefeld
  einen Mikrofon-Knopf hinzu, der Sprache aufnimmt und das Textfeld mit
  Zwischen-Transkripten füllt, bevor du absendest.
- **Diktiersprache überschreiben** - ein BCP-47-Code (zum Beispiel
  `de-DE`); leer lassen, um die Projekt- oder UI-Sprache zu nutzen.
- **Aussprachetraining** - zeigt einen Knopf *Aussprachetraining* auf
  den Dashboards von Sprach-Lernprojekten.

Die Vorlese-Einstellungen (die ersten fünf) erscheinen nur, wenn der
Browser Sprachsynthese unterstützt, die beiden Diktier-Einstellungen
nur, wenn er Spracherkennung unterstützt. Unterstützt der Browser
keine der beiden Seiten der Web Speech API, fehlt der ganze Bereich
samt Überschrift, und *Nach der Lektion* folgt direkt auf *In der
Lektion*.

### Nach der Lektion

Wiederholungen, die Zusammenfassung und das Nachholen von Fehlern.

- **Wiederholung** - Erklärungen nach der Antwort (die vom Autor der
  Übung geschriebene Erklärung, die nach dem Prüfen unter der Übung
  erscheint, und die automatisch erzeugten Regeltipps nach einer Lektion)
  sowie die Zahl der Fragen pro Wiederholungs-Sitzung. Der Schalter "Auch
  fehlerfreie Elemente wiederholen" (standardmäßig aus) entscheidet, ob die
  Wiederholung nur Elemente mit Fehlern enthält oder auch nie falsch
  beantwortete Elemente nach 3 und 7 Tagen zurückholt. Die Karte endet mit dem
  schreibgeschützten Block **Verteilte Wiederholung**: der Intervall-Plan
  (richtige Antworten in Folge gegen die Tage bis zur nächsten
  Wiederholung), ab wann ein Element als beherrscht gilt, und ein Link
  zur Lernmethode.
- **Zusammenfassung nach Lektionen** - welche Abschnitte die
  Zusammenfassung am Lektionsende zeigt, und in welcher Reihenfolge.
  Voreingestellt sind nur *Ergebnis und Statistik* und *XP-Belohnung*,
  die kompakte Fassung, die am Telefon auf einen Bildschirm passt; alles
  Weitere zeigt der Knopf *Ausführliche Auswertung* am Lektionsende, oder
  du hakst es hier dauerhaft an. *Warum du diese verpasst hast* ist einer
  dieser Abschnitte; sein Hauptschalter bleibt *Erklärungen nach der
  Antwort* unter *Wiederholung*.
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
*Pausierte Lektionen auf dem Dashboard* und *Maximale Lektionsgröße* -
betreffen den Daten-Lebenszyklus und liegen im **Daten**-Tab (siehe
*Offline-Inhalte* und *Aufräumen* unter Daten).

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

## KI-Anbieter + Modell-Picker

Im Tab **KI** schreibt das Anbieter-Dropdown `active_provider` in die
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

- **Schlüssel aus: secrets.yaml** - der Schlüssel liegt
  Fernet-verschlüsselt in `~/.config/adaptive_learner/secrets.yaml`.
  Dort speichert der Server-Modus jeden Schlüssel, den du hier
  eingibst; nach dem Speichern zeigt die Zeile also dieses
  Badge. Speichern und Entfernen bleiben verfügbar; Speichern
  überschreibt den abgelegten Schlüssel. Eine Info-Zeile unter
  der Zeile nennt den Pfad.
- **Schlüssel aus: Einstellungen** - ein älterer Schlüssel, der
  noch aus der Zeit vor dem Umzug nach `secrets.yaml` in der
  Datenbank liegt; er wird beim nächsten Start dorthin
  verschoben. Im Lokal-Modus (Browser) liegt der Schlüssel in
  IndexedDB und zeigt ebenfalls dieses Badge. Speichern /
  Entfernen frei nutzbar.
- **Schlüssel aus: Umgebungsvariable** - der Schlüssel ist
  über die `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`-Umgebungs-
  variable gesetzt. Speichern und Entfernen sind deaktiviert;
  die Env-Variable ist die Quelle der Wahrheit.
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
unter *Sichern und Exportieren*).

## Konfigurierte Anbieter

Eine **Anbieter-Übersicht** listet die eingerichteten KI-Anbieter,
jeweils mit einer **maskierten Schlüssel-Vorschau**, sodass du auf
einen Blick siehst, welche Anbieter bereit sind. Jede Zeile hat
einen **Test-Knopf**, der den Modell-Listen-Endpunkt des Anbieters
aufruft und ok / ungültiger Schlüssel / Rate-Limit / Netzwerkfehler
meldet - ein sicherer Check, der keine Generierungs-Tokens
verbraucht.

## Plugins

Der Tab **Plugins** hat zwei Karten. **Installierte Plugins** listet
jedes Plugin, das die Desktop-App geladen hat: Name, Version, Quelle
(Paket oder direkt registriert) und Aktivierungszeitpunkt. Ein
Ladefehler oder ein Discovery-Filter steht als Markierung in der Zeile,
ebenso eine Konfigurationsänderung nach der Aktivierung. Im
Browser-Modus bleibt die Karte sichtbar mit dem Hinweis, dass nur die
Desktop-App einen Plugin-Host hat. **Lern-Repository** hält die
Einstellungen des gleichnamigen Plugins (Git-Persistenz,
Repository-Verzeichnis).

## Daten

Der Tab **Daten** gruppiert seine Karten in sechs Bereiche, in fester
Reihenfolge: woher Inhalte kommen, was mit ihnen geschieht, was daraus
entsteht, wie du es sicherst, was du aufräumen kannst, und zuletzt, was
sich nicht rückgängig machen lässt. Jeder Bereich hat eine kleine
Überschrift und eine einzeilige Beschreibung.

Eine **Bereichsleiste** über den Bereichen listet sie als Chips:
*Quellen*, *Synchronisation*, *Offline-Inhalte*, *Sichern und
Exportieren*, *Aufräumen* und *Gefahrenzone*. Sie funktioniert wie die
im Lernen-Tab: ein Klick springt zum Bereich, am Desktop bleibt die
Leiste unter der App-Kopfzeile sichtbar, der hervorgehobene Chip folgt
dem Bereich im Bild, und die Adresse spiegelt ihn
(`/settings?tab=data&section=backup`; Kennungen: `sources`, `sync`,
`offline`, `backup`, `cleanup`, `danger`).

### Quellen

- **Inhalts-Repositories** - die Repositories, aus denen deine
  Lektionen kommen; siehe
  [Content-Repositories](../features/content-repos.md).
- **Eigenes Repository registrieren** - schlägt dein eigenes
  Inhalts-Repository für das gemeinsame Verzeichnis vor, das die
  repository-übergreifende Suche nutzt.

### Synchronisation

Kopple dieses Gerät mit einem anderen über dein lokales Netz
per QR-Code-Scanner (Rückkamera) oder eingefügte Pairing-
URL. Nach dem Pairing tauschen Push- + Pull-Knöpfe Daten
bidirektional aus. Konflikte gehen durch einen KI-Merge-
Resolver auf dem Backend.

Eingeschränkter-Browser-Fallback: Lade einen Screenshot des
QR-Codes vom anderen Gerät hoch (`Html5Qrcode.scanFile`).

Die Synchronisation braucht die Desktop-App. Im Browser-Modus bleibt
der Bereich sichtbar, aber statt der Bedienelemente steht dort der
Hinweis „Nur mit der Desktop-App verfügbar."

### Offline-Inhalte

- **Offline-Cache** - Größe und Lektionszahl des Offline-Lektionscaches,
  mit einem Knopf, der ihn leert (mit Rückfrage).
- **Maximale Lektionsgröße** - wird eine lange Chat-Analyse als
  Offline-Lektion gespeichert, werden Lektionen mit mehr als dieser
  Anzahl an Schritten in mehrere Teile aufgeteilt. *Schritte pro Teil*
  nimmt 5 bis 20 an; Standard ist 10.

### Sichern und Exportieren

Die **Datensicherung** bietet drei Dinge: **Sicherung erstellen**
(lädt eine `.alb`-Sicherungsdatei herunter), **Aus Sicherung
wiederherstellen** (Wiederherstellen aus Datei) und **Vergleich**
(Side-by-Side-Diff gegen aktuellen Zustand). API-Schlüssel werden aus
jedem Export entfernt.

Restore ist ein MERGE, kein Overwrite: neue Zeilen fügen
ein, mutable Zeilen aktualisieren bei neuerem `updated_at`,
History-Zeilen (Sessions / Commits / Ratings) deduplizieren
über UUID. Die Vergleichs-Vorschau zeigt pro Tabelle
hinzugefügt / entfernt / geändert, bevor du auf
Wiederherstellen klickst; das Knopf-Label liest dann
„Wiederherstellen (N hinzugefügt, M aktualisiert)".

Im Lokal-Modus zeigt die Karte zusätzlich den
**Auto-Backup**-Block: ein rollender Ring aus 3 Snapshots in
einer separaten IndexedDB-DB, läuft alle 10 Sessions ODER
alle 7 Tage (je nachdem, was zuerst eintritt). Jeder Snapshot
hat eigene Wiederherstellen- + Löschen- + Vergleich-als-A/B-
Knöpfe.

Weitere Karten in diesem Bereich:

- **Identitätsdatei** (nur im Server-Modus) - eine schreibgeschützte
  Ansicht der Wiederherstellungsdatei, die das Backend führt, damit du
  siehst, ob es sie gibt und wo sie liegt.
- **Verschlüsselter Schlüssel-Export** - siehe unten.
- **Daten-Export** - eine vollständige Sicherung mit einem Klick oder
  ein selektiver Export, bei dem du die gewünschten Datenkategorien
  ankreuzt; beide erzeugen dieselbe importierbare Sicherungsdatei.
- **Export** - drei Berichte: *Lernfortschritt*, *Sitzungs-Detail* und
  *Lehrplan*, jeweils als Markdown oder als PDF (über den
  Druckdialog des Browsers).

#### Verschlüsselter Schlüssel-Export (.alk)

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

- **Pausierte Lektionen auf dem Dashboard**: Die Karte der pausierten
  Lektionen auf dem Dashboard zeigt nur Lektionen, die innerhalb dieses
  Zeitraums pausiert wurden (*Pausierte Lektionen ausblenden, wenn älter
  als* 7, 14, 30 oder 60 Tage oder *Nie*; Standard sind 30 Tage). Eine
  ältere Lektion verschwindet nur aus der Karte: Es wird nichts
  aufgegeben, Position und Antworten bleiben erhalten. Die Karte zeigt
  die fünf zuletzt pausierten Lektionen.
- **Nicht verbundene Inhalte** (Browser-Modus): Fortschritt, dessen
  Inhalts-Repository nicht mehr verbunden ist, bleibt ausgeblendet, bis
  du ihn hier löschst. Die Karte erscheint nur, wenn es etwas zu
  bereinigen gibt.

*Maximale Lektionsgröße* und *Pausierte Lektionen auf dem Dashboard* werden
in diesem Browser gespeichert und gelten im Server- wie im Lokal-Modus.

### Gefahrenzone

Der letzte Bereich, optisch abgesetzt: **Alles zurücksetzen** löscht
alle deine Daten (im Server-Modus im Backend, im Browser-Modus in
diesem Browser). Es bietet zuerst eine Sicherung an, fragt dann nach
einer Bestätigung, und der letzte Knopf **Endgültig löschen** wird erst
frei, wenn du `RESET` eintippst.

## Integrationen

Der Tab **Integrationen** enthält die **GitHub-Integration**: einen
GitHub-Token (mit der Berechtigung `repo`), mit dem die App Lektionen
als Pull Request teilen kann. Das Token-Feld prüft das Format schon beim
Tippen, **Testen** prüft den Token und zeigt das Konto, zu dem er gehört,
und eine Quellen-Zeile sagt dir, wo der Token liegt (secrets.yaml, eine
Umgebungsvariable oder dieser Browser), mit **Entfernen** zum Löschen.
Ein Token aus einer Umgebungsvariable lässt sich hier nicht bearbeiten.

## Hilfe

Der Tab **Hilfe** enthält das integrierte Glossar: ein Suchfeld filtert
die Einträge nach Titel und Text, und die Einträge sind gruppiert in
*Kernkonzepte*, *Lernmethoden*, *Zyklusschritte* und *App-Features*.
Ein Klick auf einen Eintrag öffnet den vollständigen Artikel in der
Hilfe-Leiste.

## Diagnose & Support

Der Tab **Diagnose & Support** bündelt, was der Entwicklung hilft zu
sehen, was auf deinem Gerät passiert ist:

- **Support** - **Fehlerbericht erstellen** sammelt deine letzten
  Aktionen in einem Bericht, den du prüfst, bevor irgendetwas deinen
  Browser verlässt.
- **Entwicklermodus** - zeigt in Fehler-Toasts die vollen technischen
  Details (Statuscode, Endpunkt, Stacktrace) und, solange er an ist,
  ein „DEV"-Abzeichen in der Navigationsleiste. Sein Standard hängt vom
  Build-Strang ab: Er ist **standardmäßig EIN auf dem Latest-Strang
  (Vorschau)** und **AUS auf Haupt**, damit Vorschau-Tester volle
  technische Fehlerdetails sehen, während Produktionsnutzer freundliche
  Meldungen bekommen. Du kannst ihn jederzeit umschalten.
- **Tipp- und Viewport-Sonde** - zeichnet, solange sie an ist,
  Tipp-Positionen und Viewport-Änderungen in einem dauerhaften
  Protokoll auf, um schwer reproduzierbare Darstellungsfehler
  einzugrenzen. **Mess-Leiste anzeigen** blendet die Leiste oben ein
  oder aus, während die Aufzeichnung weiterläuft; **Sticky-Knopf für
  die Mess-Leiste** fügt einen schwebenden Knopf hinzu (mit wählbarer
  Ecke), der die Leiste umschaltet. **Protokoll kopieren** und
  **Protokoll leeren** wirken auf die aufgezeichneten Ereignisse, ein
  Zähler zeigt, wie viele es sind.

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
Über-Tab sagt dir, auf welchem du bist:

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

### Auf Updates prüfen

Ein Knopf **Auf Updates prüfen** im Versions-Block vergleicht deine
Version mit dem neuesten GitHub-Release. Der Desktop-Build führt
zusätzlich eine **Auto-Update-Prüfung** über die GitHub-Releases-API
durch und meldet, wenn eine neuere Version verfügbar ist; ihr Intervall
stellst du im Tab **Allgemein** unter *Updates* ein. Nach einem
PWA-Update bleibt das „Neue Version verfügbar"-Banner verschwunden,
sobald du es akzeptierst (es taucht nicht bei jedem Reload wieder
auf).
