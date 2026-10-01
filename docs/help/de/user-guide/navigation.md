# Navigation

Die Hauptnavigation der App ist eine kleine Zahl **gruppierter
Einträge** (EXP-037, gemäß der Nielsen-Norman-Empfehlung „5-7
Einträge") - **ohne Funktionsverlust**: jede Seite bleibt
erreichbar, und alte Links funktionieren über Redirects weiter.

<!-- TODO: Screenshot - die gruppierte Hauptnavigation und die mobile Bottom-Tab-Leiste -->

---

## Desktop: gruppierte Einträge

Die Desktop-Navigation ist über eine wiederverwendbare
`NavGroup`-Komponente in beschriftete Gruppen gegliedert:

- **Lernen** - Dashboard, Lernpfad und Sitzung.
- **Inhalte** - der **Content-Hub** (`/content`) mit vier Tabs:
  *Entdecken* (der Katalog), *Meine Inhalte* (was du
  heruntergeladen hast), *Importieren* und *Erstellen* (eine eigene
  neue Lektion). Der Hub öffnet auf dem ersten Tab deiner
  Reihenfolge; standardmäßig ist das Entdecken. Die Reihenfolge
  änderst du unter *Einstellungen > Allgemein > Darstellung*.
- **Fortschritt** - der **ProgressHub** (`/progress`), mit
  Übersicht, Statistik und Meine Pfade als Tabs.
- **Einstellungen** und **Hilfe** runden die Leiste ab.

Anki ist kein eigener Eintrag; es ist eine Aktion auf der
Inhalte-Seite, und seine `/anki`-Route funktioniert weiter.

### Eine Hauptnavigation pro Viewport

Auf Desktop-Breiten ist die horizontale obere Leiste die
**einzige** Hauptnavigation - es gibt keinen Burger-Button und
keinen Drawer. Auf schmalen / mobilen Breiten wandern dieselben
gruppierten Einträge hinter einen **Hamburger-Drawer**. Beide
Darstellungen rendern aus einer gemeinsamen Ziel-Liste und führen
deshalb immer zu denselben Seiten. Der aktive Eintrag trägt
`aria-current`, jedes Ziel ist mindestens 44px groß, und alles
funktioniert über alle Themes hinweg. (Die Einstellungen-Seite hat
ihre eigene, separate Sektions-Seitenleiste für ihre Tabs - sie
gehört nicht zur Hauptnavigation.)

---

## Mobil: Bottom-Tab-Leiste (optional)

Auf dem Handy sitzt die Navigation standardmäßig oben als
Menü-Knopf. Unter *Einstellungen > Allgemein > Oberfläche* stellt
**Menüposition (mobil)** sie auf **Unten (Tab-Leiste)** um: eine
Leiste mit fünf daumenfreundlichen Tabs - **Lernen / Inhalte /
Lernpfad / Fortschritt / Mehr**. *Mehr* öffnet ein Bottom-Sheet mit
Einstellungen und Hilfe. Der Hamburger-Drawer bleibt in beiden
Positionen verfügbar. Die Ziele sind 44px groß, die Leiste
respektiert alle Themes und versteckt sich im Onboarding-Trichter
und während einer Lektion, damit nichts den Inhalt verdeckt.

---

## Hubs und Redirects

Zwei Seiten sind **getabbte Hubs**, die nur den aktiven Tab
einhängen:

- **ProgressHub** (`/progress`) bettet Fortschritt + Lern-
  Statistik + Curriculum ein.
- **Content-Hub** (`/content`) bettet Entdecken + Meine Inhalte +
  Importieren + Erstellen ein.

Alte URLs bleiben über Redirects erhalten, z.B. `/statistics` →
`/progress?tab=stats`, `/curriculum` → `/progress?tab=paths`,
`/discover` → `/content?tab=discover`, `/import` →
`/content?tab=import`.

---

## Verwandte Seiten

- [Fortschritt](progress.md) - die ProgressHub-Tabs
- [Content Browser](../features/content-browser.md) - Meine Inhalte
- [Inhalte entdecken](../features/discover.md) - der Katalog
