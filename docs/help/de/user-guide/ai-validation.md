# KI-Inhaltsprüfung

Adaptive Learner kann einen heruntergeladenen Lektionssatz
**optional von einer KI prüfen** lassen (EXP-033). Die KI
durchsucht die Karten des Satzes auf Übersetzungs-, Grammatik-
und Niveau-Probleme und meldet, was ihr auffällt — sie blockiert
nichts, sie berät nur. Davon getrennt zeigen Repositories eine
**Trust-Stufe**, die du auf einen Blick einschätzen kannst.

<!-- TODO: Screenshot — Content Browser, Satzkarte mit Button „Mit KI prüfen" + Badge „KI-geprüft" -->

---

## Trust-Stufen von Repositories

Jeder Lektionssatz trägt im Content Browser ein Quell-Badge mit
einer Trust-Stufe. Sie sagt etwas über die **Herkunft**, nicht
über die inhaltliche Qualität:

- **Trust 0 — nicht geprüft.** Ein neu verbundenes Repo, dessen
  automatische Prüfung (noch) nicht bestanden ist.
- **Trust 1 — technisch geprüft.** Das Repo enthält mindestens
  eine Lektion und keinen ausführbaren Code. Die Prüfung läuft
  bei jeder Synchronisierung erneut.
- **Trust 3 — offiziell empfohlen.** Ein kuratiertes Repo aus der
  offiziellen Empfehlungsliste.

Gemeinschafts-Bewertungen (Trust 2) und ein zentraler Index sind
noch nicht umgesetzt.

---

## Voraussetzungen für die KI-Prüfung

Die KI-Prüfung ruft einen KI-Anbieter direkt aus dem Browser auf.
Du brauchst dafür:

- einen **gespeicherten API-Schlüssel** (Einstellungen →
  Integrationen) für einen der Anbieter (Anthropic, OpenAI oder
  Gemini);
- den **Browser-Modus** (Dexie) — die Prüfung läuft
  browser-direkt;
- einen **heruntergeladenen Satz** (die Prüfung arbeitet auf den
  lokal gespeicherten Karten).

Ohne Schlüssel ist der Button sichtbar, aber deaktiviert; ein
Hinweis führt zu den Einstellungen.

> **Kosten:** Die Prüfung verbraucht Tokens deines eigenen
> Anbieterkontos und wird nach dessen Preisliste abgerechnet. Vor
> dem Start zeigt der Dialog eine **Kostenschätzung**, die du
> bestätigen musst.

---

## Einen Satz prüfen — Schritt für Schritt

1. Öffne den **Content Browser** und wähle einen
   heruntergeladenen Satz.
2. Klicke auf **„Mit KI prüfen"**.
3. Der Dialog zeigt eine **Kostenschätzung**. Bestätige sie, um
   den Lauf zu starten.
4. Die Karten werden **gebündelt** geprüft; eine Fortschritts-
   anzeige läuft mit, und du kannst jederzeit **abbrechen**.
5. Am Ende erscheint ein **Bericht pro Karte**: nur Karten mit
   einem Befund werden aufgelistet, jeweils mit der betroffenen
   Lektion und dem Hinweis der KI.

Zwischen zwei Läufen liegt eine kurze **Wartezeit** (rund eine
Minute), damit nicht versehentlich mehrfach abgerechnet wird.

---

## Bericht, Cache und das „KI-geprüft"-Badge

- **Zwischengespeichert.** Der Bericht wird lokal (IndexedDB)
  gespeichert und beim nächsten Öffnen wieder angezeigt, ohne
  erneut zu bezahlen. Er trägt einen Inhalts-Hash + eine
  Signatur, sodass ein veränderter Satz eine neue Prüfung
  nahelegt.
- **Exportierbar.** Du kannst den Bericht als **Markdown**
  herunterladen — praktisch, um ihn in eine Lektion-Überarbeitung
  oder ein Issue einzufügen.
- **Badge.** Ein geprüfter Satz zeigt im Content Browser ein
  **„KI-geprüft"**-Badge, damit du siehst, dass eine Prüfung
  vorliegt.

Die KI ist **beratend**: Sie hebt mögliche Probleme hervor,
verhindert aber nie, dass du einen Satz lernst, bearbeitest oder
teilst. Die Entscheidung bleibt bei dir.

---

Mehr zur Funktionsweise hinter den Kulissen steht in der
Entwickler-Dokumentation unter
[KI-Integration](../developer/ai-integration.md).
