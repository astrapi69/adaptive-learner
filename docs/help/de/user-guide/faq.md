# FAQ

## Sind meine Daten sicher?

Im **Lokal-Modus** liegen alle deine Daten in IndexedDB auf
deinem eigenen Gerät. Kein Backend, kein Drittanbieter. Den
Browser-Tab zu schließen löscht nichts; Site-Daten zu löschen
schon. Auf einem geteilten Gerät kann jeder mit Zugriff auf
dieses Browser-Profil sie lesen.

Im **Server-Modus** liegen die Daten in der SQLite-Datenbank,
die das FastAPI-Backend verwaltet. API-Schlüssel werden mit
Fernet at-rest verschlüsselt - über das Geheimnis aus der
`ADAPTIVE_LEARNER_SECRET_KEY`-Umgebungsvariable, oder über
`secret_key:` in `~/.config/adaptive-learner/secrets.yaml`.

Kein Modus sendet Telemetrie, Analytics oder deine Nachrichten
an Dritte - außer an den von dir gewählten KI-Anbieter, der
nur das sieht, was du erwarten würdest (System-Prompt + dein
Text + bisherige KI-Antworten der Sitzung).

## Brauche ich einen API-Schlüssel?

Ja für KI-Sitzungen. Die App nutzt **Bring-Your-Own-Key** für
alle drei unterstützten Anbieter: Anthropic Claude, OpenAI
GPT, Google Gemini. Die kostenlosen Kontingente reichen
meistens zum Einstieg.

Drei Stellen für den Schlüssel (höchste Priorität gewinnt):
eine `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`-Umgebungsvariable,
das `ai.<provider>.api_key`-Feld in
`~/.config/adaptive-learner/secrets.yaml`, oder die
Einstellungs-UI. Die UI zeigt pro Anbieter die Quelle, sodass
du immer weißt, woher dein Schlüssel kommt.

Du kannst das Curriculum durchstöbern, den Lerntyp-Test
machen, das Dashboard anschauen und sogar den Chat-Verlauf-
Import laufen lassen, ohne einen API-Key. Die Sitzungs-
Seite + der Analyse-Schritt + die KI-Extraktions-Features
sind die, die einen Key brauchen.

## Kann ich die App offline nutzen?

Teilweise. Der PWA-Service-Worker cached die statischen
Assets (HTML, JS, CSS, Icons), sodass die App ohne Internet
startet. Vergangene Sessions und Dashboard-Daten laden auch
aus dem lokalen Speicher, sodass das Lesen alter Materialien
funktioniert.

**Live-Sitzungen brauchen weiterhin Internet**, denn der
KI-Anbieter sitzt außerhalb deines Browsers. Die Sitzungs-
Seite erkennt „offline" und zeigt eine klare Inline-Meldung,
statt still zu scheitern.

## Was bedeutet der Methodenwechsel?

Wenn drei Sitzungen in Folge dein Verständnis stagnieren und
deinen Stress hoch zeigen, blendet die App ein Banner ein:
„Willst du für die nächste Session [andere Methode]
ausprobieren?". Die Empfehlung bevorzugt deine zweitstärkste
Methode aus dem Test, die du nicht kürzlich genutzt hast.

Es ist ein *Vorschlag*, kein Befehl. Du kannst das Banner
schließen und mit deiner aktuellen Methode weitermachen; das
Banner kommt wieder, wenn das Stagnationsmuster anhält.
Methodenwechsel werden in der `method_switches`-Tabelle
festgehalten und tauchen in der Methodenverteilung der
Fortschritts-Seite auf.

## Was ist Auto-Loop?

Wenn eine Sitzung Schritt 7 (Integrieren) erreicht und der
Topic-Transition-Bewerter das Thema als integriert UND
fortsetzungswürdig einschätzt, startet automatisch ein
frischer Zyklus mit einem neuen Unterthema. Bis zu 5 Zyklen
pro Sitzung (Schutz vor Endlosschleifen). Der Chat-Verlauf
rendert „Zyklus N"-Karten mit gestricheltem Rand an jedem
Übergang. Der Bewertungsdialog am Ende der Sitzung fasst die
Multi-Cycle-Reise zusammen, wenn `cycle_count > 1`.

## Kann ich meine Daten exportieren?

Ja. Drei Export-Pfade ausgeliefert:

- **Backup**: Einstellungen → Backup → Backup erstellen.
  Lädt ein zeitgestempeltes JSON mit jeder Zeile deines
  Accounts herunter. API-Schlüssel werden entfernt. Geht in
  beiden Speichermodi.
- **Fortschritts- / Sitzungs- / Curriculum-Berichte**:
  Einstellungen → Export. Markdown + PDF (Browser-Druck-zu-
  PDF).
- **Anki .apkg**: KI-extrahierte Karteikarten auf der
  `/anki`-Seite prüfen, gewünschte annehmen, Export klicken.
  Die Datei funktioniert direkt in Anki-Desktop.
- **NotebookLM-ZIP**: Von der Fortschritts-Seite ein
  strukturiertes ZIP herunterladen (Zusammenfassung +
  Vokabular + Regeln + Fehler + Karteikarten + Sitzungen),
  formatiert für den NotebookLM-Source-Upload.

## Was ist das Stimme-Feature?

Drei Web-Speech-API-Integrationen:

- **Text-to-Speech** auf KI-Antworten + Assessment-
  Ergebnissen - ein ▶-Knopf neben jedem liest es laut vor,
  sprach-angepasst.
- **Speech-to-Text** auf dem Sitzungs-Input - ein 🎤-Knopf
  nimmt deine Stimme auf und füllt das Textarea mit
  Zwischen-Transkripten vor dem Absenden.
- **Aussprache-Übung** für Sprachprojekte - besuche
  `/pronunciation`, die KI erzeugt einen Zielsatz, du
  sprichst, und eine Judge-KI bewertet Ähnlichkeit +
  schlägt Verbesserungen vor.

Stimme-Toggles in Einstellungen → Stimme. Der Abschnitt
blendet sich in Browsern aus, die die API nicht unterstützen.

## Was ist der Chat-Verlauf-Import?

Die Import-Seite (`/import`) akzeptiert eingefügte oder
hochgeladene Chat-Transkripte aus ChatGPT, Claude.ai (sowohl
JSON-Bulk-Export als auch Single-Conversation-Markdown-
Export), Gemini und beliebigem Markdown. Der Analyzer
extrahiert dein Thema, Schwächen, Fehlermuster, empfohlene
Methode, Vokabular (für Sprachgespräche) und einen Lehrplan-
Vorschlag. Ein Klick sät ein Curriculum + startet eine
gezielte Session aus der Analyse.

Der Claude.ai-Single-Conversation-Markdown-Export ist ein
geprüfter Import-Fall - der Parser liefert volle Zeitstempel-
Extraktion + Rollengrenzen-Erhalt für dieses Format aus.

## Sync zwischen Geräten?

Bidirektionaler Lokal-Netz-Sync. Einstellungen →
Sync → „Dieses Gerät koppeln": QR-Code vom anderen
Gerät-Bildschirm scannen (Rückkamera), oder Pairing-URL
einfügen. Nach dem Pairing tauschen Push- + Pull-Knöpfe
Daten aus; Konflikte gehen durch einen KI-Merge-Resolver.
30 Tabellen auf der Sync-Oberfläche (inkl. Lektions-
Fortschritt, Element-Fehler und Missionen).

## Wie ist das anders als ChatGPT?

ChatGPT ist eine Chat-Oberfläche zu einem einzelnen Modell.
Adaptive Learner ist ein *strukturiertes Lernsystem*, das
unter der Haube eine KI nutzt, aber zusätzlich bringt:

1. **Eine 6-Methoden × 7-Schritte-Matrix** maßgeschneiderter
   System-Prompts.
2. **Pro-Turn-Schritt-Bewertung** - ein zweiter KI-Aufruf
   beurteilt die Bereitschaft und kann dich vorwärts /
   zurück bewegen.
3. **Auto-Loop in neue Zyklen**, wenn das Thema integriert
   ist.
4. **Ein Profil** deiner Lernpräferenzen aus dem 12-Fragen-
   Test.
5. **Langfristiges Tracking** - ProgressCommits, Streak-
   Heatmap, XP, Abzeichen, Zeit-pro-Schritt-Charts. ChatGPT
   vergisst, wenn du den Tab schließt.
6. **Anbieter-Freiheit** - Anthropic, OpenAI oder Gemini.
7. **Local-First-Option** - alles in deinem Browser, nichts
   wird an einen Server gesendet (außer deine KI-Aufrufe).

## Was, wenn die KI danebenliegt?

Das System scheitert sichtbar:

- **Falscher API-Schlüssel**: Der KI-Aufruf gibt eine klare
  Fehlermeldung zurück, inline im Chat.
- **Anbieter down**: dasselbe - die Fehler-Anzeige rendert
  den HTTP-Status der Anbieter-API.
- **JSON-Parse-Fehler vom Bewerter**: ein deterministisches
  +1-Advance greift (bei Schritt 7 gekappt), mit
  `fallback_used: true` aufgezeichnet, sodass eine künftige
  Auditierung Modelle erkennen kann, die mit dem Format
  kämpfen.
- **Streaming mittendrin abgebrochen**: die Teilantwort
  bleibt erhalten; die nächste Nachricht macht von dort
  weiter.
- **Veraltete oder seltsame KI-Antwort**: Sitzung beenden,
  niedrig bewerten, neu starten. Die Methodenwechsel-
  Heuristik wird eine andere Methode vorschlagen, wenn das
  Muster anhält.
