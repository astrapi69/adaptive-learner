# Navigation

v1.91.0 hat die Navigation der App umgebaut (EXP-037). Die
Hauptnavigation ist von über 12 Einträgen auf eine kleine Zahl
**gruppierter Einträge** gesunken (gemäß der Nielsen-Norman-
Empfehlung „5-7 Einträge") — **ohne Funktionsverlust**: jede Seite
bleibt erreichbar, und alte Links funktionieren über Redirects
weiter.

<!-- TODO: Screenshot — die gruppierte Hauptnavigation und die mobile Bottom-Tab-Leiste -->

---

## Desktop: gruppierte Einträge

Die Desktop-Navigation ist über eine wiederverwendbare
`NavGroup`-Komponente in beschriftete Gruppen gegliedert:

- **Lernen** — Dashboard und Lernpfad.
- **Inhalte** — der **Content-Hub** (`/content`), der den
  *Entdecken*-Katalog, deine heruntergeladenen *Meine Inhalte* und
  *Import* als Tabs enthält (in dieser Reihenfolge). **Entdecken ist
  der Standard-Tab**, beim Öffnen des Hubs landest du also im
  Katalog.
- **Fortschritt** — der **ProgressHub** (`/progress`), mit
  Übersicht, Statistik und Meine Pfade als Tabs.
- **Settings** und **Help** runden die Leiste ab.

Seiten, die keine Top-Level-Einträge mehr sind (Anki, Session),
bleiben erreichbar: Anki über seine `/anki`-Route, Session über
seine erhaltene Route.

### Vertikale Seitenleiste

Auf breiten Desktop-Bildschirmen wird die Hauptnavigation als
**vertikale linke Seitenleiste** dargestellt. Sie nutzt exakt
dasselbe gruppierte `NavGroup`-Modell wie oben — keine zusätzlichen
Einträge, nur ein Layout als linke Leiste, das den gruppierten
Abschnitten mehr Platz gibt. Der aktive Eintrag trägt
`aria-current`, jedes Ziel ist mindestens 44px groß, und sie
funktioniert über alle Themes hinweg. Auf schmalen / mobilen
Breiten weicht die Seitenleiste der Bottom-Tab-Leiste weiter unten.
(Dies ist die Seitenleiste der *Haupt*navigation; die
Settings-Seite hat ihre eigene, separate Seitenleiste für ihre
Tabs.)

Die Seitenleiste hat einen **Auf-/Zuklapp-Umschalter**: Klappe sie
zu einer schmalen Leiste ein, um der Seite mehr horizontalen Platz
zu geben, oder wieder zur vollen beschrifteten Leiste auf. Deine
Wahl wird gemerkt.

---

## Mobil: Bottom-Tab-Leiste

Auf kleinen Bildschirmen bietet eine **Bottom-Tab-Leiste** fünf
daumenfreundliche Tabs — **Lernen / Inhalte / Entdecken /
Fortschritt / Mehr** — mit einem „Mehr"-Bottom-Sheet für alles
Übrige. Die Ziele sind 44px groß, sie respektiert alle Themes und
versteckt sich im Onboarding-Trichter und während einer Lektion,
damit nichts den Inhalt verdeckt.

---

## Hubs und Redirects

Zwei Seiten wurden zu **getabbten Hubs**, die nur den aktiven Tab
einhängen:

- **ProgressHub** (`/progress`) bettet Fortschritt + Lern-
  Statistik + Curriculum ein.
- **Content-Hub** (`/content`) bettet Entdecken + Meine Inhalte +
  Import ein (Entdecken ist der Standard-Tab).

Alte URLs bleiben über Redirects erhalten, z.B. `/statistics` →
`/progress?tab=stats`, `/curriculum` → `/progress?tab=paths`,
`/discover` → `/content?tab=discover`, `/import` →
`/content?tab=import`.

---

## Verwandte Seiten

- [Fortschritt](progress.md) — die ProgressHub-Tabs
- [Content Browser](../features/content-browser.md) — Meine Inhalte
- [Inhalte entdecken](../features/discover.md) — der Katalog
