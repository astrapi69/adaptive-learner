# EXP-029: Medien-Ressourcen mit Gegenseitigkeits-Prinzip

**Kategorie:** Vision · **Phase:** B/C (auf EXP-023 + EXP-025 aufsetzend) ·
**Priorität:** P3 (Vision / Business-Development, kein MVP-Blocker) ·
**Abhängig von:** EXP-023 (Multi-Content-Repository), EXP-025
(author-provided lesson sets), #141 (`books.yaml` +
`book-recommendations.ts`) · **Issue:** —

> Design-Dokument. Kein Code. Es beschreibt, wie eine Lektion (oder eine
> Domäne) **begleitende Medien-Ressourcen** anbietet — YouTube-Videos,
> Podcasts, Artikel, Bücher, Kurse, Webseiten — und nach welchem **Filter**
> entschieden wird, was aufgenommen wird. Der Filter ist **nicht der Preis,
> sondern die Gegenseitigkeit**: Wer auf uns verweist, wird verlinkt; reine
> Werbung nicht. Die Architektur (EXP-023 + EXP-025) trägt das bereits — der
> eigentliche Aufwand liegt in der Partnergewinnung, nicht im Code.

---

## 0. Was es heute schon gibt (Ist-Stand)

Ein Teil der Idee ist **bereits ausgeliefert** und dient als Vorbild für das
Medien-Schema:

| Baustein | Datei | Status |
|---|---|---|
| Per-Domain-Buch-Empfehlungen (`books.yaml` im Content-Repo-Root) | `frontend/src/lib/content/book-recommendations.ts` | **da** (#141) |
| Buch ↔ Begleit-Repo Brücke (bidirektionaler Querverweis) | EXP-025 / `book-companion.ts` | **da** (AUTH-01/02) |
| Lektions-Schritt mit `example_url` + `example_label` (Theorie-Beispiel-Link) | Content-Schema 1.4 | **da** (#139) |
| Multi-Content-Repository + Trust-Level + Recommended-Repos | EXP-023 (A/B/C) | **da** |

`books.yaml` ist das **direkte Vorbild**: eine kuratierte, per-Domain
gruppierte YAML-Datei im Root des offiziellen Content-Repos, in BEIDEN
Storage-Modi ohne Server-Roundtrip gefetcht (GitHub-raw-Pfad, stale-while-
revalidate `localStorage`-Cache, fehlertolerant → bei fehlender Datei einfach
keine Sektion).

**Was fehlt** (= der Inhalt dieses Dokuments):

1. Ein **`media.yaml`** analog zu `books.yaml` — Medien-Ressourcen über Bücher
   hinaus (Video, Podcast, Artikel, Kurs, Webseite).
2. Ein **Gegenseitigkeits-Prinzip** als expliziter Kurations-Filter (statt der
   bisherigen impliziten „nur kostenlos, außer Bücher"-Regel).
3. Ein **Medien-Schema** mit Typ-Union + `partnership`-Flag.
4. Ein **Unternehmens-/Ökosystem-Szenario** (Content-Anbieter als Partner), das
   den Wert der Architektur über reine Empfehlungen hinaus beschreibt.

---

## 1. Idee

Eine Lektion lebt nicht im luftleeren Raum. Wer „passé composé" lernt, profitiert
von einem 6-Minuten-Erklärvideo; wer Psychologie-Grundlagen paukt, von einem
Podcast oder einem Standardwerk. Heute kann eine Lektion nur **ein** Buch pro
Domäne (`books.yaml`) und **einen** Theorie-Beispiel-Link (`example_url`)
anbieten. EXP-029 verallgemeinert das zu einer **kuratierten Medien-Liste** pro
Domäne und (optional) pro Set/Lektion.

Der Wert ist zweiseitig:

- **Für den Lerner:** vertiefende Medien direkt im Kontext, ohne selbst suchen
  zu müssen — kuratiert statt Google-Roulette.
- **Für Adaptive Learner:** ein **Ökosystem-Hebel**. Die App wird zum Funnel
  für Content-Anbieter (Sprachlehrer, kleine Sprachschulen, Buchautoren), die
  im Gegenzug auf die App verweisen — ein Wachstumsmechanismus, der auf der
  bestehenden EXP-023/025-Architektur aufsetzt.

---

## 2. Erlaubte Medientypen

| Typ | Beispiel | Bedingung |
|-----|----------|-----------|
| `youtube` | Erklär-Videos | keine |
| `podcast` | Spotify, Apple Podcasts | keine |
| `article` | Wikipedia, Blogs | keine |
| `book` | `books.yaml` (existiert bereits) | keine |
| `course` | Sprachlehrer-Kurs, Sprachschule | **nur mit Gegenseitigkeit** |
| `website` | Partner-Seiten | **nur mit Gegenseitigkeit** |

`book` ist bereits über `books.yaml` (#141) abgedeckt und wird hier nur der
Vollständigkeit halber als Typ geführt — eine künftige Implementierung kann
`books.yaml` als `media.yaml`-Spezialfall behandeln oder beide nebeneinander
bestehen lassen (siehe §6, offene Frage zur Konsolidierung).

---

## 3. Filter-Prinzip: Gegenseitigkeit, nicht Preis

**Alt (implizit, aus #141):** „Keine kostenpflichtigen Inhalte (außer Bücher)."

**Neu (EXP-029):** „**Gegenseitigkeit ist der Filter, nicht der Preis.**"

Der bisherige Preis-Filter trifft die falsche Unterscheidung. Ein kostenloser
Udemy-Kurs ohne Rückverweis ist für unser Ökosystem **wertlos** — er nimmt
Aufmerksamkeit, gibt nichts zurück. Ein bezahlter Kurs eines Lehrers, der in
seinen Videos auf die App verweist und ein eigenes Content-Repo pflegt, ist
**wertvoll** — er ist Teil eines Win-win. Der richtige Filter ist also nicht
„gratis vs. bezahlt", sondern „**verweist die Gegenseite auf uns oder nicht**".

Konkrete Regeln:

- **Gratis-Medien (YouTube, Podcast, Artikel): immer erlaubt.** Niedrige
  Schwelle, hoher Lerner-Nutzen, kein kommerzielles Interesse dahinter, das eine
  Gegenleistung verlangen würde.
- **Bücher: immer erlaubt.** Bestehende `books.yaml`-Regel (#141), reine
  Empfehlungen, keine Affiliate-Links.
- **Kurse + Webseiten: erlaubt WENN Gegenseitigkeit besteht.** Nachweisbar
  durch einen **Backlink** auf Adaptive Learner, ein **eigenes Content-Repo** in
  unserer App (EXP-023/025), oder eine **andere dokumentierte Kooperation**.
- **Reine Werbung — wir verlinken, die ignorieren uns — ist nicht erlaubt**,
  egal ob gratis oder bezahlt.
- **Ein kostenloser Kurs ohne Rückverweis ist genauso raus wie ein teurer.**
  Der Preis spielt für die Aufnahme keine Rolle.

Das Prinzip lässt sich in einem Satz prüfen: *Gibt die Gegenseite dem Ökosystem
etwas zurück?* Bei `youtube`/`podcast`/`article`/`book` ist die Antwort
strukturell „der Lerner-Nutzen genügt"; bei `course`/`website` muss die
Gegenseitigkeit **explizit nachgewiesen und dokumentiert** sein (§5, §6).

---

## 4. Unternehmens-Szenario: Content-Anbieter als Ökosystem-Partner

Die EXP-025-Content-Repo-Architektur (author-provided lesson sets) ermöglicht
ein Geschäftsmodell, das über reine Empfehlungen hinausgeht:

- Ein **Sprachlehrer** erstellt ein Content-Repo mit **gratis** Lektionen
  (EXP-023/025) — die App konsumiert es read-only.
- **Die App ist der Funnel.** Der Lehrer verlinkt aus den Begleitlektionen
  heraus auf seinen **Bezahl-Kurs** als Vertiefung (`course`-Typ in
  `resources[]` / `media.yaml`).
- **Win-win:** Wir bekommen kuratierten Content (und Reichweite über die
  Verweise des Lehrers), der Lehrer bekommt Schüler.

Die Gegenseitigkeit ist hier **konstruktiv erfüllt**: das Content-Repo selbst
IST der Rückverweis ins Ökosystem. Ein `course`-Eintrag eines Anbieters, der ein
verbundenes Repo pflegt, erfüllt die Bedingung aus §3 automatisch.

### Zielgruppen (realistisch)

- Einzelne **Sprachlehrer auf YouTube** (große Reichweite, eigener Funnel).
- Kleine **Sprachschulen** mit Online-Präsenz.
- **Content Creator**, die eigene Kurse verkaufen.
- **Buchautoren**, die begleitend unterrichten (Überschneidung mit EXP-025).
- **NICHT:** große Plattformen (Coursera, Babbel, Duolingo) — die brauchen uns
  nicht als Funnel, geben nichts zurück und passen nicht zum
  Gegenseitigkeits-Prinzip.

### Einordnung

Das ist ein **Business-Development-Thema, kein reines Tech-Thema.** Die
Architektur (EXP-023 + EXP-025) trägt es bereits — der Aufwand liegt in der
**Partnergewinnung** (Ansprache, Onboarding-Leitfaden, Kuration), nicht im Code.
Der Code-Anteil (§5) ist klein und additiv.

---

## 5. Medien-Schema

Analog zu `Book` (`book-recommendations.ts`). Ein `MediaResource` ist
props-getragen, optional-tolerant und in beiden Storage-Modi fetchbar.

```ts
/** Ein Medientyp. `course` und `website` setzen nachgewiesene
 *  Gegenseitigkeit voraus (siehe `partnership`). */
type MediaType =
  | "youtube"
  | "podcast"
  | "article"
  | "book"
  | "course"
  | "website";

/** Eine begleitende Medien-Ressource zu einer Domäne / einem Set / einer
 *  Lektion. `title` + `type` + `url` sind Pflicht; der Rest ist optionale
 *  Metadaten, die die Karte anzeigt, wenn vorhanden. */
interface MediaResource {
  type: MediaType;
  title: string;
  url: string;                 // http(s), validiert
  author?: string | null;
  description?: string | null;
  language?: string | null;
  free?: boolean | null;       // true = gratis, false = kostenpflichtig (Badge)
  partnership?: boolean;       // true = Gegenseitigkeit geprüft (Pflicht für
                               //        course/website; sonst ignoriert)
  tags?: string[];
}
```

**Validierungs-Regel (analog `isBook`):** ein Eintrag ist nur gültig, wenn
`type` in der Union liegt, `title`/`url` Strings sind und `url` `^https?://`
matcht. **Zusatzregel für `course`/`website`:** ein Eintrag mit
`partnership !== true` wird **verworfen** (failt closed) — Kurse/Webseiten ohne
nachgewiesene Gegenseitigkeit erscheinen nie, selbst wenn jemand sie in die YAML
schreibt. Damit ist das Filter-Prinzip aus §3 nicht nur Doku, sondern im Parser
durchgesetzt.

**Ablage** (zwei Ebenen, beide additiv und optional):

- **`media.yaml`** im Content-Repo-Root, per-Domain gruppiert — exakt das
  `books.yaml`-Muster, derselbe Loader-Stil (`media-resources.ts`).
- **`resources[]`** optional auf Set-Manifest- oder Lektions-Ebene (Content-
  Schema additiv erhöhen, wie `example_url` in 1.4) — für medien, die zu EINER
  Lektion gehören statt zur ganzen Domäne.

---

## 6. Offene Fragen + Empfehlungen

1. **Wie wird Gegenseitigkeit geprüft und dokumentiert?**
   *Empfehlung: manuell bei der Kuration.* Jeder `course`/`website`-Eintrag in
   `media.yaml` bekommt einen YAML-Kommentar mit **Datum + Art der
   Gegenseitigkeit** (Backlink-URL, Content-Repo-Name, oder Verweis auf eine
   Kooperations-Vereinbarung). Beispiel:
   ```yaml
   # reciprocity 2026-06-15: backlink https://lehrer.example/links + repo "lehrer-fr-content"
   - type: course
     title: "Französisch B1 Intensivkurs"
     url: "https://lehrer.example/kurs-b1"
     partnership: true
     free: false
   ```
   Eine automatische Backlink-Prüfung (Crawler) ist Over-Engineering, solange die
   Partnerzahl klein ist; der Kommentar ist der Audit-Trail.

2. **Soll die App den Unterschied zwischen „kostenlos" und „kostenpflichtig"
   anzeigen?**
   *Empfehlung: ja, dezenter Badge* („Gratis" / „Kurs"), damit der Lerner weiß,
   worauf er klickt, bevor er klickt. Getragen vom `free`-Feld; `course` ohne
   `free` wird als kostenpflichtig dargestellt. Kein aufdringliches Label, nur
   ein kleiner Token-gefärbter Hinweis (Design-Token-Regel: kein Hardcode).

3. **`media.yaml` und `books.yaml` konsolidieren oder nebeneinander?**
   *Empfehlung: zunächst nebeneinander.* `books.yaml` ist ausgeliefert und
   getestet; `media.yaml` führt `book` als Typ nur der Vollständigkeit halber.
   Eine spätere Konsolidierung (`books.yaml` → `media.yaml type: book`) ist
   möglich, aber kein Einstiegsschritt — erst wenn `media.yaml` produktiv ist.

4. **Domänen-Ebene, Set-Ebene oder Lektions-Ebene?**
   *Empfehlung: mit `media.yaml` (Domänen-Ebene) starten*, exakt wie
   `books.yaml`. `resources[]` auf Set/Lektion ist die nächste Stufe (additives
   Schema), erst nachziehen, wenn ein Anbieter medien lektions-genau verorten
   will.

5. **Was, wenn ein Partner die Gegenseitigkeit aufkündigt (toter Backlink)?**
   *Empfehlung: Kuration ist Pflege, kein Set-and-forget.* Bei einem Repo-Sweep
   wird der reciprocity-Kommentar gegen den realen Backlink geprüft; entfällt er,
   wird `partnership: false` gesetzt → der Parser verwirft den Eintrag
   automatisch. Kein Code-Pfad nötig, nur eine Kurations-Checkliste.

---

## 7. Roadmap-Tasks

Prefix `MED-`. Aufwand: S/M/L. Reihenfolge = empfohlene Umsetzung. Alle Tasks
sind **additiv** und brechen kein bestehendes Verhalten.

| ID | Task | Abhängig | Aufwand |
|----|------|----------|---------|
| MED-01 | `media.yaml`-Schema + `MediaResource`-Typ + Loader (`media-resources.ts` analog `book-recommendations.ts`): per-Domain, GitHub-raw, stale-while-revalidate, beide Storage-Modi, fehlertolerant. | #141 | M |
| MED-02 | Parser-Validierung mit **Gegenseitigkeits-Gate**: `course`/`website` mit `partnership !== true` werden verworfen (fail closed); `url` http(s)-validiert. | MED-01 | S |
| MED-03 | Content-Browser-Rendering: Medien-Sektion pro Domäne (Typ-Icon je `MediaType`, Titel, Autor, Beschreibung); leere Sektion = keine Anzeige. | MED-01 | M |
| MED-04 | Gratis/Kurs-Badge (`free`-Feld → dezenter Token-gefärbter Badge), damit der Lerner vor dem Klick weiß, was ihn erwartet. | MED-03 | S |
| MED-05 | Optionales `resources[]` auf Set-/Lektions-Ebene (Content-Schema additiv erhöhen, wie `example_url`); Renderer im Lektions-Kontext. | MED-01, EXP-003 | M |
| MED-06 | i18n: Medien-Typ-Labels + Badges + Sektions-Titel in 8 Sprachen (`media.*`). | MED-03 | S |
| MED-10 | **Partner-Onboarding-Dokumentation:** Leitfaden für Sprachlehrer/Sprachschulen — wie erstelle ich ein Content-Repo (EXP-023/025), wie verlinke ich meinen Kurs (`media.yaml` / `resources[]`), wie weise ich Gegenseitigkeit nach. Business-Development-Artefakt, kein Code. | EXP-023, EXP-025 | M |

MED-01..06 sind der Code-Anteil (klein, additiv); **MED-10 ist der eigentliche
Hebel** — ohne Partnergewinnung bleibt das Schema leer. MED-10 ist bewusst
nicht-Tech und kann parallel zum Code laufen (das Onboarding-Material braucht nur
die bestehende EXP-023/025-Architektur, nicht MED-01..06).

---

## Bewertung

Der teure Teil — Multi-Content-Repository, Trust-Level, der `books.yaml`-Loader-
Stil, die Buch↔Repo-Brücke — ist **schon gebaut**. EXP-029 ist eine **günstige,
additive Erweiterung** auf der Code-Seite (`media.yaml` ist ein `books.yaml`-
Klon mit breiterer Typ-Union und einem Gegenseitigkeits-Gate im Parser) und ein
**Business-Development-Thema** auf der Wert-Seite.

Die zentrale konzeptionelle Korrektur: **der Filter ist die Gegenseitigkeit,
nicht der Preis.** Damit wird die Medien-Liste vom passiven Empfehlungs-Block zum
aktiven Ökosystem-Hebel — ein Funnel, der Content-Anbieter anzieht, die im
Gegenzug auf die App verweisen.

**Kein MVP-Blocker.** Additiv, beide Storage-Modi, kein Server, kein
Datenmodell-Eingriff (Content-Schema nur additiv für `resources[]`). Der
Engpass ist nicht der Code, sondern die Partnergewinnung (MED-10).
