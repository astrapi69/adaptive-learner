# EXP-051: Durchgänge und Fehlerhistorie

**Kategorie:** Querschnitt · **Phase:** Analyse (kein Code, kein Schema-Eingriff
in diesem Dokument) · **Priorität:** Hoch (zwei wartende Vorhaben hängen daran)
· **Abhängig von:** AUTH-05 (Kennungsstabilität auf Übungsebene, eigener
Vorgang, läuft parallel), EXP-045 (Content-ID-Stabilität), #2308/#2161/#2519
(die bereits dreimal getragene Umschlüsselungs-Technik auf Elementebene) ·
**Issue:** #2125 (Durchgang, blockiert), Fehlerhistorie (noch ohne eigenen
Vorgang)

> Explorationsdokument. Kein Code, keine Schema-Änderung - nur Ist-Aufnahme,
> die Entscheidungen des Architekten in benannter Form, und die offenen Fragen
> so beantwortet, dass eine Umsetzung darauf aufbauen kann. **Eine Exploration
> für beide Vorhaben**, denn sie brauchen dasselbe Datenmodell: eine
> Durchgangs-Dimension auf den Fortschrittsdaten. Zweimal getrennt entworfen
> ergäbe zwei Modelle, die driften.

---

## Anlass

Zwei Vorhaben warten seit Wochen auf dasselbe Fundament:

- **Durchgang (#2125):** ein Lernender soll ein bereits fertiges Set erneut
  durcharbeiten können, wobei der erste Durchgang für eine spätere Auswertung
  erhalten bleibt statt überschrieben oder zurückgesetzt zu werden.
- **Fehlerhistorie:** ein Verlauf über mehrere Durchgänge - wie hat sich die
  Fehlerquote eines Lernenden für ein Set über die Zeit entwickelt.

Beide scheitern an derselben Lücke: `ElementError` (backend/app/models/__init__.py:1495-1663)
kennt keine Durchgangs-Dimension. Der eindeutige Schlüssel ist
`(user_id, set_id, lesson_id, exercise_id, element_key, direction)`
(`uq_element_errors_user_element_direction`, Zeile 1534-1546); `error_count`
ist ein Lifetime-Zähler, `attempt_history` ein Ringpuffer der letzten 10
Versuche - beides ohne Konzept von "welcher Durchlauf".

**Der zweite Blocker aus #2125, die Stabilität der Übungskennungen über
Content-Updates hinweg, wird durch AUTH-05 gelöst und ist hier NICHT
Gegenstand.** Diese Exploration setzt voraus, dass AUTH-05 die
Übungsebenen-Umschlüsselung liefert, und beschreibt unter "Inhalts-Update
mitten im Durchgang" nur, WIE das Durchgangs-Modell sich dazu verhält - nicht,
wie die Umschlüsselung selbst funktioniert.

---

## Entscheidungen des Architekten

Gefallen, nicht neu zu diskutieren. Sie stehen hier als Entscheidungen mit
Begründung, nicht als stillschweigende Annahme - wer dieses Dokument in einem
Jahr liest, soll nicht raten müssen, warum kalt geplant wird.

### Generationsspalte statt Kopie

Der eindeutige Schlüssel der Fehlerzeilen wird um eine Durchgangskennung
(`run_id`) erweitert. Ein neuer Durchgang schließt die Zeilen des alten ab und
schreibt unter der nächsten Kennung. Kein Inhalt wird dupliziert - nur die
Fortschrittsdaten bekommen eine zusätzliche Dimension.

**Begründung:** additiv, kein Content-Duplikat (spart DB- und Backup-Größe,
relevant für iOS-Eviction-Risiko), und Altzeilen bleiben gültig. Abwesenheit
der Spalte (bzw. ihr Default) bedeutet den ersten Durchgang - dasselbe Muster,
das an anderer Stelle in diesem Bestand bereits mehrfach trägt (`review_status`
absent = `"authored"`, `hint_used` absent = `false`).

### Kalt planen, warm anzeigen

Ein neuer Durchgang startet die Wiederholungsplanung (Intervall, Ease, was
auch immer der Scheduler intern führt) OHNE Vorprägung aus dem vorigen
Durchgang. Die frühere Historie bleibt dem Lernenden sichtbar - etwa als
Hinweis, wie oft eine Aufgabe im letzten Durchgang falsch war -, fließt aber
nicht algorithmisch in die neue Planung ein.

**Begründung:** Zwei Dinge, die leicht vermischt werden, sind hier bewusst
getrennt: was der Algorithmus als Eingabe bekommt, und was der Lernende zu
sehen bekommt. Würde die Planung vom ersten Durchgang erben, wären die beiden
Durchgänge keine unabhängigen Messungen mehr - genau die Vergleichbarkeit, die
der Zweck des Features ist, ginge verloren. Der didaktische Einwand (Wiederholen
ist tatsächlich schneller als Erstlernen) ist berechtigt, wird aber über die
Anzeige gelöst, nicht über den Algorithmus - das kostet nichts an
Unabhängigkeit der Messung. Die Alternative (eine Formel, wie viel Vorwissen
mit welchem Gewicht übertragen wird) wäre eine offene Forschungsfrage ohne
Boden und selbst zum Blocker geworden.

### Nur der aktive Durchgang füllt die Warteschlange

Abgeschlossene Durchgänge sind unveränderliches Archiv - ihre Zeilen werden
nie wieder geschrieben, nie wieder für die Review-Planung gelesen.

**Begründung:** setzt die "nur ein Durchgang terminierend"-Vorgabe direkt über
den Lese-Scope des Schedulers um, ohne eine separate "aktiv/inaktiv"-Logik in
der Planung selbst zu brauchen.

### Unbegrenzt aufheben, keine Aufräumung

Jeder abgeschlossene Durchgang bleibt bestehen, ohne zeitliche oder mengenmäßige
Grenze. Keine Kompaktierung, keine Verdichtung alter Durchgänge in diesem
Vorhaben.

**Begründung:** nicht spekulativ bauen, was noch kein Problem ist (YAGNI) -
Speicherverbrauch durch viele Durchgänge ist heute nicht gemessen und nicht
akut. Die Entscheidung hat eine Implikation für die Fehlerhistorie (siehe
unten): sie spricht dafür, dass ein Verlauf über ALLE Durchgänge gelesen
werden soll, nicht nur ein Zweier-Vergleich - wären nur zwei interessant,
bräuchten mittlere Durchgänge nicht unterscheidbar zu bleiben. Das ist eine
Vermutung aus der Entscheidung, keine eigene Festlegung dieses Dokuments.

### Die Vergleichslogik gehört nicht in dieses Modell

Ob die Fehlerhistorie den letzten Durchgang gegen den ersten hält, einen
Verlauf über alle zeigt, oder etwas drittes tut, entscheidet die
Fehlerhistorie-Funktion selbst, später, unabhängig von diesem Modell.

**Begründung:** hält die Kopplung eng. Das Modell liefert saubere,
unterscheidbare Generationen - wie gelesen wird, ist eine Entscheidung der
lesenden Funktion, nicht der Datenhaltung.

---

## Was diese Exploration klärt

### Das Schema im Detail

**Backend (API-Modus, SQLAlchemy).**

`ElementError` (`backend/app/models/__init__.py:1495`) bekommt eine neue
Spalte:

```python
run_id: Mapped[int] = mapped_column(
    Integer,
    nullable=False,
    default=1,
    server_default=text("1"),
)
```

Der bestehende `UniqueConstraint` (Zeile 1534-1546) wird um `run_id` erweitert:
`(user_id, set_id, lesson_id, exercise_id, element_key, direction, run_id)`.
Eine Alembic-Migration setzt `run_id=1` für alle Bestandszeilen (Server-Default
deckt das ab, kein Backfill-Skript nötig).

Neu: eine schlanke Tabelle `set_runs` (Name vorläufig), die trägt, WELCHER
Durchgang je (Nutzer, Set) aktiv ist:

```python
class SetRun(Base):
    __tablename__ = "set_runs"
    __table_args__ = (
        UniqueConstraint("user_id", "set_id", "run_id"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    set_id: Mapped[str] = mapped_column(String(120), nullable=False)
    run_id: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

`closed_at IS NULL` markiert den aktiven Durchgang - dasselbe Nullable-Timestamp-
Muster wie `ElementError.retired_at` (Zeile 1663) und `mastered_at` (Zeile 1612):
Abwesenheit heißt "noch offen/aktiv", kein Sonderwert nötig. Die Invariante
"höchstens ein aktiver Durchgang je (Nutzer, Set)" wird service-seitig
durchgesetzt (Start eines neuen Durchgangs = eine Transaktion, die den alten
schließt UND den neuen anlegt), nicht über eine DB-Constraint - ein partieller
Unique-Index auf `closed_at IS NULL` wäre möglich (SQLite unterstützt das),
ist aber eine Umsetzungsentscheidung, keine, die diese Exploration trifft.

**Frontend (Dexie-Modus).** Spiegelbildlich: `elementErrors`-Tabelle bekommt
das Feld `run_id` (Schema-Bump, additive `version(n)`-Migration nach dem
etablierten Muster, Default 1 für Bestandszeilen). Neue Dexie-Tabelle
`setRuns` mit denselben Feldern, eigenem Index statt einer `userData`-Zeile -
das ist echte, mit der Zeit wachsende relationale Historie, kein einzelnes
Flag.

**Repository-/Service-Schnitt:** `elementErrors.list()` (beide Modi) braucht
einen optionalen `runId`-Parameter (Default: aktiver Durchgang), damit die
Fehlerhistorie gezielt einen abgeschlossenen Durchgang lesen kann, ohne die
Review-Queue-Pfade zu berühren, die weiterhin implizit auf "aktiv" scopen.

### Wann beginnt ein neuer Durchgang?

**Nutzer-ausgelöst, nicht automatisch.** Über eine explizite Aktion ("Set
erneut durcharbeiten" - der Name aus #2125s eigenem Titel), verfügbar für
Sets im Status `completed` (bestehender Status-Store,
`frontend/src/lib/content/browse/set-status-store.ts`). Kein automatischer
Trigger beim Erreichen von "abgeschlossen" - der Lernende entscheidet den
Zeitpunkt, nicht die App. Passt zur bereits entschiedenen Vorgabe "kein
quantifizierter Dialog, nur eine einfache Bestätigung": eine
Nutzer-ausgelöste Aktion mit einfacher Bestätigung ist die natürliche Paarung.

**"Abgeschlossen" braucht keine eigene Definition.** Das Schließen des alten
Durchgangs und das Anlegen des neuen sind EIN atomarer Vorgang (eine
Transaktion: `closed_at` auf die alte `SetRun`-Zeile, neue Zeile mit `run_id
+ 1`). Es gibt keinen Zustand "abgeschlossen, aber kein neuer Durchgang
begonnen" - das erspart eine zweite Zustandsmaschine.

### Was passiert bei einem Inhalts-Update mitten im Durchgang?

Die schwierigste der offenen Fragen, weil sie an AUTH-05 grenzt, ohne von
AUTH-05 selbst zu handeln.

Zwei Fälle:

1. **Update ohne Kennungsbruch** (AUTH-05 löst sicher auf): der laufende
   Durchgang läuft unverändert weiter, die Umschlüsselung hält die Zeilen am
   richtigen Element.
2. **Update mit unsicherem Rest** (AUTH-05 kann nicht sicher zuordnen): hier
   ist die Frage, ob ein Durchgang an eine Inhaltsfassung gebunden sein soll.

**Empfehlung dieses Dokuments (keine Architekten-Entscheidung, zur Bestätigung
vorgelegt):** kein hartes Anbinden eines Durchgangs an eine Inhaltsfassung -
das würde entweder Sync für die Laufzeit eines Durchgangs blockieren oder vom
"immer aktuell"-Modell abweichen, das der Rest der App durchhält. Stattdessen:
die Inhaltsfassung (oder ein Hash/Commit-Bezug) wird bei Durchgangs-Start
vermerkt (ein Feld auf `SetRun`, z. B. `content_version_at_start`); ein
unsicherer Rest bei einem Update während eines aktiven Durchgangs wird über
denselben Weg gemeldet, den der bestehende Update-Wächter (#2309) schon nutzt
- nicht neu erfunden. Die Fehlerhistorie kann anhand des vermerkten Werts
selbst entscheiden, ob sie einen Durchgang, dessen Inhalt sich während der
Laufzeit änderte, kennzeichnet oder aus einem strikten Vergleich ausschließt -
das ist wieder ihre eigene Lese-Entscheidung, nicht Sache dieses Modells.

### Die Sicherung

Schema-Version-Fassung heben (bestehender `.alb`-Versionszähler). Rückwärts-
kompatibilität nach dem etablierten Muster: eine ältere Sicherung ohne
`run_id`-Feld auf den Fehlerzeilen importiert mit dem Default (`run_id=1`),
ohne `set_runs`-Zeilen - der erste Lese-/Schreibzugriff nach dem Import legt
den impliziten aktiven Durchgang 1 lazy an, kein blockierendes
Einmal-Migrationsskript nötig.

### Was die Fehlerhistorie vom Modell braucht

Nur die Datenanforderung, nicht ihre Darstellung:

- Alle Durchgänge eines (Nutzer, Set) auflisten können, je mit Start-/
  Abschlusszeitpunkt (aus `set_runs`).
- Alle Fehlerzeilen EINES bestimmten (auch abgeschlossenen) Durchgangs lesen
  können - der optionale `runId`-Parameter auf `elementErrors.list()` oben.
- Für eine günstige Verlaufsdarstellung: eine Aggregation pro Durchgang
  (Gesamtfehler, Mastery-Anteil). Für die erste Fassung genügt es, das
  clientseitig aus den Rohzeilen zu berechnen - eine eigene Aggregat-Tabelle
  erst bauen, wenn das nachweislich zu langsam ist (dieselbe
  Nicht-spekulativ-Haltung wie bei der Aufräumung).

### Waisen

**Set gelöscht:** die bestehende Aufräum-Maschinerie (#2064-Linie,
`frontend/src/lib/content/browse/orphan-cleanup.ts`) muss über ALLE
`run_id`-Werte des Sets fegen, nicht nur den aktiven - eine Erweiterung des
bestehenden Fegens, kein neuer Mechanismus.

**Einzelne Übung ausgemustert (#2188):** betrifft nur den AKTIVEN Durchgang
(die bestehende Archivierung über `retired_at` greift dort unverändert).
Zeilen abgeschlossener Durchgänge sind bereits eingefroren - #2188 muss sie
nicht anfassen, weil nichts sie je wieder liest oder schreibt, solange das Set
nicht komplett gelöscht wird.

Eine Ausmusterung auf SET-Ebene (nicht nur pro Übung) existiert heute nicht
als eigenes Konzept - träte sie ein, gilt dieselbe Regel wie bei "Set
gelöscht".

---

## Was ausdrücklich nicht Gegenstand ist

- **Die Kennungsstabilität über Content-Updates.** Eigener Vorgang (AUTH-05),
  läuft parallel. Diese Exploration setzt sein Ergebnis voraus, entwirft es
  nicht mit.
- **Die Darstellung der Fehlerhistorie** (Diagramm, Liste, welche Zahlen wo).
  Nur die Datenanforderung ist hier Gegenstand.
- **Aufräumung oder Verdichtung alter Durchgänge.** Bewusst nicht gebaut,
  solange kein gemessenes Problem vorliegt.

---

## Zuschnitt für die Umsetzung (kleinster erster Wurf)

1. Schema-Erweiterung (`run_id` auf `ElementError`, neue `SetRun`/`setRuns`-
   Tabelle), beide Speichermodi, Migration mit Default, je ein Test pro Modus
   (#2053-Linie: eine Änderung ist erst bewiesen, wenn sie in BEIDEN Modi
   getestet ist).
2. Service-Schnitt: "Durchgang starten" (schließt alten, legt neuen an, eine
   Transaktion) + `runId`-Filter auf den Lesepfaden.
3. UI: "Set erneut durcharbeiten"-Aktion (nur bei Status `completed`), einfache
   Bestätigung ohne Zahlen, warme Anzeige der vorigen Historie in der
   Übungsansicht.
4. Backup: Versions-Bump + Rückwärtskompatibilitäts-Test (alte Sicherung ohne
   `run_id` importiert korrekt).
5. Waisen-Erweiterung in der bestehenden Aufräum-Maschinerie.

Die Fehlerhistorie-Funktion selbst (Lese-/Vergleichslogik, Darstellung) ist ein
eigener, hier bewusst nicht entworfener Vorgang, der auf demselben Modell
aufsetzt.
