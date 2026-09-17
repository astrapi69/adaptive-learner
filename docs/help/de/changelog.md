# Was ist neu (v1.61 – v2.15)

Ein nutzerorientierter Überblick über die Releases seit v1.61.0.
Die vollständigen, technischen Notizen pro Version stehen unter
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v2.15.0 - Tiefere Übungen, kompakte Lektionsauswertung

- **Parametrische Übungen**: Eine Lektion kann Variablen festlegen, deren
  Werte bei jedem Versuch neu gezogen werden; Zahlenantworten werden mit
  einer Toleranz bewertet.
- **Drei neue Übungstypen**: Hotspot, Parsons und Sortieren, alle im
  Lektions-Editor erstellbar.
- **Erklärungen nach der Antwort**; wer eine Lektion aus Text erstellt, kann
  sie von der KI schreiben lassen.
- **Kompakte Zusammenfassung** am Lektionsende (Ergebnis und XP), sofern du
  die Abschnitte nicht angepasst hast; die **ausführliche Auswertung** öffnet
  den vollständigen Rückblick.
- **Einstellungen neu gegliedert**: beschriftete Bereiche mit Abschnittsleiste
  auf den Reitern Lernen und Daten; die Desktop-App listet ihre installierten
  Plugins.
- **Aktualisieren** unter Meine Inhalte spielt alle verfügbaren Set-Updates
  auf einmal ein, außer denen, die den Lernfortschritt betreffen würden; der
  Inhalte-Hub hat einen eigenen Reiter Erstellen.
- Impressum und Datenschutzerklärung auf Deutsch und Englisch;
  Telefon-Korrekturen für die iOS-Tastatur, volle Kopfzeilen und die
  Reiterleisten der Hubs.

## v2.14.0 - Spielmodus und Arcade

- **Optionaler Spielmodus**: Combo-Serien, fliegende Punkte, Checkpoints,
  Antwort-Physik, Herzen und Countdown sowie ein eigenes Sound-Set.
- **Arcade-Minispiele**, per XP freigeschaltet (Lern-Memory, Snake,
  TicTacToe, Simon), dazu Blitzrunden beim Set-Abschluss.
- Farbvarianten für das Maskottchen; Avatar-Vorlagen und Rahmen, die an
  Level und Abzeichen gebunden sind.
- **Set-Seiten** listen ihre Lektionen mit Fortschritt, beim Verlassen einer
  Lektion geht es zurück zum Set, und eine Set-Abschluss-Übersicht sammelt
  jeden Fehler des Sets.
- Neuer Einstellungsreiter **Diagnose & Support**.
- Drei neue Erweiterungstypen im Erstellungs-Assistenten: Sprechen und
  Aufnehmen, Audio-Auswahl, Audio-Kacheln.

## v2.13.0 - Übungstypen umwandeln

- **Übungstyp direkt im Lektions-Editor ändern**; der Wiederholungsverlauf
  bleibt erhalten, soweit der Inhalt bestehen bleibt, und die KI füllt Felder,
  die eine Umwandlung leer lässt.
- **Als Kopie bearbeiten** direkt am heruntergeladenen Set; deine Kopie ist
  als eigene Bearbeitung markiert, und ein erneuter Import behält den
  Wiederholungsverlauf unveränderter Übungen.
- Die Korrekturrunde am Lektionsende zeichnet Antworten wieder auf, und das
  Vorlesen hält den Bildschirm wach.

## v2.12.0 - Set neu beginnen

- Ein abgeschlossenes Set als **neuen Durchgang** starten, während der
  Wiederholungsverlauf weiterläuft.
- Anbieterschlüssel aus einem Topos-`.alk`-Export importieren; **Perplexity**
  kommt als KI-Anbieter dazu.

## v2.11.0 - Stabiler Lernfortschritt

- Der Lernfortschritt hängt an **stabilen Übungs-Identitäten**. Eine einmalige
  lokale Migration beim ersten Start ordnet den vorhandenen Fortschritt neu zu,
  sodass Inhaltskorrekturen keine Wiederholungskarten mehr verwaisen lassen.
- Zuordnungsübungen überarbeitet: Hilfe in der Knopfleiste, Fortschrittszähler
  oben.

## v2.10.0 - Sicherheit: standardmäßig nur lokal

- **Update empfohlen.** Desktop-Launcher und Compose-Datei binden die App jetzt
  an `127.0.0.1`. Vorher konnte jeder im selben Netz sie ohne Anmeldung öffnen,
  samt gespeicherter KI-Schlüssel.
- Wer die App bewusst von einem anderen Gerät erreichen will, setzt
  `ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` in der `.env`, und zwar nur in einem
  Netz, dem man vertraut.

## v2.9.0 - Der Launcher lässt sich wieder schließen

- Der heruntergeladene Launcher beendet sich beim Schließen des Fensters, auch
  auf Desktops ohne Systemleiste (etwa Ubuntu GNOME). Die App läuft in Docker
  weiter.
- Die von dir gesetzte Lektionsreihenfolge steuert jetzt die Lernfolge, und
  Bearbeiten gehört zur einzelnen Lektion.

## v2.7.0–v2.8.2 - Launcher nutzt ein veröffentlichtes Image

- Der Desktop-Launcher **lädt ein veröffentlichtes, geprüftes Image**, statt
  auf deinem Rechner zu bauen (v2.7.0 wurde getaggt, seine Änderungen kamen
  erst mit v2.8.0 bei Nutzern an).
- Ein Hinweis hilft allen, deren Wiederholungsfortschritt für die korrigierten
  A1-Lektionen Japanisch, Koreanisch und Chinesisch verwaist war; er bietet
  zuerst eine Sicherung an und läuft nie automatisch.
- **Sicherheits-Patch v2.8.1/v2.8.2 (Update empfohlen)**: Das v2.8.0-Image
  zeigte im Image-Modus eine weiße Seite, und der nackte Container startet
  nicht mehr im Debug-Modus.

## v2.6.0–v2.6.1 - Neuer Sitzungs-Chat, Lektionen aus Büchern

- Der **Sitzungs-Chat** basiert jetzt auf assistant-ui.
- **Lektionen aus einem Buch erstellen**: EPUB, TXT, MD oder DOCX hochladen,
  Kapitel auswählen und pro gewähltem Abschnitt eine Lektion erzeugen.
- Der Diktat-Editor nimmt Audiodateien an; Content-Sets lassen sich über ihr
  Manifest ausblenden.
- Launcher: kontextbewusste Docker-Erkennung und übersetzte Launcher-Oberfläche.

## v2.5.0 - Vollständige Übungserstellung

- Jeder Kern-Übungstyp ist **im Lektions-Editor bearbeitbar**, Übungen lassen
  sich von Hand hinzufügen, und Multiple Choice ist mit Einzel- oder
  Mehrfachauswahl erstellbar.
- Ein **Erweiterungs-Assistent** deckt Kategorisierung, Fehlerkorrektur,
  Leseverstehen und bewertetes Quiz ab; das **Audio-Diktat** kommt als
  Erweiterungstyp dazu.

## v2.4.0 - Erweiterte Lektionserstellung

- Eine Wissenslektion aus **eingefügtem Lehrbuchtext** erstellen, eine eigene
  Lektion bearbeiten, eigene Lektionen zu einem Set bündeln und Kartenbilder
  hochladen.
- Freitext-Übungen akzeptieren **mehrere Antworten** und bieten bei einer
  falschen Antwort eine **KI-Zweitmeinung**.
- Der KI-Einstellungsreiter führt direkt zum Schlüsselimport.

## v2.3.0 - Überarbeiteter Lektionsplayer

- Einklappbares Optionsfeld, Pause-Knopf in der Fußleiste und ein schlankerer
  Titelbereich.
- **Hörübungen, bei denen zuerst zugehört wird**.
- Robusterer Import und Export von Lektions- und Set-Dateien.

## v2.2.0 - Erweiterungsübungen

- Vier **KI-erstellte Erweiterungs-Übungstypen** sowie natives Multiple Choice.
- Ein föderiertes **Content-Repository-Verzeichnis** mit Anmeldeablauf für
  eigene Repositories.
- Einfachere mobile Navigation ohne untere Reiterleiste.

## v2.1.0 - Feinschliff nach dem Start

- Das Entfernen eines Content-Repositorys **hinterlässt keinen
  Geisterfortschritt** mehr auf dem Dashboard, in der Wiederholungswarteschlange
  oder bei pausierten Lektionen.
- Einstellungen neu geordnet, Korrekturen am Lernpfad, ein gut auffindbarer
  **KI-fragen**-Knopf und robustere Content-Synchronisation.

## v2.0.0 - Öffentlicher Start

- Die erste Version für ein breites Publikum: kostenlos und quelloffen (MIT),
  offline-first, ohne Konto, verteilte Wiederholung, eigener KI-Schlüssel,
  eigene Lektionen erstellen und teilen, als PWA installierbar.
- Ein Meilenstein, kein technischer Bruch: keine inkompatible Änderung
  gegenüber v1.99.0.

## v1.99.0 - Mobile Absicherung

- **Multiple Choice als antippbare Antwortknöpfe**, was Fehltipper auf dem
  iPhone behebt.
- Gerätekorrekturen: iOS-Fokus-Zoom, das iPhone-Löschmenü und eine gemerkte
  Oberflächensprache.
- Sprachfilter unter Entdecken, Mehrfachauswahl unter Meine Inhalte,
  optionales automatisches Weiterschalten und eingebettete Beispiele.

## v1.97.0–v1.98.0 - Neugestalteter Inhalte-Hub

- **Meine Inhalte** zeigt nur heruntergeladene Inhalte; Import und Erstellung
  liegen im Import-Reiter; Listen- oder Rasteransicht und eine kompakte Such-
  und Filterleiste.
- Einklappbare Desktop-Seitenleiste und Status pro Set (aktiv, zurückgestellt,
  abgeschlossen) mit Löschen.
- Vertikale Desktop-Navigation und Direktlinks zu einem Set; Lückentext mit
  „alle zutreffenden auswählen"; Prüfungsantworten verlängern die
  Wiederholungsabstände; passwortgeschützter `.alk`-Export der KI-Schlüssel.
- Spanische und französische Übersetzungen überarbeitet.

## v1.95.0–v1.96.0 - Lernmodi

- Eine Lektion oder ein Set als **Üben, Prüfung, Auf Zeit oder Zufall**
  spielen, dazu „Fehler trainieren"; der Prüfungsmodus mit verzögertem
  Feedback, Ergebnisansicht, bestanden oder nicht bestanden und XP-Bonus.
- Modi **Umgekehrt und Endlos**, Einladungscodes zum Teilen von Inhalten und
  Umzug der Daten von der Online- auf eine lokale Installation.
- Ein Set in ein GitHub-Repository exportieren.

## v1.92.0–v1.94.1 - Offline- und Launcher-Absicherung

- Die installierte PWA läuft wie vorgesehen im **Browser-Speichermodus**, mit
  Korrekturen für Lernhilfe, Aussprache und Identität.
- **Desktop-Launcher**: Docker-first-Ablauf mit sichtbarem Fortschritt,
  einstellbaren Ports und einem dauerhaften Fenster; der Windows-Launcher baut
  wieder.
- Die Dialoge der KI-Inhaltsprüfung scrollen auf dem Desktop und zeigen, welcher
  Anbieter und welches Modell geprüft hat.

## v1.91.0 - Navigations-Umbau

- **Hauptnavigation von über 12 auf 7 gruppierte Einträge**
  reduziert (Dashboard, Lernpfad, Meine Inhalte, Entdecken,
  Fortschritt, Settings, Help) - ohne Funktionsverlust, jede
  Seite bleibt erreichbar ([Navigation](user-guide/navigation.md)).
- **Mobile Bottom-Tab-Leiste** (Lernen / Inhalte / Entdecken /
  Fortschritt / Mehr) mit „Mehr"-Bottom-Sheet.
- **ProgressHub** (`/progress`) gruppiert Übersicht / Statistik /
  Meine Pfade in Tabs; **DiscoverHub** (`/discover`) bekommt einen
  Import-Tab. Alte Links bleiben über Redirects gültig.
- Das PWA-Update-Banner taucht nach „Aktualisieren" nicht wieder auf.

## v1.90.0 - KI-Übungsgenerierung + Auto-Update

- **KI-Übungsgenerierungs-Pipeline**: Übungen für eine reine
  Theorie-Lektion erzeugen, mit Qualitäts-Gate, Typ-Balancierung,
  Regenerieren-mit-Feedback und Batch-Erzeugung für ein ganzes Set
  ([KI-Übungsgenerierung](features/ai-exercise-generation.md)).
- **Animierte Paar-Auflösung** in der Matching-Übung.
- **Test-Knopf pro Anbieter** in der Anbieter-Übersicht
  ([Einstellungen](user-guide/settings.md)).
- **Desktop-Auto-Update-Prüfung** über die GitHub-Releases-API.
- KI-Session-Antworten kommen jetzt in deiner UI-Sprache zurück.

## v1.87.0–v1.88.0 - Content-Entdeckung + QR-Sharing

- **Content-Entdeckung (`/discover`)**: ein Suchindex über die
  Bibliothek; der Set-Download ist hierher gewandert, getrennt von
  deinen lokalen „Meine Inhalte" ([Entdecken](features/discover.md)).
- **QR-Code-App-Sharing**: die App über einen scannbaren QR-Code
  teilen (kopieren / PNG laden / nativ teilen).
- **Curriculum-Builder** + tägliche Lern-Erinnerungen.
- **Koreanisch + Indonesisch** kommen dazu (jetzt 11 Sprachen).

## v1.86.0–v1.87.0 - KI-Inhaltsprüfung + `.alb`-Backup

- **KI-Inhaltsprüfung**: set-weite Qualitätschecks mit Report-UI,
  gecachtem Report + Markdown-Export und einem „KI-geprüft"-Badge
  ([KI-Inhaltsprüfung](user-guide/ai-validation.md)).
- **Medien-Integration**: ein „Vertiefe das Thema"-Lektionsabschnitt.
- **`.alb`-ZIP-Backup-Format** ersetzt den einzelnen JSON-Dump und
  trägt jetzt auch einen localStorage-Snapshot
  ([Backup und Wiederherstellung](features/backup.md)).

## v1.70.0–v1.84.0 - UX, Theming und TipTap 3

- **Erstinstallation-Restore**: eine leere Installation bietet im
  Onboarding „Aus Backup wiederherstellen" an.
- **Doku-Überarbeitung** + kontextsensitive In-App-Hilfe.
- **TipTap-Editor von v2 auf v3 migriert** (ganzer `@tiptap/*`-Stack).
- **Feature-Strategy-Gating**: KI-Funktionen wechseln ohne Reload
  zwischen aktiv / deaktiviert / versteckt.
- Umfangreiche Dark-Theme-Kontrast- und Mobile-Layout-Härtung.

## v1.69.0 - Beispiel-Links + Buchempfehlungen

- **Beispiel-Links in Theorie:** Ein Theorieschritt kann einen
  optionalen „Beispiel ansehen"-Link tragen.
- **Buchempfehlungen pro Domäne** im Content Browser
  ([Buchempfehlungen](content-creation/books.md)).
- **Enter-Shortcut auch im Fehler-Replay** („Fehler wiederholen").
- **Backup-Fix:** Set-Titel wird beim Wiederherstellen korrekt aus
  dem Manifest gelesen.

## v1.68.0 - Ergebnis-Export + Theorie-Rücklinks

- **Lektionsergebnis exportieren:** „Ergebnis kopieren" / „Als
  Datei speichern" (Markdown-Report für KI-Assistenten).
- **Theorie-Rücklinks:** Aus einer Übung zur passenden Theorie
  springen und zurück.
- **Zuordnungsübung überarbeitet:** farbige Paare + Nummern-Badges
  (farbenblind-sicher).
- **Dark-Mode-Kontrast** an mehreren Stellen korrigiert.

## v1.67.1 - Backup-Restore + Deploy-Stabilität

- Systematischer **Backup-Wiederherstellungs**-Fix.
- Auto-Neuladen bei veraltetem Deploy-Chunk.
- Subject-Filter-Politur (versteckt bei ≤ 1 Subject,
  meistgenutzt zuerst).

## v1.65.0 - Fortsetzbares Assessment + Enter-Shortcut

- **Fortsetzbares Assessment:** Test abbrechen und später dort
  weitermachen, wo du aufgehört hast.
- **Enter-Shortcut:** Enter prüft eine beantwortete Übung und geht
  weiter (umschaltbar in Einstellungen → Lernen).
- Deutlichere Zuordnungsübungen + Design-Token-Durchlauf.

## v1.64.0 - Onboarding-Überarbeitung

- **Schnellstart mit nur Name + Thema**; der Rest nimmt Vorgaben.
- Optionaler **Onboarding-Assistent** (eine Frage pro Bildschirm).
- Das **Assessment ist jetzt optional** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 - WCAG-AA-Theme-Presets

- **6 empfohlene Themes** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), rechnerisch AA-konform
  ([Theme-System](developer/themes.md)).
- Systematischer i18n-Audit; nutzerbezogener Dashboard-Filter.

## v1.62.0 - Backup-Integrität + Build-Provenienz

- Härtung der **Backup-Wiederherstellung** (Datentyp-Coercion,
  FK-Reihenfolge).
- About zeigt echte Build-Infos statt „unknown".

## v1.61.0 - Button-Konformität + Lektions-Resume

- App-weite shadcn-Button-Konformität.
- **Pausierte Lektion** setzt am exakten Schritt fort.
- Cross-Repo-Inhaltsvalidierung.

---

## Größere Stränge im Zeitraum

- **Mehrere Content-Repositories (EXP-023):** eigene Repos
  verbinden, mehrere verwalten, teilen per Link/QR, Trust-Stufen,
  empfohlene Repos, lokale Bewertungen
  ([Mehrere Content-Repositories](features/content-repos.md)).
- **Backup als vollständiger Snapshot** mit Cross-Identity-Import
  ([Backup und Wiederherstellung](features/backup.md)).

---

## Verwandte Seiten

- [Erste Schritte](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) - vollständige Notizen
