# FAQ

## Sind meine Daten sicher?

Im **Lokal-Modus** leben alle deine Daten in IndexedDB auf
deinem Gerät. Kein Backend, kein Drittanbieter. Das Schließen
des Browser-Tabs löscht sie nicht; das Löschen der Site-Daten
schon. Wenn du das Gerät teilst, kann jeder mit Zugriff auf
dieses Browser-Profil lesen.

Im **Server-Modus** leben die Daten in der SQLite-Datenbank,
die das FastAPI-Backend verwaltet. API-Schlüssel werden im
Ruhezustand mit Fernet verschlüsselt, mit einem Geheimnis, das
du über die Umgebungsvariable `ADAPTIVE_LEARNER_SECRET_KEY`
setzt.

Keiner der Modi sendet Telemetrie, Analytics oder deine
Nachrichten an Dritte außer dem KI-Anbieter, den du gewählt
hast — und der sieht nur den Nachrichteninhalt, den du erwartest
(System-Prompt + dein Text + die vorherigen KI-Antworten der
Session).

## Brauche ich einen API-Schlüssel?

Ja für KI-Sessions. Die App nutzt **bring-your-own-key** für
alle drei unterstützten Anbieter: Anthropic Claude, OpenAI GPT,
Google Gemini. Free-Tier-Limits pro Anbieter reichen meist für
ein paar Sessions am Tag; bei stärkerer Nutzung schalten
zahlende Tiers höhere Kontingente frei.

Du kannst das Curriculum durchstöbern, den Lerntyp-Test machen
und das Dashboard ansehen ohne Schlüssel. Die Session-Seite
ist das einzige Feature, das einen braucht — sie ruft die KI.

## Kann ich es offline nutzen?

Teilweise. Der PWA-Service-Worker cachet die statischen Assets
(HTML, JS, CSS, Icons), damit die App ohne Internet startet.
Vergangene Sessions und Dashboard-Daten laden auch aus dem
lokalen Speicher — Lesen alter Materialien geht.

**Live-Sessions brauchen Internet**, weil der KI-Anbieter
außerhalb des Browsers sitzt. Die Session-Seite erkennt
"offline" und zeigt eine deutliche Inline-Nachricht statt
still zu scheitern, wenn du eine neue Session ohne Verbindung
startest.

## Was bedeutet der Methodenwechsel?

Wenn drei Sessions in Folge dein Verständnis stagnieren UND
deinen Stress hoch zeigen, blendet die App ein Banner ein:
"Willst du für die nächste Session [andere Methode] probieren?"
Die Empfehlung bevorzugt deine zweitstärkste Methode aus dem
Test, die du zuletzt nicht genutzt hast.

Es ist ein *Vorschlag*, kein Befehl. Du kannst das Banner
verwerfen und mit der aktuellen Methode weitermachen; das
Banner kommt wieder, wenn das Stagnationsmuster anhält.

## Was unterscheidet die App von ChatGPT?

ChatGPT ist eine Chat-Oberfläche zu einem einzelnen Modell.
Adaptive Learner ist ein *strukturiertes Lernsystem*, das unter
der Haube eine KI nutzt, aber fünf Dinge hinzufügt:

1. **Eine 6-Methoden × 7-Schritte-Matrix** maßgeschneiderter
   System-Prompts. Die KI verhält sich als deduktiver Input-
   Begleiter völlig anders als als kontextueller Integrations-
   Begleiter.
2. **Pro-Zug-Schritt-Bewertung** — ein zweiter KI-Aufruf
   bewertet, ob du bereit für den nächsten Schritt bist, und
   kann Vorwärtsbewegen, Wiederholen oder Zurückgehen
   vorschlagen.
3. **Ein Profil** deiner Lernpräferenzen, ermittelt aus einem
   12-Fragen-Test, das prägt, mit welcher Methode Sessions
   starten.
4. **Langfristiges Tracking** — ProgressCommits, Streak-Tage,
   Methodenverteilung, Zeit-pro-Schritt-Charts. ChatGPT
   vergisst beim Schließen des Tabs.
5. **Anbieter-Freiheit** — wähle Anthropic, OpenAI oder
   Gemini. Adaptive Learner ist die Orchestrierung, das
   Modell wählst du.

## Was, wenn die KI Mist baut?

Das System ist auf sichtbares Scheitern ausgelegt:

- **Falscher API-Schlüssel**: Der KI-Aufruf gibt eine klare
  Fehlernachricht zurück, inline im Chat angezeigt.
- **Anbieter down**: Gleich — der HTTP-Status der Anbieter-
  API wird sichtbar.
- **JSON-Parse-Fehler beim Bewerter**: Ein deterministisches
  +1-Vorrücken springt ein (gedeckelt auf Schritt 7), mit
  `fallback_used: true` aufgezeichnet, damit ein späteres
  Audit Modelle erkennt, die mit dem Format kämpfen.
- **Veraltete oder seltsame KI-Antwort**: Session beenden,
  niedrig bewerten, neu starten. Die Methodenwechsel-
  Heuristik wird eine andere Methode vorschlagen, wenn das
  Muster anhält.

## Kann ich meine Daten exportieren?

In v0.7.0 ist Export noch kein eigenständiger Button. Im
Lokal-Modus kannst du die Rohdaten über den IndexedDB-
Inspector des Browsers ablesen (Chrome DevTools > Application
> IndexedDB > adaptive-learner). Im Server-Modus kannst du
die SQLite-Datenbank direkt abfragen (eine einzelne Datei,
keine Spezialwerkzeuge nötig).

Sauberer Export / Backup / Restore steht auf der Folge-
Liste.
