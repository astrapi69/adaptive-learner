# EXP-037: Navigation Restructuring

**Kategorie:** Querschnitt (UX / Information Architecture)
**Phase:** 2
**Priorität:** Hoch
**Abhängig von:** 022 (Lernpfad), 034 (Discover), 032/033 (Content), Settings-Nav
**Status:** Exploration → Implementierung (zweiphasig: dieses Dokument = Phase 1)

---

## 1. Problem

Das aktuelle Top-Level-Menü (`frontend/src/components/Navigation.tsx`) hat
**12+ primäre Einträge**:

Dashboard · Lernpfad · Session · Curriculum · Fortschritt · Statistik ·
Import · Anki · Meine Inhalte · Inhalte entdecken · Einstellungen · Hilfe

Das verstößt gegen etablierte Information-Architecture-Best-Practice:

- **Nielsen Norman Group:** maximal **5–7** primäre Navigationseinträge. Mehr
  erzeugt Entscheidungslähmung ("paradox of choice") und erhöht die kognitive
  Last bei jeder Navigation.
- **Vergleich mit Referenz-Apps derselben Domäne:**
  - Duolingo: **5** Tabs (Lernen, Liga, Quests, Shop, Profil)
  - Anki (Mobile): **4** primäre Bereiche
  - Quizlet: **5** Tabs

Zusätzliche Symptome im Ist-Zustand:

- Mehrere Einträge sind eigentlich **Aktionen**, keine Orte (Import, Anki).
- Mehrere Einträge sind **Unteransichten desselben Themas** (Fortschritt vs.
  Statistik vs. Curriculum betreffen alle "mein Lernfortschritt").
- **Session** ist kein Ziel, das man "aufsucht", sondern etwas, das man aus
  Dashboard / Lektion **startet**.
- Auf Mobile ist eine 12-Einträge-Liste hinter einem Hamburger schwer
  scannbar (kein Bottom-Tab-Pattern, das mobile Nutzer erwarten).

---

## 2. Ist-Zustand

### Navigationskomponente

`frontend/src/components/Navigation.tsx` — eine horizontale, sticky Top-Bar
(`<nav class="app-nav">`), die auf Mobile (≤768px) hinter einem Hamburger zu
einem Drawer kollabiert. Sie ist auf den Pre-Onboarding-Routen (`/`,
`/onboarding`, `/assessment`) ausgeblendet und kollabiert während aktiver
Lektionen (`is-lesson-compact`, Auto-Hide beim Scrollen).

Aktuelle Nav-Einträge (`NavLink` + `data-testid`):

| Reihenfolge | Eintrag         | testid             | Route            |
| ----------- | --------------- | ------------------ | ---------------- |
| 1           | Dashboard       | `nav-dashboard`    | `/dashboard`     |
| 2           | Lernpfad        | `nav-learning-path`| `/learning-path` |
| 3           | Session         | `nav-session`      | `/session`       |
| 4           | Curriculum      | `nav-curriculum`   | `/curriculum`    |
| 5           | Fortschritt     | `nav-progress`     | `/progress`      |
| 6           | Statistik       | `nav-statistics`   | `/statistics`    |
| 7           | Import          | `nav-import`       | `/import`        |
| 8           | Anki            | `nav-anki`         | `/anki`          |
| 9           | Meine Inhalte   | `nav-content`      | `/content`       |
| 10          | Entdecken       | `nav-discover`     | `/discover`      |
| 11          | Einstellungen   | `nav-settings`     | `/settings`      |
| 12          | Hilfe           | `nav-help`         | (öffnet Drawer)  |

Daneben rechts: Review-Badge, XP-Badge, Avatar, Sync-/Online-Indikator,
Theme-Toggle (keine Navigationsziele — bleiben).

### Routen (`frontend/src/App.tsx`)

Alle 12 Ziele plus Deep-Link-Routen (`/import/:conversationId`,
`/lesson/...`, `/review/:setId`, `/adaptive-lesson/:setId`,
`/projects/:projectId/learning-repo`, `/pronunciation`, `/create-lesson`,
`/add-repo`). Hilfe ist KEINE Route — sie öffnet den `HelpDrawer` in-place.

> Audit-Befehle (im Repo verifiziert):
> ```bash
> grep -rn "NavLink\|nav-link\|data-testid=\"nav-" \
>   frontend/src/components/Navigation.tsx
> grep -rn "<Route " frontend/src/App.tsx
> ```

---

## 3. Ziel-Struktur

### Desktop (gruppiert)

```
LERNEN
  Dashboard              (Start, Weiterlernen, Review-Badge)
  Lernpfad               (Pfad-Visualisierung)
INHALTE
  Meine Inhalte          (heruntergeladene Sets + Anki-Export als Aktion)
  Entdecken              (neue Sets finden + Import als Tab)
FORTSCHRITT
  Übersicht              (Fortschritt + Statistik + Curriculum zusammen)
──────────
  Einstellungen          (Icon, unten)
  Hilfe                  (Icon, unten)
```

→ **5 primäre Ziele** + **2 Utility-Icons** = **7 Einträge** (statt 12).

Die Gruppierung erfolgt über eine neue, wiederverwendbare `NavGroup`-Komponente
(Sektions-Header in Caps, kleiner Font, Token-backed). Sie ist in der
vertikalen Navigationsfläche (Mobile-Drawer; perspektivisch eine vertikale
Sidebar) sinnvoll; auf der horizontalen Desktop-Bar bleibt die Gruppen-
Reihenfolge erhalten, die Header werden visuell dezent gehalten.

### Mobile Bottom Tab Bar (5 Items)

```
[Lernen]  [Inhalte]  [Entdecken]  [Fortschritt]  [Mehr ⋯]
```

- `Lernen`     → `/dashboard`
- `Inhalte`    → `/content`
- `Entdecken`  → `/discover`
- `Fortschritt`→ `/progress`
- `Mehr ⋯`     → öffnet ein Bottom-Sheet/Drawer mit **sekundärer Navigation**:
  Lernpfad · Einstellungen · Hilfe

44px Touch-Targets, kein Text-Wrap, Token-backed, alle Themes. Ausgeblendet
auf Pre-Onboarding-Routen und während aktiver Lektionen (dort besitzt der
Lesson-Footer den unteren Bildschirmrand).

### Responsive Breakpoints

| Breite              | Surface                                            |
| ------------------- | -------------------------------------------------- |
| `< 640px` (mobile)  | Bottom Tab Bar (5 Items) + Hamburger-Drawer        |
| `>= 640px` (tablet) | Top-Bar (reduziert) + optional Bottom Tab Bar      |
| `>= 1024px`(desktop)| Top-Bar / Sidebar mit Labels, gruppiert            |

---

## 4. Zusammenlegungen

### A) Dashboard + Session

Session ist **kein eigenständiger Menüpunkt**. Eine Session startet aus dem
Dashboard ("Weiterlernen") oder aus einer Lektion. Route `/session` **bleibt**
(aktive Sessions, Deep-Links), aber **kein Nav-Eintrag**.

### B) Fortschritt + Statistik + Curriculum

Eine Sammelseite **"Fortschritt"** (`/progress`) mit **3 Tabs**:

- **Übersicht** — aktueller Fortschritt, XP, Level (bestehende `Progress`-Seite)
- **Statistik** — Heatmap, Charts, Details (bestehende `LearningStatistics`)
- **Meine Pfade** — Curriculum Builder (bestehende `Curriculum`-Seite)

Die Seiten-Komponenten werden **nicht umgeschrieben**, nur als Tab-Inhalte
eingehängt (Lazy-Loading pro Tab, jeweils nur der aktive Tab gemountet, damit
keine doppelten `<main>`-Landmarks entstehen).

### C) Anki

**Kein eigener Menüpunkt.** Der Anki-Export ist eine **Aktion**:

- Einstiegspunkt auf **"Meine Inhalte"** (Header-Aktion bzw. Set-Zeile).
- Perspektivisch zusätzlich in der Lektions-Detailseite.

Route `/anki` **bleibt** als Ziel dieser Aktion und für Deep-Links erreichbar.

> **Abweichung vom ursprünglichen Vorschlag (`/anki → /content` Redirect):**
> Ein harter Redirect `/anki → /content` würde die **gesamte Anki-Seite
> unerreichbar** machen — sie IST die Anki-Oberfläche. Das verletzt die
> Kern-Regel **"KEIN Funktionsverlust"**. Stattdessen: `/anki` bleibt
> erreichbar, der Nav-Eintrag entfällt, der Zugang läuft über eine sichtbare
> Aktion auf "Meine Inhalte". (Siehe Offene Fragen Q3.)

### D) Import

**Kein eigener Menüpunkt.** Import ist ein **Tab in "Entdecken"**
(`/discover?tab=import`) bzw. eine Aktion auf "Meine Inhalte". Route `/import`
**bleibt** (redirectet auf den Tab), `/import/:conversationId` (ImportDetail)
bleibt als eigenständige Deep-Link-Route.

---

## 5. Routen-Mapping (alt → neu)

| Alt            | Neu                     | Nav-Eintrag?                |
| -------------- | ----------------------- | --------------------------- |
| `/dashboard`   | `/dashboard`            | **Ja** (Lernen)             |
| `/learning-path`| `/learning-path`       | **Ja** (Lernpfad)*          |
| `/session`     | `/session`              | Nein (Start aus Dashboard/Lektion) |
| `/curriculum`  | `/progress?tab=paths`   | Nein (Tab in Fortschritt)   |
| `/progress`    | `/progress`             | **Ja** (Fortschritt)        |
| `/statistics`  | `/progress?tab=stats`   | Nein (Tab in Fortschritt)   |
| `/import`      | `/discover?tab=import`  | Nein (Tab in Entdecken)     |
| `/anki`        | `/anki`                 | Nein (Aktion, kein Nav)     |
| `/content`     | `/content`              | **Ja** (Meine Inhalte)      |
| `/discover`    | `/discover`             | **Ja** (Entdecken)          |
| `/settings`    | `/settings`             | **Ja** (Icon, unten)        |
| Hilfe          | (Drawer)                | **Ja** (Icon, unten)        |

\* Lernpfad ist auf Desktop ein primärer Eintrag (Gruppe LERNEN) und auf
Mobile in den **"Mehr ⋯"**-Drawer verschoben (sekundär), um die Bottom-Bar
bei 5 Items zu halten.

---

## 6. Redirects

Alte Routen müssen weiterhin funktionieren (Bookmarks, geteilte Links). Sie
redirecten auf die neue Position:

```
/statistics → /progress?tab=stats
/curriculum → /progress?tab=paths
/import     → /discover?tab=import   (ABER /import/:id bleibt = ImportDetail)
/anki       → bleibt erreichbar (Aktion aus „Meine Inhalte“); KEIN Redirect,
              um Funktionsverlust zu vermeiden
/session    → bleibt (eigene Empty-State-Logik → /onboarding); KEIN Nav-Eintrag
```

Implementierung über React-Router `<Navigate replace />`-Routen, damit die
History sauber bleibt und der Back-Button nicht auf der alten URL hängt.

---

## 7. Offene Fragen

- **Q1 (vertikale Sidebar vs. Top-Bar): GELÖST (#1391).** Der Endzustand ist
  die **horizontale Top-Bar** als einzige primäre Desktop-Navigation, plus
  Bottom-Tab-Bar und gruppierter Drawer auf Mobile (eine primäre Navigation
  pro Viewport). Die früher angedachte vollständige **vertikale Desktop-Sidebar
  wurde verworfen** und nicht dauerhaft umgesetzt (der kurzlebige
  Sidebar-Prototyp aus #1260 wurde in #1391 wieder entfernt). Der historische
  Kontext unten bleibt zur Nachvollziehbarkeit stehen.
- **Q2 (Tablet-Doppelung):** Bei 640–1024px sowohl Top-Bar als auch
  Bottom-Bar zu zeigen, kann redundant wirken. Vorschlag: Bottom-Bar nur
  `< 768px`, Top-Bar ab `>= 768px` — eindeutige Grenze, keine Doppelung.
- **Q3 (Anki-Einstieg):** Header-Aktion auf "Meine Inhalte" vs. Dropdown pro
  Set-Zeile. Set-Zeilen-Dropdown ist granularer, aber teurer; Header-Aktion
  ist der pragmatische erste Schritt. Lektions-Detail-Button als Folge.
- **Q4 (Tab-Deep-Links):** `?tab=` als Query-Param (gewählt) vs.
  Sub-Routen (`/progress/stats`). Query-Param ist additiv, kollidiert nicht
  mit bestehenden Routen und ist mit der Settings-`?tab=`-Konvention
  konsistent.

---

## 8. Evaluation

**Nutzen:**

- Reduktion von 12 → 7 primären Einträgen senkt die kognitive Last messbar und
  bringt die App auf das Niveau etablierter Lern-Apps.
- Mobile bekommt ein erwartungskonformes Bottom-Tab-Pattern (Daumenreichweite).
- Verwandte Ansichten (Fortschritt/Statistik/Curriculum) werden thematisch
  zusammengeführt — weniger "Wo war das nochmal?".
- **Kein Funktionsverlust:** jede Seite bleibt erreichbar; nur die Einstiege
  werden umorganisiert.

**Kosten / Risiken:**

- Tab-Hubs müssen bestehende Seiten-Komponenten einhängen, ohne sie zu
  duplizieren (nur aktiver Tab gemountet — sonst doppelte `<main>`/`testid`).
- Redirects müssen Deep-Links (`/import/:id`) ausnehmen.
- Visual-Baselines + Dexie-Smoke-Routenliste + E2E-Selektoren müssen
  nachgezogen werden.
- Die vollständige vertikale Sidebar bleibt bewusst ein Folge-Increment.

**Empfehlung:** Umsetzen (Phase 2), in der unter Q1 beschriebenen
risikoarmen Variante. Headline-Metrik: **7 statt 12** Nav-Einträge, alle
Features erreichbar, `make test` + `make test-dexie-smoke` grün.
