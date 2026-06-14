# EXP-026: User-generierte Lektionen im Content-Baum (mit Badge)

**Kategorie:** Feature · **Phase:** 2 · **Priorität:** P3 (UX nice-to-have) ·
**Abhängig von:** EXP-002, EXP-003, EXP-021, EXP-023 · **Eng verzahnt mit:**
EXP-025 / AUTH-06 · **Issue:** #97

> Design-Dokument. Kein Code. Wird reviewed, bevor implementiert wird. #97 ist
> die View-seitige Hälfte des aus #45 abgespaltenen Themas (die Pfad-
> „Bug"-Hälfte von #45 wurde auditiert und widerlegt — Save/Read/Share sind
> korrekt). Kein Datenmodell-Eingriff: rein eine Sicht-Gruppierung über die
> bestehenden `user-generated`-Cache-Einträge.

---

## 1. Idee

### Worum geht es?

User-generierte Lektionen („Meine Lektionen", aus dem Lesson Creator EXP-021
oder dem Analysis-to-Lesson-Flow) erscheinen heute in einem **separaten**
Abschnitt des Content Browsers und sind **explizit aus dem
Quelle→Ziel→Level-Baum herausgefiltert** (`Content.tsx`, `content-tree.ts`
baut den Baum nur aus heruntergeladenen Sets).

**Vorschlag (#97):** Wenn die Metadaten eines user-generierten Sets
(`source_language` / `target_language` / `level`) zu einem **publizierten Set**
mit gleichem Sprachpaar + Level passen, sollen seine Lektionen **innerhalb des
Knotens dieses Sets** im Baum auftauchen — markiert mit einem Badge „Eigene
Lektion" / „Your lesson" —, sodass selbst erstellter Inhalt **neben den
offiziellen Lektionen sitzt, die er ergänzt**. Der eigenständige
„Meine-Lektionen"-Abschnitt bleibt als **Fallback** für Drafts, die zu keinem
existierenden Set passen (oder unvollständige Metadaten haben).

### Was sich ändert — und was nicht

| | Heute | Mit #97 |
|---|---|---|
| Darstellung user-gen. | eigener Abschnitt, aus dem Baum gefiltert | in den passenden Set-Knoten eingebettet, mit Badge |
| Fallback | — | unzuordenbare Drafts bleiben im „Meine Lektionen"-Abschnitt |
| Datenmodell | `user-generated`-Cache trägt source/target/level/`variation_of` | **unverändert** |
| Storage-Modi | API + Dexie | API + Dexie (Pflicht) |
| Fortschritt/SRS | pro `set_id`+Lektion+Element | **unberührt** (reine Sicht) |

Kernaussage: **das ist eine View-Layer-Gruppierung**, kein neuer Speicher, kein
Schema-Bump. Die Cache-Einträge tragen bereits alles Nötige
(`USER_GENERATED_SOURCE`, `source_language`, `target_language`, `level`,
optional `variation_of`).

### Abgrenzung zu EXP-025

EXP-025 (author-provided) bringt **fremden, publizierten** Inhalt über ein Repo
herein. EXP-026 ordnet **eigenen, lokalen** Inhalt in den Baum ein. Sie treffen
sich an genau einer Stelle: wenn ein Lerner ein **Author-Set lokal editiert**,
erzeugt AUTH-06 eine **abgespaltene user-generierte Kopie** — und diese Kopie
ist dann ein EXP-026-Fall (sie muss im Baum neben dem Original landen). Siehe
§ Schnittstelle.

---

## 2. Architektur-Optionen

### Option A — Sicht-Gruppierung in `buildContentTree` (empfohlen)

`buildContentTree` (oder ein dünner Wrapper) nimmt zusätzlich die
user-generierten Sets entgegen und faltet jede Lektion in den `LevelGroup`-
Knoten mit passendem (`baseLanguage(source)`, `baseLanguage(target)`, `level`).
Jede eingefaltete Lektion trägt ein Herkunfts-Flag fürs Badge. Kein Match →
Sammeltopf „Meine Lektionen" (Fallback, unverändert).

- **Pro:** minimaler, rein additiver Eingriff in eine bereits pure,
  unit-testbare Funktion; ein Ort für die Matching-Regel; beide Storage-Modi
  automatisch (die Funktion ist storage-agnostisch).
- **Contra:** `buildContentTree` muss user-gen. Sets als zweite Eingabe kennen;
  die Knoten-Datenstruktur braucht ein optionales „eigene Lektionen"-Feld.

### Option B — Eigener Placement-Resolver, geteilt mit der Share-Pipeline

Die Zuordnung „user-gen. Set → publizierter Knoten" als eigenständige Funktion
(`resolveTreePlacement`), wiederverwendet von der **placement-engine**
(Share Wizard, #48) und vom Content Browser. Eine Wahrheit für „wohin gehört
dieses Set".

- **Pro:** DRY mit der existierenden `placement-engine.ts`; konsistente
  Platzierung zwischen „teilen" und „anzeigen".
- **Contra:** etwas mehr Vorab-Abstraktion; die placement-engine zielt heute auf
  Repo-Pfade, nicht auf Baum-Knoten — Signatur-Angleichung nötig.

### Option C — User-gen. als virtuelles Overlay-Repo (Vision)

User-generierter Inhalt als virtuelle Quelle in der EXP-023-Ladereihenfolge
behandeln (überschreibt/ergänzt nach Set-ID-Regeln wie ein eigenes Repo).

- **Pro:** ein einheitliches Quell-/Precedence-Modell für alle Inhalte.
- **Contra:** überdimensioniert für #97; vermischt „lokaler Draft" mit
  „verbundenes Repo"; Precedence-/Dedupe-Risiken. Nicht für jetzt.

**Empfehlung:** Option A jetzt; die Matching-Regel so kapseln, dass sie später
trivial zu Option B (geteilt mit der placement-engine) gehoben werden kann.

### Matching-Regel

Ein user-gen. Set wird einem publizierten Knoten zugeordnet bei
**exakter Übereinstimmung** von `baseLanguage(source_language)` +
`baseLanguage(target_language)` + normalisiertem `level`. Für **Wissens-Domänen**
(`domain != language`, source == target) erfolgt die Zuordnung über
`domain` (+ optional Set-Titel), analog zum „Wissen"-Zweig des Baums.

### Badge-Taxonomie

Drei klar unterscheidbare Zustände (nicht nur Farbe — Text + Icon, a11y):

| Zustand | Badge | Quelle |
|---|---|---|
| Offizielle/Community-Lektion | (bestehendes Quell-Badge) | `isOfficialSource()` / Repo |
| Eigene Original-Lektion | „Eigene Lektion" / „Your lesson" | `user-generated`, kein `variation_of` |
| Eigene Bearbeitung einer fremden Lektion | „Eigene Bearbeitung" / „Your edit" | `user-generated` **mit** `variation_of` → Original |

Der dritte Zustand ist die **AUTH-06-Brücke** (siehe § Schnittstelle).

### Schnittstelle zu EXP-025 / AUTH-06 (die geforderte klare Definition)

AUTH-06 (EXP-025) erzeugt beim lokalen Editieren eines Author-Sets eine
**abgespaltene user-generierte Kopie**. Damit EXP-026 diese Kopie korrekt
**neben dem Original** im Baum platziert und richtig badged, gilt folgender
**Kontrakt** (AUTH-06 ist der Produzent, EXP-026 der Konsument):

1. **Platzierungs-Metadaten erben.** Der Fork **muss**
   `source_language` / `target_language` / `level` (bzw. `domain` für Wissen)
   **vom Original-Author-Set übernehmen**. Ohne diese Felder fällt die Lektion
   in den „Meine Lektionen"-Fallback statt neben das Original — der sichtbare
   Fehlerfall, den AUTH-06 vermeiden muss.
2. **Abstammung markieren.** Der Fork **muss** `variation_of` auf die
   Original-Set-/Lektions-ID setzen. Das ist das einzige Signal, an dem EXP-026
   „Eigene Bearbeitung" (Badge-Zustand 3) von „Eigene Original-Lektion"
   (Zustand 2) unterscheidet, und das die `duplicate-detection` (#48) nutzt, um
   Original und Fork zu paaren.
3. **Eigene ID, niemals In-place-Mutation.** Der Fork trägt eine **neue,
   eindeutige Set-ID** (`source: "user-generated"`); das Author-Set bleibt
   read-only und unverändert (AUTH-06-Entscheidung E6 in EXP-025). EXP-026
   rendert beide nebeneinander im selben Knoten.
4. **Richtungsklarheit.** EXP-026 liefert AUTH-06 **nicht** die Merge-/
   Konflikt-UX — es liefert nur Platzierung + Badge. Die „Meine / Autor /
   Beide"-Auflösung bei einem späteren Author-Update ist Sache von #97/EXP-026
   **nur insoweit**, als der geforkte Eintrag im Baum sichtbar bleibt; die
   eigentliche Merge-Entscheidung ist als Folge-Frage offen (siehe Q5).

Kurzform des Kontrakts: **AUTH-06 garantiert {source_language, target_language,
level (oder domain), variation_of, eigene ID}; EXP-026 garantiert dafür
korrekte Platzierung + den „Eigene Bearbeitung"-Badge.**

---

## 3. Technische Herausforderungen

### 3.1 Mehrdeutige Zuordnung

Mehrere publizierte Sets können dasselbe Paar + Level haben (z. B. zwei `de→es`
A1-Sets verschiedener Quellen). Eine user-gen. Lektion, die nur Paar+Level
trägt, ist dann **mehrdeutig**. → Entscheidung nötig (siehe Q1): an alle
passenden Knoten hängen, an den „besten" (z. B. `variation_of`-Treffer, sonst
offizielles Set bevorzugt), oder bei Mehrdeutigkeit in den Fallback.

### 3.2 Unvollständige / abweichende Metadaten

Alt-Drafts (vor der Import-Pipeline #54) können Paar/Level fehlen oder
`source == target` bei `domain: language` tragen. → Solche Lektionen bleiben im
Fallback-Abschnitt (nie raten). Das deckt sich mit der Source-Language-Regel
(am Import gesetzt, downstream geerbt — lessons-learned).

### 3.3 Beide Storage-Modi

`buildContentTree` ist storage-agnostisch (bekommt fertige Einträge). Beide
Modi müssen die user-gen. Sets gleich laden (`listSets()` gefiltert auf
`USER_GENERATED_SOURCE`) und gleich einspeisen. Dexie-Mode ist Vertragsteil
(lessons-learned „Dexie-mode is part of the contract") — `make test-dexie-smoke`
muss den Content Browser mit eingefalteten Lektionen grün durchlaufen.

### 3.4 Sortierung, Suche, Counts

- **Sortierung** innerhalb eines Level-Knotens: offizielle Lektionen zuerst,
  eigene danach (oder nach Aktivität) — konsistent festlegen.
- **Set-Counts** (`setCount` pro Knoten) dürfen eigene Lektionen nicht
  doppelzählen; ggf. „X Lektionen (+Y eigene)".
- **Suche** (`content-search.ts`): eingefaltete eigene Lektionen müssen
  auffindbar bleiben; die Suche darf nicht nur den heruntergeladenen Index
  sehen.

### 3.5 Fortschritt/SRS unberührt

Reine Sicht: keine Änderung an `LessonProgress` / `ElementError`. Die Platzierung
ändert keine IDs, also keinen Fortschritt. (Wichtig, weil eine ID-Änderung den
Fortschritt verwaisen ließe — dieselbe ID-Stabilitäts-Disziplin wie EXP-025 §3.3.)

### 3.6 Aktionen am eingefalteten Knoten

Eigene Lektionen tragen im Baum dieselben Aktionen wie im „Meine Lektionen"-
Abschnitt (Play / Edit / Delete / Export / Share). Das Aktions-Set darf nicht
auseinanderdriften (eine geteilte Komponente, nicht zwei Pfade — vgl. die
backup-button-Parität, #331).

---

## 4. Roadmap-Tasks

Prefix **UGC-** (user-generated content). Reihenfolge = grobe Abhängigkeit; alles
additiv und view-seitig.

| ID | Task | Bezug | Aufwand |
|---|---|---|---|
| **UGC-01** | Matching-Regel als pure Funktion (`resolveTreePlacement`): user-gen. Set → passender publizierter Knoten (Paar+Level / Domäne), Mehrdeutigkeits-Policy, Fallback bei keinem/uneindeutigem Match | §2, §3.1 | S |
| **UGC-02** | `buildContentTree` erweitern: user-gen. Lektionen in `LevelGroup`/`DomainGroup` einfalten, Herkunfts-Flag pro Lektion, `setCount` korrekt | §2 Option A | M |
| **UGC-03** | Badge-Taxonomie rendern: „Eigene Lektion" / „Eigene Bearbeitung" (variation_of) + bestehendes Quell-Badge; Text+Icon, a11y, i18n (8 Sprachen) | §2 Badge | S |
| **UGC-04** | Content Browser: eingefaltete Knoten + Fallback-Abschnitt „Meine Lektionen" nur noch für unzuordenbare Drafts; geteiltes Aktions-Set (Play/Edit/Delete/Export/Share) | §3.6 | M |
| **UGC-05** | Suche + Counts: eingefaltete eigene Lektionen indexieren; Count-Anzeige „N (+Y eigene)" | §3.4 | S |
| **UGC-06** | **AUTH-06-Kontrakt absichern:** Test-Pin, dass ein geforkter Author-Set-Eintrag {source/target/level, variation_of, eigene ID} trägt und neben dem Original mit „Eigene Bearbeitung" landet | § Schnittstelle | S |
| **UGC-07** | Tests: pure Matching-Tests (Mehrdeutigkeit, fehlende Metadaten, Domäne), Content.tsx-Render, `make test-dexie-smoke`-Durchlauf mit eingefalteten Lektionen | §3.3 | M |

---

## 5. Offene Fragen

1. **Mehrdeutige Zuordnung (§3.1):** eine user-gen. Lektion mit Paar+Level, das
   auf mehrere publizierte Sets passt — an alle hängen, an das „beste"
   (`variation_of` > offiziell > erstes), oder in den Fallback? *Empfehlung:*
   `variation_of`-Treffer gewinnt; sonst Fallback (nicht raten).
2. **Sortierung im Knoten:** offizielle zuerst + eigene danach, oder gemischt
   nach letzter Aktivität? *Empfehlung:* offizielle zuerst, eigene als
   abgesetzter Block darunter (klare Trennung).
3. **Domänen-Wissen:** reicht `domain`-Match, oder braucht es zusätzlich einen
   Titel-/Themen-Abgleich, um nicht alles unter eine Domäne zu kippen?
   *Empfehlung:* `domain` + exakter Set-Titel, sonst Fallback.
4. **Fallback-Sichtbarkeit:** „Meine Lektionen"-Abschnitt immer zeigen (auch
   wenn leer, als Einstieg zum Erstellen) oder nur bei Inhalt? *Empfehlung:*
   nur bei Inhalt; Erstellen-Einstieg lebt ohnehin in der Toolbar.
5. **Author-Update bei vorhandenem Fork (Brücke zu AUTH-06):** wenn der Autor
   ein Set aktualisiert, das der Lerner geforkt hat — wie wird der Fork im Baum
   behandelt (weiter neben dem neuen Original zeigen; „Original aktualisiert"-
   Hinweis am Fork)? Die eigentliche Merge-UX bleibt offen und ist gemeinsam
   mit AUTH-06 zu entwerfen. *Empfehlung:* für EXP-026 nur Sichtbarkeit +
   Hinweis; Merge separat.
6. **Set- vs. Lektions-Granularität:** faltet EXP-026 ganze user-gen. *Sets*
   oder einzelne *Lektionen* ein? (Ein user-gen. Set kann mehrere Lektionen
   haben.) *Empfehlung:* auf Lektionsebene einfalten, damit eine einzelne
   ergänzende Lektion exakt neben der passenden offiziellen sitzt.

---

## Entscheidungen

Provisorische Festlegungen aus den Empfehlungen in §5; bindend für die
UGC-Tasks, revidierbar bei Gegenargumenten in der Umsetzung. (Im Gegensatz zu
EXP-025 ist EXP-026 noch **nicht** freigegeben — diese Entscheidungen sind der
Vorschlag zur Freigabe.)

- **E1 (zu Q1) — Mehrdeutigkeit:** `variation_of`-Treffer platziert eindeutig;
  ohne ihn bei mehreren Kandidaten → Fallback (nie raten).
- **E2 (zu Q2) — Sortierung:** offizielle Lektionen zuerst, eigene als optisch
  abgesetzter Block darunter.
- **E3 (zu Q3) — Domäne:** `domain` + exakter Set-Titel; sonst Fallback.
- **E4 (zu Q4) — Fallback-Abschnitt:** nur bei Inhalt sichtbar.
- **E5 (zu Q5) — Author-Update/Fork:** EXP-026 zeigt den Fork weiter neben dem
  (aktualisierten) Original und setzt einen „Original aktualisiert"-Hinweis; die
  Merge-Auflösung wird mit AUTH-06 separat entworfen, nicht hier.
- **E6 (zu Q6) — Granularität:** Einfalten auf **Lektionsebene**.

---

## Schnittstellen-Kontrakt (Kurzreferenz)

```
AUTH-06 (EXP-025, Produzent)  ──liefert──►  EXP-026 (Konsument)
  Fork eines Author-Sets:                     Platzierung + Badge:
   - source_language  (geerbt)                 - matcht Knoten (Paar+Level/Domäne)
   - target_language  (geerbt)                 - Badge "Eigene Bearbeitung"
   - level / domain   (geerbt)                 - neben Original im selben Knoten
   - variation_of     → Original-ID            - duplicate-detection paart beide
   - neue eigene Set-ID, read-only Original
```

EXP-026 liefert AUTH-06 **keine** Merge-/Konflikt-UX — nur Platzierung + Badge.
Die Merge-Entscheidung („Meine / Autor / Beide") ist eine offene Folge-Frage
(Q5), gemeinsam zu entwerfen.

---

## Bewertung

#97 ist die saubere, kleine UX-Hälfte: rein view-seitig, kein Datenmodell, beide
Modi quasi geschenkt, weil `buildContentTree` storage-agnostisch ist. Der
inhaltliche Kern ist die **Matching-Regel** (UGC-01) und die **Badge-Taxonomie**
(UGC-03) — und die explizite **AUTH-06-Schnittstelle**, die verhindert, dass
EXP-025 und EXP-026 zwei zueinander blinde Konstruktionen werden.

Empfohlener Schnitt: Option A (Einfalten in `buildContentTree`) mit gekapselter
Matching-Regel (UGC-01), die später trivial zu Option B (geteilt mit der
placement-engine) wird. Der einzige echte Designknoten ist die Mehrdeutigkeit
(§3.1 / E1) — konservativ über `variation_of` + Fallback gelöst. Die
Merge-UX bei Author-Updates (Q5) bewusst ausgeklammert und an AUTH-06 gekoppelt.
