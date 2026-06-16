# EXP-027: Internationalisierungs-Strategie (Sprach-Expansion)

**Kategorie:** Querschnitt · **Phase:** Zukunft · **Priorität:** P4 (Vision,
kein MVP-Blocker) · **Abhängig von:** bestehende i18n-Infrastruktur
(`backend/config/i18n/`, `make sync-i18n`), EXP-023 (Content-Repos) ·
**Issue:** —

> Design-Dokument. Kein Code. Vision-Dokument für nach v1.80.0. Es legt eine
> priorisierte Reihenfolge für Sprach-Expansion fest (UI **und** Content) und
> benennt die technischen Voraussetzungen je Sprache — damit künftige
> Expansion eine Entscheidung gegen eine Strategie ist, nicht ad hoc.

---

## 1. Idee

### Worum geht es?

Adaptive Learner unterstützt aktuell **8 UI-Sprachen** (de, en, es, fr, el, pt,
tr, ja) und erreicht damit grob **~3 Mrd. Sprecher** (~37 % der
Weltbevölkerung; nach Überlappungs-Bereinigung ~2,2-2,5 Mrd. unique, da viele
Englisch als Zweitsprache zählen).

Ziel: Reichweite **systematisch** erweitern durch priorisierte Sprach-Expansion
(UI **und** Content), statt opportunistisch eine Sprache nach der anderen
hinzuzufügen.

Aktuelle Abdeckung (verifizierte Sprecherzahlen, Stand 2026):

| Sprache | Sprecher (Total) | Typ |
|---------|-----------------:|-----|
| English | 1.528 Mrd. | Lingua Franca |
| Español | 558 Mio. | Global |
| Français | 312 Mio. | Global + Afrika |
| Português | 267 Mio. | Brasilien + Afrika |
| Deutsch | 133 Mio. | DACH + Web |
| Japanisch | 123 Mio. | Japan |
| Türkisch | 90 Mio. | Türkei + Diaspora |
| Griechisch | 13 Mio. | Nische / Diaspora |

### Die zwei Sprach-Achsen — explizit getrennt

Die Kern-Entscheidung dieses Dokuments: **UI-Sprache und Content-Sprache sind
zwei unabhängige Achsen** und werden getrennt priorisiert.

| Achse | Frage | Hängt an | Aufwand |
|-------|-------|----------|---------|
| **UI-Sprache** | In welcher Sprache **bedient** der Lerner die App? | 1 YAML-Katalog (`backend/config/i18n/{lang}.yaml`) | gering, sofort machbar |
| **Content-Sprache** | Welche **Sprachpaare** stehen zum Lernen bereit? | Content-Autoren + Repos (EXP-023) | hoch, communitygetrieben |

**Beide Achsen müssen für eine echte Markt-Erschließung zusammenkommen.**
Beispiel: Ein Hindi-Sprecher will

1. die **UI auf Hindi** (Navigation, Buttons, Hilfe — sofort über den
   YAML-Katalog machbar), **und**
2. **Hindi-basierte Lektionen** (Hindi→Englisch, Hindi→Deutsch — eigene
   Content-Sets, die heute nicht existieren).

Eine Hindi-UI **ohne** Hindi-Content ist eine **leere App**: der Lerner kann die
App bedienen, findet aber kein Lernmaterial in seiner Ausgangssprache (§3.6).
Deshalb gilt: **UI-Sprache zuerst** (geringer Aufwand, macht die App sofort
bedienbar — auch mit bestehenden Paaren wie en→es), aber für einen **Tier-1-
Markt UI + Content zusammen** planen, nicht UI allein ausliefern und auf Autoren
hoffen.

### Strategischer Kontext

- **Griechisch** und **Türkisch** sind global Nischen-Picks, aber relevant für
  die **DACH-Diaspora** (Kern-Use-Case: Sprachlerner in Deutschland).
- Die 8 Sprachen decken **Europa, Lateinamerika, Teile Afrikas und Japan** ab.
- Große Lücken: **Südasien, MENA, Ostasien (außer Japan)**.

### Was sich ändert — und was nicht

- **UI-Sprache ≠ Lerninhalt-Sprache** (siehe oben). Keine Architektur-Änderung:
  die bestehende YAML-Katalog-Pipeline (`backend/config/i18n/{lang}.yaml` →
  `make sync-i18n` → Frontend-Bundle) skaliert auf weitere Sprachen; offene
  Punkte sind Schrift-/RTL-Support und die Skalierung der Sprachauswahl-UI (§3).

---

## 2. Expansions-Optionen

Priorisierung nach: **Sprecherzahl × Bildungsmarkt-Relevanz ×
Implementierungsaufwand × strategische Passung**. Adaptive Learner ist eine
**Lern-App** — die relevante Markt-Achse ist der **Bildungsmarkt pro Region**
und die **Smartphone-Penetration** (lokal-first, mobil), nicht ein
Autoren-/Publishing-Markt.

| Region | Bildungsmarkt | Smartphone-Penetration | Tier-Kandidat |
|--------|---------------|------------------------|---------------|
| Indien | explosiv | hoch | Hindi (Tier 1) |
| MENA | wachsend | hoch | Arabisch (Tier 1) |
| Südkorea | stark, tech-affin | sehr hoch | Koreanisch (Tier 2) |
| Südostasien | wachsend | mittel-hoch | Indonesisch (Tier 2) |

### Tier 1 — höchste Priorität, größter ROI

- **Hindi** (609 Mio.) — größter Bildungsmarkt der Welt, stark wachsend, hohe
  Smartphone-Penetration. Schrift: Devanagari (LTR). Technisches Risiko gering.
- **Arabisch** (335 Mio.) — MENA-Region. **RTL-Support nötig** — die technisch
  anspruchsvollste Erweiterung (siehe §3.3).

### Tier 2 — hohe Priorität, moderate Komplexität

- **Koreanisch** (82 Mio.) — tech-affine Bevölkerung, starke Bildungskultur,
  K-Wave-Effekt. Schrift: Hangul.
- **Indonesisch** (200 Mio.+) — größter südostasiatischer Markt, Latin-Script.
- **Italienisch** (68 Mio.) — europäischer Markt, Latin-Script, geringste
  technische Hürde.

### Tier 3 — Nische, strategisch

- **Bengalisch** (284 Mio.) — große Sprecherzahl, aber niedrigere
  Smartphone-Penetration. Schrift: Bengali.
- **Russisch** (255 Mio.) — geopolitisch kompliziert.
- **Polnisch** (45 Mio.) — DACH-Diaspora-Relevanz.
- **Vietnamesisch** (86 Mio.) — wachsender Markt, Latin-Script (mit diakritisch
  reicher Orthografie).

---

## 3. Technische Herausforderungen

Je Sprache zu analysieren:

### 3.1 UI-Übersetzung (i18n-Kataloge)

- Aufwand pro Sprache: 1 neuer YAML-Katalog (`backend/config/i18n/{lang}.yaml`),
  ~500 Keys, plus die seed-Kataloge (`subjects.*`) und die Help-/Glossar-Inhalte.
- Qualitätssicherung: maschinelle Übersetzung als Draft + Native-Speaker-Review
  (§5).
- `make sync-i18n` muss die neue Sprache abdecken (Mirror nach
  `frontend/src/data/i18n/*.json`); der i18n-Audit-Test
  (`test_i18n_translation_audit.py`) pinnt No-Passthrough + Divergenz von EN.
- Lazy-geladene Sprach-Kataloge sind bereits Stand (Performance-Arbeit der
  v1.56.0-Linie) — eine weitere Sprache bläht den Haupt-Chunk nicht auf.

### 3.2 Content-Sprachen vs. UI-Sprachen

Konkretisierung der zwei Achsen aus §1:

- UI-Sprache ≠ Lerninhalt-Sprache: eine Hindi-UI ist sofort mit den
  bestehenden Sprachpaaren nutzbar (z. B. en→es); Hindi **als Lerninhalt**
  (z. B. hi→en oder hi→de) braucht eigene Content-Sets.
- Bestehende Content-Repos liefern v. a. **de/en-Quellsprachen** → Ziel
  es/fr/en plus Wissens-Domänen. Neue Quellsprachen (Hindi, Arabisch als
  **Ausgangssprache**) brauchen eine **Autoren-Community** (EXP-023-Repos,
  I18N-09; siehe §3.6).
- **Empfehlung:** UI-Sprache zuerst (geringer Aufwand, sofort nutzbar),
  Content-Paare nachgelagert und communitygetrieben — **aber** für einen
  Tier-1-Markt ein Starter-Content-Set zusammen mit der UI ausliefern (I18N-11/
  I18N-12), damit der Markt nicht auf eine leere App trifft.

### 3.3 RTL-Support (Arabisch, später Hebräisch/Persisch)

RTL betrifft **zwei** Ebenen: das **App-Chrome** (Navigation, Layout) und die
**Exercises** (der eigentliche Lerninhalt). Die zweite ist der schwierige Teil
und wird oft unterschätzt.

**App-Chrome / Layout:**

- CSS **logical properties** (`margin-inline` statt `margin-left`,
  `padding-inline`, `inset-inline`) statt physischer Richtungen.
- Tailwind-RTL: prüfen, ob die bestehenden Utilities RTL-tauglich sind bzw. ein
  RTL-Plugin / `dir="rtl"`-Strategie nötig ist.
- **Icon-Spiegelung** in der Lesson-Navigation: „Weiter"/„Zurück"-Pfeile, der
  Lektions-Footer, Breadcrumb-Chevrons spiegeln bei RTL.

**Exercises — je Typ einzeln zu klären (Audit I18N-10):**

| Exercise-Typ | RTL-Frage | Tendenz |
|--------------|-----------|---------|
| **Matching** | Spiegelt die A→B-Richtung bei RTL (visuelle Spalten-Reihenfolge), oder bleibt die Lese-Richtung exercise-intern LTR? Die bidirektionale Auswahl (#509) bleibt logisch gleich, nur das Layout spiegelt. | Layout spiegeln, Logik gleich — **zu verifizieren** |
| **Fill-in-the-blank / Cloze** | Input-Felder brauchen `dir="rtl"`; der Lückentext fließt RTL, die Marker (`___`) müssen korrekt positioniert bleiben. | `dir="rtl"` pro Feld |
| **Multiple-Choice / Picture-Choice** | Optionen RTL-aligned (rechtsbündig), Auswahl-Indikator auf der korrekten Seite. | RTL-align |
| **Word-Tiles** | Drag-Richtung bei RTL: Kacheln von rechts nach links anordnen; `@dnd-kit`-Sensor-Achse + visuelle Reihenfolge prüfen. | Reihenfolge spiegeln |
| **Ordering** | Sequenz-Richtung bei RTL (erstes Element rechts). | spiegeln |

- **Mixed-Direction** ist der härteste Fall: eine **arabische Frage** mit einer
  **englischen Antwort** (oder umgekehrt) im selben Exercise — der Container ist
  RTL, einzelne Felder LTR (`dir`-Wechsel pro Element). Das ist die zentrale
  offene Produktfrage (§5, Frage 7).
- Aufwand: **deutlich höher** als Latin-Script-Sprachen → eigene
  Infrastruktur-Vorarbeit (I18N-01) + ein Exercise-Typ-Audit (I18N-10),
  Voraussetzung für Arabisch.

### 3.4 CJK-Besonderheiten (teilweise gelöst: Japanisch)

- **Koreanisch:** Hangul, ähnliche Anforderungen wie Japanisch (Font-Stack,
  Zeilenumbruch); kein RTL.
- **Chinesisch** (falls später): Schriftzeichen + Eingabemethoden, noch
  komplexer; nicht in diesem Dokument priorisiert.

### 3.5 Schrift-Systeme

| Schrift | Sprachen | Status |
|---------|----------|--------|
| Latin | de/en/es/fr/pt/tr + id/it/pl/vi | trivial |
| Griechisch | el | gelöst |
| Japanisch (Kana + Kanji) | ja | gelöst |
| Devanagari | Hindi | Font-Stack prüfen |
| Arabisch | ar | RTL + verbundene Schrift |
| Hangul | Koreanisch | Font-Stack prüfen |
| Bengali | Bengalisch | Font-Stack prüfen |

#### Font-Loading-Strategie

Konsequent **lazy pro Sprache** — keine globale Bündelung aller Schrift-System-
Fonts (das würde das Bundle für alle Nutzer aufblähen, obwohl jeder nur ein
Schrift-System braucht). Konsistent mit der bestehenden lazy
i18n-Katalog-/Glossar-Strategie (v1.56.0-Linie).

- **System-Fonts bevorzugen, wo verfügbar.** Viele Plattformen liefern die
  Noto-Familie bereits mit; dann reicht ein `font-family`-Eintrag ohne
  Web-Font-Download.
- **Web-Font nur als Fallback lazy nachladen**, gebunden an die aktive UI-/
  Content-Sprache (nicht eager). Pro Schrift-System genau eine Noto-Variante:
  - Devanagari → `Noto Sans Devanagari`
  - Arabisch → `Noto Sans Arabic`
  - Hangul → `Noto Sans KR`
  - Bengali → `Noto Sans Bengali`
- **Fallback-Kette** (Beispiel Devanagari):
  `'Noto Sans Devanagari', 'Nirmala UI', system-ui, sans-serif` — erst System-
  Noto, dann plattform-spezifischer Fallback (Windows `Nirmala UI`), dann
  `system-ui`, dann generisch. Analog je Schrift-System eine eigene Kette.
- `font-display: swap`, damit der Text sofort (im Fallback) sichtbar ist und
  nicht auf den Web-Font wartet.

---

## 3.6 Content-Repo Sprach-Expansion

Die Content-Achse (§1, §3.2) im Detail — der Teil, der **nicht** durch einen
YAML-Katalog gelöst wird.

- **Bestehende Sprachpaare:** die Content-Repos (offiziell:
  `astrapi69/adaptive-learner-content`) liefern heute v. a.
  **de→es / de→fr / de→en** (A1→A2→B1), **en→es / en→fr**, plus
  Wissens-Domänen (Python, Psychologie). Die **Quellsprachen sind de/en** —
  es gibt keine asiatischen oder RTL-Ausgangssprachen.
- **Neue Paare brauchen Content-Autoren.** Ein Hindi→Englisch-Set entsteht
  nicht aus der UI-Übersetzung; es braucht jemanden, der die Lektionen
  schreibt. Das ist ein **Community-/Autoren-Thema**, kein i18n-Thema.
- **EXP-023 (Multi-Content-Repository-Architektur) trägt das bereits:**
  zusätzliche User-/Community-Repos können angebunden, validiert, gecacht und
  mit Quell-Badge gebrowst werden. Die Infrastruktur für „neue Sprachpaare aus
  einer Autoren-Community" existiert also — was fehlt, ist der **Inhalt**.
- **Das Leere-App-Problem:** ein Hindi-Sprecher mit UI=Hindi, aber ohne
  Hindi-Content, hat eine bedienbare, aber **leere** App. **UI allein reicht
  nicht.**
- **Priorisierung:** für **Tier 1 UI + Content zusammen** — also ein
  Hindi-Starter-Set (I18N-11) parallel zur Hindi-UI (I18N-03), nicht
  nacheinander. Für Tier 2/3 kann die UI vorausgehen, weil diese Märkte oft mit
  englischem Zielcontent + lokaler UI schon Wert haben.

---

## 4. Roadmap-Tasks

Prefix `I18N-`. Aufgeteilt nach Tier / Voraussetzung. Aufwand: S/M/L.

| ID | Task | Tier / Rolle | Aufwand |
|----|------|--------------|---------|
| I18N-01 | RTL-Infrastruktur (CSS logical properties, Tailwind-RTL-Strategie, Icon-Spiegelung, Layout-Spiegelung) | Voraussetzung für Tier-1 Arabisch | M |
| I18N-02 | Sprachauswahl-UI skalieren (> 8 Sprachen: Suchfeld oder Gruppierung nach Region/Schrift) | Voraussetzung für alle | S |
| I18N-03 | Hindi UI-Übersetzung + Devanagari-Font-Stack | Tier 1 | S |
| I18N-04 | Arabisch UI-Übersetzung (hängt an I18N-01) | Tier 1 | M |
| I18N-05 | Koreanisch UI-Übersetzung + Hangul-Font-Stack | Tier 2 | S |
| I18N-06 | Indonesisch UI-Übersetzung | Tier 2 | S |
| I18N-07 | Italienisch UI-Übersetzung | Tier 2 | S |
| I18N-08 | Übersetzungs-QA-Pipeline (maschinell + Native-Review + Community-PR-Korrektur) | Infrastruktur | M |
| I18N-09 | Content-Repo Sprachpaar-Expansion (allgemein, hängt an Content-Autoren) | parallel / Community | L |
| I18N-10 | **Exercise-Typen RTL-Audit:** Matching, FillInBlank/Cloze, MultipleChoice/PictureChoice, WordTiles, Ordering — jeder Typ einzeln auf RTL-Korrektheit prüfen (Layout-Spiegelung, `dir`, Drag-Richtung) | Voraussetzung für Arabisch-Content | M |
| I18N-11 | **Content-Repo Hindi-Sprachpaare:** Hindi→English Starter-Set (mind. 3 Lektionen), zusammen mit I18N-03 | Tier 1 (Content) | M |
| I18N-12 | **Content-Repo Arabisch-Sprachpaare** (hängt an I18N-01 + I18N-10) | Tier 1 (Content) | M |

---

## 5. Offene Fragen

(mit Empfehlung, wo möglich)

1. **Zielgruppe — Lerner IN Deutschland (Diaspora/Migranten) oder globale
   Lerner?** Bestimmt, ob Polnisch/Arabisch (Diaspora) oder Hindi/Indonesisch
   (global) zuerst kommen. *Offen — Produktentscheidung.*
2. **UI-Übersetzung vs. Content — was zuerst?** *Empfehlung: UI zuerst*
   (geringerer Aufwand, sofort nutzbar mit bestehendem Content), **aber für
   Tier 1 UI + Content zusammen** (§3.6), sonst trifft der Markt auf eine leere
   App.
3. **Maschinelle Übersetzung (LLM-gestützt) als Startpunkt akzeptabel?**
   *Empfehlung: LLM als Draft, Native-Speaker-Review, Community-Korrektur über
   PR* — wie bei der bestehenden PT/TR/JA-Linie (AI-generiert, Review-pending).
4. **RTL-Investment jetzt oder später?** *Empfehlung: Tier-1 Hindi (LTR) zuerst,
   RTL-Infra (I18N-01) + Exercise-Audit (I18N-10) parallel vorbereiten,
   Arabisch danach.*
5. **Monetarisierungs-Implikation:** mehr Sprachen = mehr potenzielle Nutzer.
   Ab welcher Reichweite lohnt sich Übersetzungs-Investment? *Offen — koppeln an
   die SaaS-Entscheidung (ROADMAP P4).*
6. **Font-Loading-Strategie:** alle Schrift-System-Fonts bundlen (größeres
   Bundle) oder lazy-laden? *Empfehlung: Lazy-Load pro Sprache, System-Fonts
   bevorzugen, Web-Font nur als Fallback* (§3.5), konsistent mit der
   bestehenden lazy i18n-Katalog-/Glossar-Strategie.
7. **RTL nur in der UI — oder auch innerhalb der Exercises?** Soll die App RTL
   nur im App-Chrome unterstützen (Navigation/Layout), oder auch **innerhalb
   der Exercises**? **Mixed-Direction** (arabische Frage, englische Antwort im
   selben Exercise) ist der **härteste Fall** — Container RTL, einzelne Felder
   LTR. *Empfehlung: App-Chrome-RTL zuerst (I18N-01), Exercise-interne RTL +
   Mixed-Direction als eigener Audit (I18N-10) vor dem ersten Arabisch-Content.*

---

## Bewertung

Die 8 aktuellen Sprachen decken den europäischen + lateinamerikanischen +
japanischen Markt solide ab. Die größten Reichweiten-Sprünge kommen von
**Hindi** (+609 Mio.) und **Arabisch** (+335 Mio.), wobei Arabisch technisch
deutlich aufwändiger ist (RTL — App-Chrome **und** Exercises).

Der entscheidende Punkt: **UI-Sprache und Content-Sprache sind zwei Achsen.**
Eine UI-Übersetzung ist billig und schnell; sie macht die App bedienbar, aber
noch nicht **wertvoll** für einen neuen Markt — dafür braucht es Content in der
Ausgangssprache (§3.6). Für Tier-1-Märkte gehören beide zusammen.

Empfohlener Schnitt:

1. **Hindi** als nächste Sprache — größte Reichweite, geringstes technisches
   Risiko (LTR, nur Font-Stack) — **UI (I18N-03) + Starter-Content (I18N-11)
   zusammen**.
2. **RTL-Infrastruktur (I18N-01) + Exercise-RTL-Audit (I18N-10) parallel**
   vorbereiten.
3. **Arabisch** danach (UI I18N-04 + Content I18N-12).
4. **Tier-2-Sprachen** nach Bedarf / Community-Nachfrage.

**Kein MVP-Blocker.** Vision-Dokument für nach v1.80.0.
