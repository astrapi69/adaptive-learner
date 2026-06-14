# EXP-025: Author-provided Lesson Sets (Buch-Begleitlektionen)

**Kategorie:** Vision · **Phase:** B/C (auf EXP-023 aufsetzend) · **Priorität:**
P3 (Vision) · **Abhängig von:** EXP-023, EXP-003, #141 (books.yaml), #122/#124
· **Issue:** #142

> Design-Dokument. Kein Code. Wird reviewed, bevor irgendetwas implementiert
> wird. Ziel ist zu klären, dass author-provided lesson sets **keine neue
> Architektur** brauchen, sondern ein Anwendungsfall von EXP-023 plus ein paar
> additive Content-Konventionen sind.

---

## 1. Idee

### Was sind author-provided lesson sets?

Ein **Autor** (Buchautor, Kursleiter, Verlag) veröffentlicht ein vollständiges,
kuratiertes, versioniertes **Content-Repository** mit Begleitlektionen zu einem
**publizierten Werk**. Die App zeigt auf das Buch, das Buch zeigt auf die App:
ein Leser des Buchs verbindet das Begleit-Repo und vertieft die Inhalte als
adaptive Lektionen; ein App-Nutzer entdeckt das Buch über die Begleitlektionen.

Konkretes Beispiel (aus #142): *„KI für Einsteiger"* (Asterios Raptis) liefert
ein eigenes Content-Repo mit Begleitlektionen. Das Buch ist bereits in der
bestehenden `books.yaml` registriert (Domain `ai`), inkl. ISBN/ASIN/URL — die
Brücke „Buch ↔ Repo" ist also halb gebaut.

### Abgrenzung zu user-generierten Lektionen

| Dimension | User-generiert (EXP-021 / heute) | Author-provided (EXP-025) |
|---|---|---|
| Ursprung | im Lesson Creator in der App erstellt | außerhalb der App authored, in einem Repo publiziert |
| Granularität | meist Einzellektion / kleines Set | vollständiges, kuratiertes Set (Buchstruktur) |
| Speicherort | lokaler Cache, `source: "user-generated"` | externes Content-Repo (EXP-023), gecacht mit Quell-Metadatum |
| Sichtbarkeit | privat; optional via PR ans offizielle Repo geteilt | öffentlich (oder Coach-privat), read-only für Konsumenten |
| Versionierung | keine formale (Draft-Autosave) | git/semver, gebunden an Buch-Edition |
| Vertrauen | Trust 0 (eigener Inhalt) | Trust 1 (technisch validiert) bis Trust 3 (offiziell empfohlen) |
| Update | manuell neu erstellt | Repo-Sync (manuell + 24h-Auto, EXP-023 Phase A) |
| Pädagogische Absicht | ad-hoc, persönlich | begleitet ein didaktisches Gesamtwerk |
| Querverweis | keiner | bidirektionaler Link Buch (`books.yaml`) ↔ Repo |

**Kernunterschied in einem Satz:** user-generiert ist *persönlicher,
flüchtiger* In-App-Output; author-provided ist ein *publiziertes, versioniertes,
buch-verknüpftes* Content-Produkt, das über die Multi-Repo-Infrastruktur
konsumiert wird.

---

## 2. Architektur-Optionen

Die Integration läuft vollständig über EXP-023 (Multi-Content-Repository). Ein
author-provided Repo **ist** ein Community-Repo (EXP-023 Repo-Typ „Community")
mit zusätzlichen, additiven Buch-Metadaten. Drei abgestufte Optionen, von
minimal bis tief integriert.

### Option A — Reine Content-Konvention (empfohlen für den Einstieg)

Ein Begleit-Repo ist ein normales Community-Repo. Die Buch-Bindung lebt
ausschließlich in **additiven Metadaten** im Repo-Root-Manifest (z. B. ein
`book`-Block). Kein Sonderpfad im Code: der bestehende Lade-, Cache- und
Validierungsweg (EXP-023 Phase A/B) trägt es unverändert.

- **Pro:** null Architektur-Umbau; sofort über `/add-repo`-Deeplink + QR (#122)
  verbindbar; funktioniert in beiden Storage-Modi out of the box.
- **Contra:** keine besondere Darstellung — der Leser sieht ein Set wie jedes
  andere, der „Buch-Begleiter"-Charakter ist nicht sichtbar.

### Option B — Buch-Begleiter als sichtbares Flavor

Wie A, plus eine **dedizierte Darstellung** im Content Browser: Buchcover,
Autor, Edition, ein dezenter „Zum Buch"-Link. Erfordert ein additives
Metadaten-Schema (siehe AUTH-01) und ein Rendering im Set-/Repo-Header.

- **Pro:** macht den Begleiter-Charakter erlebbar; nutzt die vorhandene
  `book-recommendations`-Renderlogik (#141) wieder.
- **Contra:** ein additiver Schema-Bump + i18n + Rendering in beiden Modi.

### Option C — Bidirektionale Buch-Integration (Vision)

Wie B, plus **Querverweis in beide Richtungen** mit `books.yaml` (#141): ein
Buch verweist via optionalem `companion_repo`-Feld auf sein Begleit-Repo; das
Repo verweist via `book`-Block zurück. Discovery: kuratierte
`recommended-repos.json` (#124) führt Begleit-Repos als „offiziell empfohlen"
(Trust 3); aus der Buchempfehlung heraus ist das Begleit-Repo mit einem Klick
verbindbar.

- **Pro:** schließt den Kreis „App ↔ Buch"; Entdeckung von beiden Seiten.
- **Contra:** berührt mehrere Subsysteme (Content Browser, Buchempfehlungen,
  Discovery); echte „Verifizierter Autor/Verlag"-Vertrauensstufen brauchen ein
  geteiltes Backend und bleiben deferred (EXP-023 Phase C).

### Trust Levels

Author-provided Repos nutzen die **bestehende** EXP-023-Trust-Skala unverändert:

| Level | Bedeutung für ein Begleit-Repo |
|---|---|
| 0 | manuell per URL hinzugefügt, ungeprüft |
| 1 | `validate_content.py` bestanden, kein executable content (automatisch beim Sync) |
| 2 | community-geprüft (Rating/Nutzung) — **deferred**, braucht Backend |
| 3 | maintainer-kuratiert in `recommended-repos.json` → „offiziell empfohlen" |

Ein selbstpublizierender Autor landet realistisch bei **Trust 1**; ein vom
Maintainer kuratiertes Begleit-Repo (wie das hauseigene *KI-für-Einsteiger*-Repo)
erreicht **Trust 3** ohne neue Infrastruktur (rein über die statische
`recommended-repos.json`). Eine echte „verifizierter Verlag"-Stufe ist explizit
nicht Teil dieses EXP.

### Versionierung & Update-Mechanismus

- **Set-Version:** das vorhandene `version`-Feld pro Set (semver im Manifest,
  EXP-023). Eine neue **Buch-Edition** → neue Set-Version (nicht neue Set-ID),
  damit der Lernfortschritt erhalten bleibt (siehe §3).
- **Dedupe/Precedence:** identische Set-ID aus zwei Quellen → höhere Version
  gewinnt; bei Gleichstand offizielles vor gecachtem Bundle (bestehende
  `dedupeContentEntries`/`compareVersions`-Logik).
- **Update:** kein neuer Mechanismus — der EXP-023-Repo-Sync (manuell +
  Auto-Sync, „älter als 24h") zieht neue Versionen; offline bleibt der Cache
  nutzbar.

---

## 3. Technische Herausforderungen

### 3.1 Schema-Kompatibilität

- Begleit-Repos müssen `validate_content.py` bestehen (Schema **v1.3**, ein
  JSON pro Lektion; LESSON-FORMAT.md). Die **v1.4**-Vier-Datei-Bündel sind noch
  nicht ladbar — Autoren-Tooling muss bis zum v1.4-Loader auf v1.3 zielen.
- Der Manifest-Parser hat bereits **forward-compatible schema-version gating**:
  ein Repo mit höherem `schema_version` als die installierte App darf nicht
  hart fehlschlagen, sondern muss sauber degradieren (Set überspringen +
  Hinweis „App aktualisieren"), statt den ganzen Browser zu brechen.
- Neue Buch-Metadaten (AUTH-01) müssen **additiv** sein: ältere Apps ignorieren
  unbekannte Felder, ältere Repos ohne `book`-Block laden unverändert.

### 3.2 Konflikt mit user-editierten Versionen

Der schwierigste Punkt, überlappt mit **#97** (user-generierte Lektionen in den
Content-Baum mergen):

- EXP-023-Ladereihenfolge: ein **eigenes** User-Repo überschreibt bei gleicher
  Set-ID das offizielle. Namespacing `{username}/{set}` verhindert
  ID-Kollisionen *zwischen* Quellen.
- Offene Bruchstelle: Ein Lerner editiert lokal eine Lektion **aus** einem
  Author-Repo (`saveUserSet`), danach publiziert der Autor ein Update. Das ist
  ein **Fork**. Es braucht eine Konflikt-Policy: „Meine Version behalten" /
  „Autor-Update übernehmen" / „Beide behalten" (lokale Kopie umbenennen).
- Empfehlung: für EXP-025 read-only konsumieren; lokales Editieren eines
  Author-Sets erzeugt explizit eine **abgespaltene user-generierte Kopie**
  (eigene ID), statt das Author-Set in-place zu mutieren. Die echte
  Merge-UX wird mit **#97** zusammen entworfen, nicht hier.

### 3.3 Offline-Sync & Fortschritts-Erhalt

- Cache trägt die Repo-Quelle (Dexie `contentSets`/`contentSetFiles`,
  EXP-023). Offline bleibt der Begleit-Content nutzbar; online synct nur Deltas.
- **Stabile IDs sind Pflicht:** Lernfortschritt ist über `set_id` + Lektions-ID
  + Element-ID verankert (R-M-W-Storage, #390). Wenn ein Autor beim Update
  Lektionen umnummeriert oder Card-IDs ändert, **verwaisen** Fortschritt und
  Element-Fehlerhistorie. → Autoren-Doku muss „IDs sind ein Vertrag, nie
  umbenennen" festschreiben; optional eine versionssensible
  Fortschritts-Migration (Best-effort-Remap), sonst sauberes Reset mit Hinweis.
- **Beide Storage-Modi** sind Vertragsbestandteil (lessons-learned „Dexie-mode
  is part of the contract"): jedes neue Feld/Rendering muss in API- **und**
  Dexie-Modus funktionieren oder sauber degradieren — same commit.

### 3.4 Metadaten, Lizenz, Privacy, Security

- **Buch-Metadaten** (AUTH-01): additive, optionale Felder, an `books.yaml`
  angelehnt (`title`, `author`, `url` erforderlich; `subtitle`, `isbn`, `asin`,
  `language`, `pages`, `year`, `description`, `cover`, `edition` optional).
  URL-Validierung nur http(s); keine Affiliate-Links (Hauskonvention #141).
- **Lizenz:** Manifest trägt bereits `metadata.license` (z. B. CC-BY-SA-4.0).
  Zu klären: erlaubt die App proprietär/„all rights reserved" lizenzierte
  Begleit-Repos, oder nur offene Lizenzen? (offene Frage Q5).
- **Privacy:** Exporte/Links tragen null Lerner-PII (bestehende Export-Regel).
- **Security:** Drittinhalt → `validate_content.py` „no executable content"-Gate
  (Trust 0→1); externe Buch-Links mit `rel="noopener noreferrer"`, kein
  Auto-Redirect.

---

## 4. Roadmap-Tasks

Prefix **AUTH-**. Reihenfolge = grobe Abhängigkeit; alles additiv, nichts davon
ist ein MVP-Blocker. AUTH-01..04 = Option B/C-Kern; AUTH-05/06 = die harten
Daten-Themen; AUTH-07+ = Discovery/Doku/Vertrauen.

| ID | Task | Bezug | Aufwand |
|---|---|---|---|
| **AUTH-01** | Additives **Buch-Metadaten-Schema** im Repo-Root-Manifest (`book`-Block) + Erweiterung `validate_content.py` (Pflicht `title`/`author`/`url`, http(s), additive Felder) | §3.4, LESSON-FORMAT | S |
| **AUTH-02** | **Content-Browser-Rendering** „Buch-Begleiter": Cover/Autor/Edition + dezenter „Zum Buch"-Link am Set-/Repo-Header, beide Modi, i18n (8 Sprachen) | Option B | M |
| **AUTH-03** | Begleit-Repos in **`recommended-repos.json`** als Trust-3-Discovery-Einträge (One-Click-Add), „offiziell empfohlen"-Badge | #124, Option C | S |
| **AUTH-04** | **Bidirektionaler Querverweis** `books.yaml`↔Repo: optionales `companion_repo`-Feld am Buch; aus der Buchempfehlung das Begleit-Repo verbinden | #141, Option C | M |
| **AUTH-05** | **Versions-/Update-Handling** für Author-Sets: Edition→Set-Version, fortschritts-erhaltendes Update, ID-Stabilitäts-Garantie + Best-effort-Remap/Reset-Hinweis | §3.3, #390 | M |
| **AUTH-06** | **Konflikt-Policy** lokal-editiertes Author-Set: Fork-statt-Mutation + „Meine/Autor/Beide"-UX (gemeinsam mit #97 entwerfen) | §3.2, #97 | L |
| **AUTH-07** | **Add-Flow** für ein Begleit-Repo: `/add-repo`-Deeplink + QR (Wiederverwendung #122), buch-spezifischer Onboarding-Text | #122 | S |
| **AUTH-08** | **Autoren-/Verlags-Leitfaden** im Content-Repo (Repo-Layout, `book`-Block, ID-Vertrag, v1.3-Pflicht, Lizenz, Sync-Verhalten) | docs/ im Content-Repo | S |
| **AUTH-09** | *(deferred)* **„Verifizierter Autor/Verlag"** als echte Vertrauensstufe — braucht geteiltes Backend (EXP-023 Phase C); bewusst nicht jetzt | EXP-023 C | — |

---

## 5. Offene Fragen

1. **Wo leben die Buch-Metadaten?** Repo-Root-Manifest (`book`-Block, ein Buch
   pro Repo), pro Set, oder eine eigene `book.yaml`? *Empfehlung:* Root-Block,
   weil ein Begleit-Repo i. d. R. zu genau einem Buch gehört.
2. **Ein Repo pro Buch oder ein Repo mit mehreren Begleit-Sets?** *Empfehlung:*
   ein Repo pro Buch (klare Versionierung, klare Trust-Zuordnung), mehrere Sets
   pro Repo erlaubt (z. B. pro Buchteil).
3. **Edition-Handling:** neue Auflage = neue Set-**Version** (Fortschritt
   bleibt) oder neue Set-**ID** (sauberer Schnitt)? *Empfehlung:* Version,
   solange die Lektions-/Card-IDs stabil bleiben; sonst explizit neue ID.
4. **Lizenz-Politik:** erlaubt die App proprietär lizenzierte Begleit-Repos
   (Verlag), oder nur offene Lizenzen? Hat Implikationen für Caching/Export.
5. **Monetarisierungs-Optik:** wie prominent darf der „Zum Buch / Kaufen"-Link
   sein, ohne dass die App als Verkaufskanal wirkt? `books.yaml` erlaubt heute
   bewusst nur direkte (Nicht-Affiliate-)Links — gilt das auch hier?
6. **Konflikt-UX (AUTH-06):** vollständig an #97 koppeln, oder für EXP-025 ein
   minimaler „read-only, Edit erzeugt Fork"-Zwischenstand?
7. **Schema v1.4-Timing:** lohnt es, AUTH-01 gleich v1.4-bündel-fähig zu
   entwerfen, oder strikt v1.3 bis der v1.4-Loader steht? *Empfehlung:* v1.3
   jetzt, AUTH-01-Felder so wählen, dass sie sich v1.4 sauber zuordnen lassen.
8. **Trust-3-Kuratierung:** reicht die statische `recommended-repos.json` als
   alleiniger „offiziell empfohlen"-Kanal (kein Backend), bis EXP-023 Phase C
   ein geteiltes Backend liefert?

---

## Entscheidungen

Die acht offenen Fragen aus §5 sind entschieden (EXP-025 freigegeben). Die
Entscheidungen sind für die AUTH-Tasks bindend; sie können revidiert werden,
wenn die Implementierung Gegenargumente liefert.

- **E1 (zu Q1) — Ort der Buch-Metadaten:** ein `book`-Block im **Repo-Root-
  Manifest**, ein Buch pro Repo. Keine eigene `book.yaml`, keine Pro-Set-
  Duplizierung. Treibt AUTH-01.
- **E2 (zu Q2) — Repo-Granularität:** **ein Repo pro Buch**; mehrere Sets pro
  Repo erlaubt (z. B. pro Buchteil/Kapitelblock). Klare Versionierung und
  klare Trust-Zuordnung pro Werk.
- **E3 (zu Q3) — Edition-Handling:** neue Auflage = neue **Set-Version**
  (Fortschritt bleibt erhalten), **solange Lektions- und Card-IDs stabil
  bleiben**. Müssen IDs sich ändern, ist es eine **neue Set-ID** (sauberer
  Schnitt, Fortschritt startet neu). Verzahnt mit AUTH-05.
- **E4 (zu Q4) — Lizenz-Politik:** ein Begleit-Repo **muss** `metadata.license`
  deklarieren. **Offene Lizenzen** (CC-BY / CC-BY-SA / …) erhalten den vollen
  Funktionsumfang (konsumieren + lokal cachen + teilen/exportieren/PR).
  **Proprietär / „all rights reserved"** ist erlaubt, aber nur
  **konsumieren + lokal cachen**; die App **deaktiviert Re-Share / PR /
  Export** solchen Inhalts (sichtbar-aber-deaktiviert mit Begründung, nie
  versteckt — Feature-State-Policy). Fehlt das Lizenzfeld, gilt der
  konservative Default „all rights reserved" (keine Weiterverbreitung).
- **E5 (zu Q5) — Monetarisierungs-Optik:** ein **dezenter** „Zum Buch"-Link am
  Set-/Repo-Header und auf der Buchkarte. **Nur direkte (Nicht-Affiliate-)
  URLs** (Hauskonvention #141), `rel="noopener noreferrer"`, **kein**
  Vollbild-CTA, **kein** Auto-Redirect, kein Kauf-Flow in der App. Die App
  bleibt Lern-, kein Verkaufskanal.
- **E6 (zu Q6) — Konflikt-UX / Schnittstelle zu #97:** EXP-025 konsumiert
  Author-Sets **read-only**. Ein lokales Edit eines Author-Sets **mutiert es
  nie in-place**, sondern erzeugt eine **abgespaltene user-generierte Kopie**
  mit eigener ID (`source: "user-generated"`). Die vollständige Merge-UX
  („Meine / Autor / Beide") gehört **#97 / EXP-026**, nicht EXP-025. AUTH-06
  liefert nur die Fork-Grenze; den Merge spezifiziert EXP-026.
- **E7 (zu Q7) — Schema-Ziel:** Autoren-Tooling zielt **jetzt auf v1.3**
  (einziges ladbares Format). AUTH-01 wählt die `book`-Felder so, dass sie
  sich beim v1.4-Loader **verlustfrei auf das v1.4-Bündel abbilden** lassen.
- **E8 (zu Q8) — Trust-3-Kanal:** die statische `recommended-repos.json` im
  offiziellen Repo ist **der alleinige** „offiziell empfohlen"-Kanal (kein
  Backend), bis EXP-023 Phase C ein geteiltes Backend liefert. Eine echte
  „verifizierter Verlag"-Stufe bleibt deferred (AUTH-09).

---

## Bewertung

#142 hat recht: das ist **kein neues Kernfeature**, sondern ein Anwendungsfall
von EXP-023 plus dünne, additive Content-Konventionen und Cross-Linking. Der
größte Wert liegt nicht im Code, sondern in der **Disziplin der IDs/Versionen**
(§3.3) und der **Konflikt-Policy** (§3.2, #97) — die beiden Stellen, an denen
ein naives Update den Lernfortschritt zerstören könnte.

Empfohlener Schnitt: **Option A** ist quasi schon da (Begleit-Repo = Community-
Repo). **Option B** (AUTH-01/02) ist der erste sinnvolle, kleine Schritt mit
sichtbarem Nutzen. **Option C** (AUTH-03/04) ist die Vision-Stufe und sollte
erst nach einem stabilen v1.78-Release und in Abstimmung mit #97 und EXP-023
Phase C angegangen werden. AUTH-05/06 nicht unterschätzen — dort sitzt das
eigentliche Risiko.
