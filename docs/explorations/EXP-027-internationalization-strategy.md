# EXP-027: Internationalisierungs-Strategie (Sprach-Expansion)

**Kategorie:** Querschnitt · **Phase:** Zukunft · **Priorität:** P4 (Vision,
kein MVP-Blocker) · **Abhängig von:** bestehende i18n-Infrastruktur
(`backend/config/i18n/`, `make sync-i18n`), EXP-023 (Content-Repos) ·
**Issue:** —

> Design-Dokument. Kein Code. Vision-Dokument für nach v1.80.0. Es legt eine
> priorisierte Reihenfolge für Sprach-Expansion fest (UI + Content) und
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

### Strategischer Kontext

- **Griechisch** und **Türkisch** sind global Nischen-Picks, aber relevant für
  die **DACH-Diaspora** (Kern-Use-Case: Sprachlerner in Deutschland).
- Die 8 Sprachen decken **Europa, Lateinamerika, Teile Afrikas und Japan** ab.
- Große Lücken: **Südasien, MENA, Ostasien (außer Japan)**.

### Was sich ändert — und was nicht

- **UI-Sprache ≠ Lerninhalt-Sprache.** Eine neue UI-Sprache macht die App
  bedienbar; sie erzeugt noch keinen Lerninhalt in dieser Sprache. Die beiden
  Achsen werden getrennt priorisiert (§3.2).
- Keine Architektur-Änderung: die bestehende YAML-Katalog-Pipeline
  (`backend/config/i18n/{lang}.yaml` → `make sync-i18n` → Frontend-Bundle)
  skaliert auf weitere Sprachen; offene Punkte sind Schrift-/RTL-Support und
  die Skalierung der Sprachauswahl-UI (§3).

---

## 2. Expansions-Optionen

Priorisierung nach: **Sprecherzahl × Bildungsmarkt-Relevanz ×
Implementierungsaufwand × strategische Passung**.

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
  (§5.3).
- `make sync-i18n` muss die neue Sprache abdecken (Mirror nach
  `frontend/src/data/i18n/*.json`); der i18n-Audit-Test
  (`test_i18n_translation_audit.py`) pinnt No-Passthrough + Divergenz von EN.
- Lazy-geladene Sprach-Kataloge sind bereits Stand (Performance-Arbeit der
  v1.56.0-Linie) — eine weitere Sprache bläht den Haupt-Chunk nicht auf.

### 3.2 Content-Sprachen vs. UI-Sprachen

- UI-Sprache ≠ Lerninhalt-Sprache: eine Hindi-UI ist sofort mit den
  bestehenden Sprachpaaren nutzbar (z. B. en→es); Hindi **als Lerninhalt**
  (z. B. hi→en oder en→hi) braucht eigene Content-Sets.
- Bestehende Content-Repos liefern v. a. de/en-Quellsprachen → Ziel es/fr/en
  plus Wissens-Domänen. Neue Quellsprachen (Hindi, Arabisch als
  Ausgangssprache) brauchen eine **Autoren-Community** (EXP-023-Repos, I18N-09).
- Empfehlung: UI-Sprache zuerst (geringer Aufwand, sofort nutzbar),
  Content-Paare nachgelagert und communitygetrieben.

### 3.3 RTL-Support (Arabisch, später Hebräisch/Persisch)

- CSS **logical properties** (`margin-inline` statt `margin-left`,
  `padding-inline`, `inset-inline`) statt physischer Richtungen.
- Tailwind-RTL: prüfen, ob die bestehenden Utilities RTL-tauglich sind bzw. ein
  RTL-Plugin/`dir="rtl"`-Strategie nötig ist.
- **Icon-Spiegelung** (Pfeile, Navigation, „Weiter"/„Zurück", Lektions-Footer).
- **Matching-Exercise:** die A→B-Richtung muss bei RTL korrekt spiegeln
  (visuelle Spalten-Reihenfolge); die bidirektionale Auswahl (#509) bleibt
  logisch gleich, nur das Layout spiegelt.
- Aufwand: **deutlich höher** als Latin-Script-Sprachen → eigene
  Infrastruktur-Vorarbeit (I18N-01), Voraussetzung für Arabisch.

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

---

## 4. Roadmap-Tasks

Prefix `I18N-`. Aufgeteilt nach Tier / Voraussetzung. Aufwand: S/M/L.

| ID | Task | Tier / Rolle | Aufwand |
|----|------|--------------|---------|
| I18N-01 | RTL-Infrastruktur (CSS logical properties, Tailwind-RTL-Strategie, Icon-Spiegelung, Matching-Layout-Spiegelung) | Voraussetzung für Tier-1 Arabisch | M |
| I18N-02 | Sprachauswahl-UI skalieren (> 8 Sprachen: Suchfeld oder Gruppierung nach Region/Schrift) | Voraussetzung für alle | S |
| I18N-03 | Hindi UI-Übersetzung + Devanagari-Font-Stack | Tier 1 | S |
| I18N-04 | Arabisch UI-Übersetzung (hängt an I18N-01) | Tier 1 | M |
| I18N-05 | Koreanisch UI-Übersetzung + Hangul-Font-Stack | Tier 2 | S |
| I18N-06 | Indonesisch UI-Übersetzung | Tier 2 | S |
| I18N-07 | Italienisch UI-Übersetzung | Tier 2 | S |
| I18N-08 | Übersetzungs-QA-Pipeline (maschinell + Native-Review + Community-PR-Korrektur) | Infrastruktur | M |
| I18N-09 | Content-Repo Sprachpaar-Expansion (eigenes Thema, hängt an Content-Autoren) | parallel / Community | L |

---

## 5. Offene Fragen

(mit Empfehlung, wo möglich)

1. **Zielgruppe — Lerner IN Deutschland (Diaspora/Migranten) oder globale
   Lerner?** Bestimmt, ob Polnisch/Arabisch (Diaspora) oder Hindi/Indonesisch
   (global) zuerst kommen. *Offen — Produktentscheidung.*
2. **UI-Übersetzung vs. Content — was zuerst?** *Empfehlung: UI zuerst*
   (geringerer Aufwand, sofort nutzbar mit bestehendem Content).
3. **Maschinelle Übersetzung (LLM-gestützt) als Startpunkt akzeptabel?**
   *Empfehlung: LLM als Draft, Native-Speaker-Review, Community-Korrektur über
   PR* — wie bei der bestehenden PT/TR/JA-Linie (AI-generiert, Review-pending).
4. **RTL-Investment jetzt oder später?** *Empfehlung: Tier-1 Hindi (LTR) zuerst,
   RTL-Infra (I18N-01) parallel vorbereiten, Arabisch danach.*
5. **Monetarisierungs-Implikation:** mehr Sprachen = mehr potenzielle Nutzer.
   Ab welcher Reichweite lohnt sich Übersetzungs-Investment? *Offen — koppeln an
   die SaaS-Entscheidung (ROADMAP P4).*
6. **Font-Loading-Strategie:** alle Schrift-System-Fonts bundlen (größeres
   Bundle) oder lazy-laden? *Empfehlung: Lazy-Load pro Sprache* (konsistent mit
   der bestehenden lazy i18n-Katalog-/Glossar-Strategie).

---

## Bewertung

Die 8 aktuellen Sprachen decken den europäischen + lateinamerikanischen +
japanischen Markt solide ab. Die größten Reichweiten-Sprünge kommen von
**Hindi** (+609 Mio.) und **Arabisch** (+335 Mio.), wobei Arabisch technisch
deutlich aufwändiger ist (RTL).

Empfohlener Schnitt:

1. **Hindi** als nächste Sprache — größte Reichweite, geringstes technisches
   Risiko (LTR, nur Font-Stack).
2. **RTL-Infrastruktur (I18N-01) parallel** vorbereiten.
3. **Arabisch** danach.
4. **Tier-2-Sprachen** nach Bedarf / Community-Nachfrage.

**Kein MVP-Blocker.** Vision-Dokument für nach v1.80.0.
