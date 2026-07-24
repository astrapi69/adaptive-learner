# Meine Lektionen: erstellen, speichern, teilen

**Meine Lektionen** sind Lektionen, die *du* erstellst — im selben
offline-spielbaren Format wie heruntergeladene Inhaltssets. Du kannst
aus einem analysierten Chat eine Lektion erzeugen, eine gute adaptive
Lektion zum Wiederholen speichern, eine Lektion zum Teilen
exportieren und von anderen geteilte Lektionen importieren. Alles
funktioniert offline; nichts wird auf einen Server hochgeladen.

Du findest „Meine Lektionen" oben im **Set-Browser** (`/content`),
über den heruntergeladenen Sets.

---

## Eine Lektion aus einer Chat-Analyse erstellen

1. Importiere einen Chat und **analysiere** ihn (siehe *Import*).
2. Klicke im Analyse-Ergebnis auf **Als Offline-Lektion speichern**.
3. Eine Vorschau zeigt den Aufbau der Lektion — wie viele Übungen und
   Theorie-Schritte, die geschätzte Dauer. Passe bei Bedarf den Titel
   an.
4. Klicke auf **Speichern**. Die Lektion erscheint unter **Meine
   Lektionen**.

Die Lektion entsteht aus dem, was die Analyse gefunden hat:

- **Theorie** aus Thema, Zusammenfassung, Unterthemen, deinen Stärken
  und Schwächen, häufigen Fehlermustern und einem vorgeschlagenen
  Lernplan.
- **Übungen** aus dem extrahierten Vokabular — Zuordnung und
  Übersetzung-eintippen pro Wort, dazu Lückentext und Satz-Ordnen aus
  vorhandenen Beispielsätzen.

Je reichhaltiger die Analyse (besonders Vokabeln mit Beispielsätzen),
desto reichhaltiger die Lektion. Gibt es zu wenige Vokabeln, erhältst
du einen **reinen Theorie-Leitfaden** und einen Hinweis, einen
längeren Chat für mehr Übungsmaterial zu importieren.

Erzeugte Lektionen laufen im normalen Lektions-Viewer mit voller
Bewertung — genau wie eine heruntergeladene Lektion.

---

## Spielen, bearbeiten, löschen

Jede eigene Lektion bietet:

- **Spielen** — im Lektions-Viewer öffnen.
- **Bearbeiten** — öffnet den **Lektions-Creator vorbefüllt** mit den
  Metadaten, Karten und Übungen der Lektion. Enthält ein eigenes Set
  **mehrere Lektionen**, fragt zuerst ein **Lektions-Picker**, welche
  du bearbeiten willst. Buchtext-Lektionen öffnen direkt den
  Übungs-Editor; hinterlegte Buchangaben bleiben erhalten. Beim
  Speichern wählst du: **Änderungen speichern** (überschreibt dieselbe
  Lektion — dein Lernfortschritt bleibt für unveränderte Karten
  erhalten, geänderte starten neu) oder **Als Kopie speichern** (legt
  eine neue Lektion an, das Original bleibt unangetastet).
  Analyse-basierte Lektionen öffnen weiterhin die zugrunde liegende
  Chat-Analyse. Fremde (heruntergeladene) Lektionen bleiben
  schreibgeschützt.
- **Löschen** — entfernen (mit Bestätigung).

---

## Mehrere Lektionen zu einem Set kombinieren

Über **„Zu einem Set kombinieren"** in „Meine Lektionen" wählst du
mehrere eigene Lektionen per Häkchen aus und fasst sie zusammen —
entweder in ein **neues Set** (Titel, optionale Beschreibung,
Niveau) oder in ein **bestehendes eigenes Set**. Mischt die Auswahl
Sprachen oder Niveaus, weist ein Hinweis darauf hin (das Set
übernimmt die häufigste Kombination — nichts wird blockiert).
Kollidierende Lektionsdateien bekommen automatisch ein
Nummern-Suffix statt sich zu überschreiben. Das kombinierte Set ist
ein normales eigenes Set und lässt sich wie gewohnt spielen,
exportieren und teilen.

---

## Eine adaptive Lektion speichern

Wenn du eine **adaptive Lektion** beendest, erscheint in der
Zusammenfassung die Schaltfläche **Diese Lektion speichern?**. Beim
Speichern wird eine Momentaufnahme abgelegt, die du später aus „Meine
Lektionen" wiederholen kannst — praktisch, wenn eine adaptive Sitzung
besonders nützlich war. Die Momentaufnahme bleibt spielbar, auch wenn
sich der adaptive Generator in einer späteren Version ändert.

---

## Exportieren und teilen

Jede eigene Lektion lässt sich teilen — ohne Konto und ohne Server:

- **Exportieren** — die Lektion als einzelne `.json`-Datei
  herunterladen.
- **Als Content-Set exportieren** — ein Content-Set als `.zip`
  herunterladen (Manifest + Lektionen).
- **Für die Community bereitstellen** — öffnet einen vorausgefüllten
  **Pull Request** im offiziellen Inhalts-Repository. Die Lektions-JSON
  landet am richtigen Pfad im Inhaltsbaum und die Validierung des
  Repositorys läuft automatisch; ein Maintainer prüft den PR und führt
  ihn zusammen, sodass alle die Lektion herunterladen können. Kleine
  Lektionen öffnen direkt den Datei-Editor von GitHub (PR-Titel und
  -Beschreibung sind vorausgefüllt); größere Lektionen werden zuerst
  heruntergeladen und öffnen die Upload-Seite von GitHub, auf die du
  die Datei ziehst. Es ist kein Token nötig — GitHub erstellt den Fork
  und den Pull Request für dich.

Exportierte Dateien enthalten nur den Lektionsinhalt — keinen
Fortschritt, keine Fehlerhistorie, nichts Persönliches.

---

## Eine Lektion importieren

Klicke auf **Lektion importieren**, wähle eine `.json`-Lektion oder
ein `.zip`-Set, und die App validiert sie und zeigt eine Vorschau.
Bestätige, um sie zu „Meine Lektionen" hinzuzufügen. Ist die Datei
ungültig, siehst du einen konkreten Grund statt eines kaputten
Imports.

So schließt sich der Kreis: Eine lernende Person exportiert eine
Lektion, eine andere importiert und spielt sie — vollständig offline.
