# EXP-031: ZIP-basiertes Backup-Format (.alb)

**Kategorie:** Feature · **Phase:** Zukunft (additiv, kein Breaking Change) ·
**Priorität:** Mittel · **Abhängig von:** dem bestehenden Backup-Export/-Import
(`storage/backup.ts`, `backend/app/services/backup_export.py`, der
`IStorageService.backup`-Namespace), der Pre-Import-Validierung
([#642](https://github.com/astrapi69/adaptive-learner/issues/642),
`lib/backup/validateBackupFile.ts`), EXP-005 (Offline-Modus) · **Issue:** —

> Design-Dokument. Kein Code. Es beschreibt, **wie** Adaptive Learner sein
> Backup-Format von rohem JSON auf ein ZIP-Container-Format mit eigener
> Dateiendung (`.alb` — *Adaptive Learner Backup*) umstellt, **ohne** ein
> einziges bestehendes Backup unlesbar zu machen. Die zentrale Aussage: ein
> Container statt einer nackten JSON-Datei macht das Backup **eindeutig
> erkennbar**, **deutlich kleiner**, **erweiterbar** (Binär-Assets als echte
> Dateien) und erlaubt einen **Versions-Check VOR dem Import** — alles
> client-seitig, ohne Backend.

---

## 0. Was es heute schon gibt (Ist-Stand)

- **Export:** eine rohe JSON-Datei (`backup-YYYY-MM-DD.json`), Top-Level
  `{format: "adaptive-learner-backup", version, app_version, created_at,
  user_id, storage_mode, data, content_sets?, stats}`. Erzeugt identisch in
  beiden Modi (`createDexieBackup` / `backup_export.py`).
- **Import:** liest die JSON, validiert seit [#640](https://github.com/astrapi69/adaptive-learner/issues/640)/[#642](https://github.com/astrapi69/adaptive-learner/issues/642)
  über `readBackupFile` (Marker `format` + String-`version` + Objekt-`data`,
  100-MB-Größengrenze) und meldet eine fremde/ungültige Datei freundlich,
  statt zu crashen.
- **Binärdaten:** das Profilbild reist heute als **Base64-String im JSON**
  (`user_settings.avatar`), was ~33 % Overhead kostet und das JSON aufbläht.

Der `format`-Marker reicht, um „ist das von uns?" zu beantworten — aber die
Datei sieht für den Nutzer aus wie *irgendein* JSON (Verwechslungsgefahr beim
Datei-Picker) und ist unnötig groß (JSON ist hochrepetitiv).

---

## 1. Idee

Das Backup-Format von roher JSON auf einen **ZIP-Container** mit eigener
Dateiendung umstellen: **`.alb`** (*Adaptive Learner Backup*) — analog zu
Bibliogons `.bgb`-Format. Eine `.alb`-Datei ist ein Standard-ZIP; der Inhalt
bleibt das gleiche Datenmodell wie heute, nur strukturiert und komprimiert.

---

## 2. Format-Spezifikation

Eine `.alb`-Datei ist ein **Standard-ZIP** (deflate) mit:

```
backup-2026-06-16.alb   (ZIP)
├── manifest.json        # Metadaten — VOR dem Import lesbar
├── data.json            # die eigentlichen Backup-Daten (heutiges Format)
└── assets/              # optional, binär
    ├── avatar.jpg       # Profilbild als echte Datei (nicht Base64)
    └── …                # weitere Binärdaten in Zukunft
```

### manifest.json

```json
{
  "format": "adaptive-learner-backup",
  "container": "alb",
  "app_version": "1.83.0",
  "schema_version": "1.3.0",
  "created_at": "2026-06-16T18:00:00.000Z",
  "backup_type": "full",
  "user_id": "…",
  "storage_mode": "dexie",
  "assets": ["assets/avatar.jpg"],
  "stats": { "total_records": 1234, "tables": { … } }
}
```

- `backup_type`: `"full"` | `"selective"` (siehe BAK-06).
- `schema_version` trennt das **Daten-Schema** von der **App-Version** — so
  kann der Import warnen „dieses Backup ist Schema 1.2, die App liest 1.3".
- `assets[]` listet die enthaltenen Binärdateien (Manifest ist die
  Wahrheit, nicht das Durchlaufen des ZIP).

### data.json

Exakt das heutige Backup-Payload-Format (`data`-Segment + `content_sets`),
**minus** der inline-Base64-Felder, die als Asset ausgelagert wurden (z.B.
`user_settings.avatar` → `assets/avatar.jpg`, im Datensatz durch einen
Verweis ersetzt). Damit bleibt der bestehende, getestete Restore-Code für die
Tabellendaten unverändert.

---

## 3. Migration (kein Breaking Change)

- **Import akzeptiert BEIDE Formate.** Erkennung über **Magic Bytes**: beginnt
  die Datei mit der ZIP-Signatur `PK\x03\x04` (`0x50 0x4B 0x03 0x04`), wird sie
  als `.alb` entpackt; sonst als Legacy-JSON geparst. Kein Rückgriff auf die
  Dateiendung (die Nutzer umbenennen).
- **Export schreibt nur noch `.alb`.** Bestehende `.json`-Backups bleiben
  unbegrenzt importierbar — der Legacy-Pfad wird nicht entfernt.
- **Single source of truth bleibt der `format`-Marker** (jetzt in
  `manifest.json` statt Top-Level der JSON). Die Pre-Import-Validierung aus
  [#642](https://github.com/astrapi69/adaptive-learner/issues/642) wird um
  einen ZIP-Zweig erweitert: ZIP öffnen → `manifest.json` validieren →
  `data.json` durch den **gleichen** `validateBackupPayload` schicken.

```
readBackupFile(file):
  bytes = erste 4 Bytes
  wenn bytes == PK\x03\x04:  → ZIP entpacken, manifest.json + data.json prüfen
  sonst:                     → JSON parsen, validateBackupPayload (heute)
```

---

## 4. Technische Details

- **Dependency:** `fflate` (~30 KB, schnell, kein Legacy-Ballast) gegenüber
  `JSZip` (~180 KB). Beide rein client-seitig, kein Backend. Empfehlung:
  **fflate** (siehe offene Frage 2).
- **Kompression:** `deflate` (Standard-ZIP). JSON ist hochrepetitiv →
  typisch **80–90 % kleiner**.
- **Größengrenze:** **unkomprimiert** prüfen, nicht komprimiert. Ein 1-GB-JSON,
  das auf 50 MB komprimiert, ist beim Entpacken trotzdem zu groß für den
  Main-Thread. Die `MAX_BACKUP_BYTES`-Grenze aus [#642](https://github.com/astrapi69/adaptive-learner/issues/642)
  gilt für die **entpackte** Größe (aus dem ZIP-Header / Manifest ableitbar,
  bevor entpackt wird — Schutz gegen Zip-Bomben).
- **BACKUP-AKZEPTANZTEST:** der Round-Trip bleibt Pflicht — Export `.alb` →
  Import `.alb` → real verifizieren (echte Daten, nicht nur Unit-Tests, siehe
  `.claude/rules/quality-checks.md`). Zusätzlich ein Cross-Format-Test:
  Legacy-`.json` → Import bleibt grün.

---

## 5. Vorteile

- **Eindeutige Dateiendung** — `.alb` ist im Datei-Picker nicht mit beliebigem
  JSON zu verwechseln (ergänzt die #642-Validierung am anderen Ende).
- **80–90 % kleiner** — JSON komprimiert exzellent.
- **Profilbild als echte Datei** statt Base64 im JSON spart ~33 % Overhead für
  das Bild und hält `data.json` schlank.
- **Versions-Check VOR dem Import** — das Manifest ist ohne Entpacken der
  Daten lesbar: „Diese Backup-Datei ist von Version 1.50, deine App ist 1.83.
  Trotzdem importieren?" (statt blind zu importieren).
- **Erweiterbar** — weitere Assets (Audio, Bilder, künftige Binärformate) ohne
  JSON-Schema-Änderung; das Manifest listet sie auf.

---

## 6. Roadmap

| ID | Aufgabe | Größe |
| --- | --- | --- |
| **BAK-01** | `JSZip` vs. `fflate` evaluieren + Dependency-Entscheidung | S |
| **BAK-02** | `.alb`-Export (manifest.json + data.json, ZIP/deflate), beide Modi | M |
| **BAK-03** | `.alb`-Import mit Magic-Byte-Erkennung + Legacy-JSON-Fallback | M |
| **BAK-04** | Avatar als Asset (`assets/avatar.jpg`) statt Base64 in `data.json` | S |
| **BAK-05** | BACKUP-AKZEPTANZTEST auf `.alb` erweitern (+ Cross-Format-Test) | S |
| **BAK-06** | Selektiver Export als `.alb` (`manifest.backup_type: "selective"`) | S |

Reihenfolge: BAK-01 → BAK-02 → BAK-03 zuerst (Container steht, beide Formate
laufen), dann BAK-04/06 (Assets, Selective), BAK-05 begleitet BAK-02/03 als
Gate.

---

## 7. Offene Fragen

1. **Dateiendung: `.alb`, `.albk` oder einfach `.zip`?**
   *Empfehlung:* `.alb` — kurz, eindeutig, wie Bibliogons `.bgb`. `.zip` lädt
   Nutzer ein, von Hand hineinzufassen; `.alb` signalisiert „App-Artefakt".
2. **Dependency: `JSZip` (180 KB) vs. `fflate` (30 KB)?**
   *Empfehlung:* `fflate` — kleiner, schneller, kein Legacy. Reicht für
   ZIP-deflate read+write vollständig.
3. **Verschlüsselung: optionaler Passwort-Schutz?**
   *Empfehlung:* nicht in Phase 1. Später als Option (das Manifest kann ein
   `encrypted`-Flag tragen; der Daten-Eintrag wird dann ein verschlüsselter
   Blob). Erst liefern, wenn jemand danach fragt.
4. **Soll der selektive Export auch `.alb` nutzen?**
   *Empfehlung:* ja — gleiches Format, das Manifest trägt
   `backup_type: "selective"`. Ein Format, ein Code-Pfad, ein Test.

---

## 8. Bezug zu anderen EXPs / Issues

- **[#642](https://github.com/astrapi69/adaptive-learner/issues/642) /
  [#640](https://github.com/astrapi69/adaptive-learner/issues/640):** die
  Pre-Import-Validierung ist die andere Hälfte desselben Ziels — „die App weiß
  sofort, ob eine Datei ein gültiges Backup ist". `.alb` (Magic Bytes +
  Manifest) macht diese Erkennung robuster; `validateBackupFile.ts` ist der
  Anknüpfungspunkt für den ZIP-Zweig.
- **EXP-005 (Offline-Modus):** alles client-seitig, kein Backend nötig — passt
  zum Offline-First-Prinzip.
- **EXP-030 (Multi-User):** pro-Profil-Backups als `.alb` mit `user_id` im
  Manifest fügen sich nahtlos in die lokale-Profile-Stufe ein.
