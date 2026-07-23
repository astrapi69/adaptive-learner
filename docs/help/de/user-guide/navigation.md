# Navigation

Die Hauptnavigation der App ist eine kleine Zahl **gruppierter
Einträge** (EXP-037, gemäß der Nielsen-Norman-Empfehlung „5-7
Einträge") — **ohne Funktionsverlust**: jede Seite bleibt
erreichbar, und alte Links funktionieren über Redirects weiter.

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

### Eine Hauptnavigation pro Viewport

Auf Desktop-Breiten ist die horizontale obere Leiste die
**einzige** Hauptnavigation — es gibt keinen Burger-Button und
keinen Drawer. Auf schmalen / mobilen Breiten wandern die Links
der oberen Leiste hinter einen **Hamburger-Drawer** (dieselben
gruppierten Einträge), und die Bottom-Tab-Leiste weiter unten
liefert die primären Tabs. Beide Darstellungen rendern aus einer
gemeinsamen Ziel-Liste und führen deshalb immer zu denselben
Seiten. Der aktive Eintrag trägt `aria-current`, jedes Ziel ist
mindestens 44px groß, und alles funktioniert über alle Themes
hinweg. (Die Settings-Seite hat ihre eigene, separate
Sektions-Seitenleiste für ihre Tabs — sie gehört nicht zur
Hauptnavigation.)

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
