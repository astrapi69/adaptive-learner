# EXP-030: Multi-User-Strategie

**Kategorie:** Querschnitt / Vision · **Phase:** gestuft (Stufe 1 lokal ab
Phase 2, Stufe 3 Cloud ab Phase 4) · **Priorität:** P3 (Vision; Stufe 1 ist
ein kleiner, additiver Schritt, Stufe 3 ist ein großes Cloud-Thema) ·
**Abhängig von:** dem bestehenden Single-User-Modell (`learnerState.ts`,
`User`-Tabelle), EXP-009 (Cloud/Social), der Sync-Architektur
([docs/SYNC-ARCHITECTURE.md](../SYNC-ARCHITECTURE.md)) · **Issue:** —

> Design-Dokument. Kein Code. Es beschreibt, **wie** Adaptive Learner vom
> heutigen Ein-Nutzer-Modell zu mehreren Nutzern wächst — und vor allem, in
> **welcher Reihenfolge**, damit jeder Schritt für sich nützlich ist und keiner
> ein Cloud-Backend voraussetzt, das es noch nicht gibt. Die zentrale Aussage:
> **Multi-User ist nicht ein Sprung, sondern drei Stufen** — lokale Profile,
> Geräte-Kopplung, Cloud-Konten — und die ersten beiden brauchen **keinen
> Server**.

---

## 0. Was es heute schon gibt (Ist-Stand)

Die App ist heute bewusst **Single-User, Local-First**:

| Baustein | Datei | Status |
|---|---|---|
| Aktiver Lerner (`user_id` / `project_id`) in `localStorage` | `frontend/src/lib/learnerState.ts` | **da** (Single-User-Annahme explizit dokumentiert) |
| `User`-Tabelle (mehrere Zeilen technisch möglich) | `backend/app/models/__init__.py` (`User`) | **da** — das Datenmodell ist NICHT auf einen Nutzer beschränkt |
| Wiederherstellung des „zuletzt aktiven" Nutzers | `users.findMostRecent()` (Api + Dexie) | **da** — sortiert bereits über mehrere `users`-Zeilen |
| Duale Speicherung (Server / Browser-IndexedDB) | `IStorageService` (`ApiStorage` / `DexieStorage`) | **da** |
| LAN-Sync-Architektur (Geräte-Pairing per QR) | [docs/SYNC-ARCHITECTURE.md](../SYNC-ARCHITECTURE.md), `SYNC-UI-GATE` | **konzipiert** (Phase-1-LAN noch nicht implementiert) |
| Editierbarer Anzeigename + Profilbild | Settings > Profil (#508, #560, #579) | **da** |

Schlüsselbeobachtung: **Das Datenmodell ist bereits mehr-nutzer-fähig.**
`learnerState.ts` sagt es selbst — der `user_id`/`project_id`-Park in
`localStorage` ist die Single-User-**Bequemlichkeit**, nicht eine Modell-Grenze.
Jede Domänen-Tabelle ist über eine nicht-nullbare `user_id`-Spalte ge-scoped
(siehe `sync_service`-Ownership-Checks). Der eigentliche Engpass ist also nicht
das Schema, sondern: (a) **Identität** (wer ist „der aktive Nutzer", wenn es
mehrere gibt), (b) **Isolation** (sieht Nutzer A nie Nutzer Bs Daten) und (c)
ab Stufe 3 **Auth** (gibt es überhaupt keinen Login-Layer heute).

**Was fehlt** (= der Inhalt dieses Dokuments): eine **gestufte Strategie**, die
jeden dieser drei Engpässe in der richtigen Reihenfolge angeht, ohne Stufe 3
(Cloud) als Voraussetzung für Stufe 1 (lokale Profile) zu machen.

---

## 1. Idee

„Multi-User" meint drei sehr verschiedene Dinge, die oft verwechselt werden:

1. **Mehrere Profile auf EINEM Gerät** — Familie teilt ein Tablet, Lehrer hat
   eine Klassen-Station, eine Person trennt „Spanisch" von „Japanisch". Kein
   Netz, kein Login, nur ein Profil-Umschalter.
2. **EIN Nutzer auf MEHREREN Geräten** — dieselbe Person lernt am Desktop und am
   Handy; die Daten sollen zusammenfließen. Das ist **Sync**, nicht Multi-User
   im engeren Sinn (die Sync-Architektur existiert bereits konzeptuell).
3. **VIELE Nutzer mit Konten** — echte Accounts, serverseitige Identität,
   Klassen/Gruppen, geteilter Fortschritt. Braucht ein Cloud-Backend und einen
   Auth-Layer (heute beides nicht vorhanden).

Der Fehler wäre, (3) zu bauen, um (1) zu bekommen. (1) ist ein kleiner,
additiver Schritt auf dem bestehenden Modell; (3) ist ein eigenes Produkt.

---

## 2. Die drei Stufen

| Stufe | Was | Server nötig? | Auth nötig? | Aufwand | Phase |
|---|---|---|---|---|---|
| **1 — Lokale Profile** | Mehrere `users`-Zeilen pro Installation + Profil-Umschalter; `learnerState` zeigt auf das aktive Profil. | nein | nein | S–M | 2 |
| **2 — Geräte-Kopplung** | EIN Nutzer, mehrere Geräte; LAN-Sync (QR-Pairing) gleicht die Profile ab. | nein (LAN) | nein | M (= Sync-Impl.) | 2–3 |
| **3 — Cloud-Konten** | Echte Accounts, serverseitige Identität, Gruppen/Klassen. | **ja** | **ja** | L | 4 |

Stufe 1 und 2 sind **Local-First** und passen zur heutigen Architektur. Stufe 3
ist deckungsgleich mit EXP-009 (Cloud/Social, Phase 4) und steht und fällt mit
einer validierten Nutzerbasis aus Phase 1–3.

---

## 3. Stufe 1 — Lokale Profile (der nächste sinnvolle Schritt)

**Ziel:** Mehrere Lerner teilen sich eine Installation, ohne dass sich ihre
Daten vermischen — und ohne Netz oder Login.

**Was sich ändert:**

- **`learnerState` wird zum aktiven Profil-Zeiger.** Heute hält es genau ein
  `user_id`. Stufe 1 macht daraus „das **aktive** unter mehreren". Die Keys
  (`adaptive-learner.user_id` / `.project_id`) bleiben; neu ist ein
  **Profil-Umschalter** (Liste aller `users`-Zeilen via einer neuen
  `users.list()`-Methode, die in beiden Modi existiert — `findMostRecent`
  iteriert heute schon über alle Zeilen, die Lese-Infrastruktur ist also da).
- **Isolation ist bereits gegeben.** Jede Tabelle ist `user_id`-ge-scoped; ein
  Profilwechsel ändert nur den Zeiger, alle Reads filtern ohnehin nach
  `user_id`. Hier ist die Hauptarbeit, sicherzustellen, dass **kein** Read den
  Filter vergisst (ein gezielter Audit, kein Umbau).
- **UI:** ein Profil-Avatar-Menü (baut auf `NavAvatar` auf) mit „Profil
  wechseln" / „Profil hinzufügen" / „Profil umbenennen". Onboarding wird
  wiederverwendet, um ein zweites Profil anzulegen.
- **Optional: PIN-Schutz pro Profil** (lokal, gehasht) — gegen versehentlichen
  Wechsel, nicht als echte Sicherheit. Kein Auth-Layer.

**Was sich NICHT ändert:** Datenmodell, Sync-Surface, Storage-Abstraktion. Stufe
1 ist additiv.

**Abgrenzung zum heutigen `findMostRecent`:** Das ist ein
**Recovery**-Mechanismus (localStorage leer, IndexedDB voll). Stufe 1 macht aus
„rate den einen Nutzer" ein „wähle bewusst aus mehreren" — dasselbe Lesen, neue
Absicht.

---

## 4. Stufe 2 — Geräte-Kopplung (= Sync)

EIN Mensch, Desktop + Handy. Das ist **kein** neues Multi-User-Thema, sondern
die Umsetzung der bereits konzipierten **LAN-Sync-Architektur**
([docs/SYNC-ARCHITECTURE.md](../SYNC-ARCHITECTURE.md)): Desktop (API-Modus)
erzeugt einen QR-Code, das Handy (Dexie-Modus) scannt ihn, danach gleichen die
Geräte das `user_id`-ge-scopte Sync-Surface ab.

Der relevante Punkt für DIESES Dokument: Stufe 1 und Stufe 2 **interagieren**.
Sobald es lokale Profile (Stufe 1) UND Sync (Stufe 2) gibt, muss der Sync wissen,
**welches** Profil er abgleicht. Empfehlung: Sync ist **pro Profil**, das
Pairing transportiert die `user_id`-Identität mit. Die in der Sync-Architektur
offene Drei-Rollen-Frage (Desktop-Server / Mobile-Client / PWA-only) bleibt
bestehen und ist die eigentliche Voraussetzung für Stufe 2.

---

## 5. Stufe 3 — Cloud-Konten (EXP-009-Territorium)

Echte Accounts mit serverseitiger Identität, Gruppen/Klassen (Lehrer sieht
Schüler-Fortschritt), geräteübergreifend ohne LAN. Das verlangt:

- einen **Auth-Layer** (heute gibt es **keinen** — bewusst, „Single-User
  Desktop, kein Login"), inkl. der Sicherheits-Implikationen (die Ownership-
  Checks in `sync_service` sind die Grundlage, reichen aber für eine echte
  Mehr-Mandanten-Welt nicht aus);
- ein **Cloud-Backend** (heute SQLite-lokal);
- eine Antwort auf **Datenschutz/DSGVO** (Lerndaten auf fremden Servern).

Stufe 3 ist deckungsgleich mit EXP-009 und gehört in **Phase 4** — erst nach
einer validierten Nutzerbasis. Sie ist explizit **kein** kurzfristiges Ziel und
**keine** Voraussetzung für Stufe 1/2.

---

## 6. Offene Fragen + Empfehlungen

1. **Brauchen wir Stufe 1 überhaupt, oder reicht Sync (Stufe 2)?**
   *Empfehlung: Stufe 1 zuerst.* Lokale Profile lösen den häufigsten realen Fall
   (geteiltes Familien-/Klassen-Gerät) ohne jede Netz-Abhängigkeit und sind ein
   kleiner additiver Schritt. Sync löst einen anderen Fall (eine Person, viele
   Geräte) und ist aufwendiger (Pairing-Flow).

2. **Wie wird das aktive Profil gewählt, wenn mehrere existieren?**
   *Empfehlung: expliziter Umschalter + „zuletzt aktiv" als Default.*
   `findMostRecent` liefert den Default; der Umschalter macht die Wahl bewusst.
   Kein Auto-Raten ohne UI, sobald >1 Profil existiert.

3. **PIN/Passwort pro lokalem Profil?**
   *Empfehlung: optionaler lokaler PIN, klar als „kein echter Schutz"
   kommuniziert.* Echte Auth gehört zu Stufe 3, nicht zu Stufe 1.

4. **Was passiert mit `learnerState`-Recovery (`findMostRecent`) bei mehreren
   Profilen?** *Empfehlung: Recovery wählt das zuletzt aktive Profil, bietet
   danach den Umschalter an* — kein stilles Festlegen auf eine Identität.

5. **Migration bestehender Single-User-Installationen?**
   *Empfehlung: keine Migration nötig.* Eine bestehende Installation IST bereits
   „ein Profil"; Stufe 1 fügt nur die Möglichkeit eines zweiten hinzu. Das ist
   der Grund, Stufe 1 vor Stufe 3 zu bauen — sie ist rückwärtskompatibel by
   construction.

6. **Sync-Identität bei lokalen Profilen (Stufe 1 × Stufe 2)?**
   *Empfehlung: Sync pro Profil, Pairing transportiert die `user_id`.* Siehe §4.

---

## 7. Roadmap-Tasks

Prefix `MU-`. Aufwand: S/M/L. Reihenfolge = empfohlene Umsetzung. MU-01..05 sind
**Stufe 1** (lokal, additiv, kein Server); MU-10 ist die Brücke zu Stufe 2;
MU-20 markiert Stufe 3 (= EXP-009, Phase 4).

| ID | Task | Abhängig | Aufwand |
|----|------|----------|---------|
| MU-01 | `users.list()` in beiden Storage-Modi (Api + Dexie) — die Lese-Infra existiert via `findMostRecent`, nur als bewusste Liste exponiert. | IStorageService | S |
| MU-02 | Profil-Umschalter-UI (Avatar-Menü auf `NavAvatar` aufsetzend): wechseln / hinzufügen / umbenennen; Onboarding zum Anlegen wiederverwendet. | MU-01, #579 | M |
| MU-03 | **Isolations-Audit:** jeder Read filtert nach `user_id`; kein Pfad zeigt fremde Daten beim Profilwechsel. Regressions-Pins. | MU-01 | M |
| MU-04 | Aktives Profil = `learnerState`-Zeiger; sauberer Wechsel ohne Reload (Caches/Contexts invalidieren). | MU-02, MU-03 | M |
| MU-05 | Optionaler lokaler PIN pro Profil (gehasht, klar „kein echter Schutz"); i18n in 9 Sprachen (`profile.*`). | MU-04 | S |
| MU-10 | Sync-Identität pro Profil: das LAN-Pairing transportiert die `user_id`; Sync gleicht das aktive Profil ab. | MU-04, Sync-Architektur | M |
| MU-20 | **Stufe 3 (Cloud-Konten):** Auth-Layer + Cloud-Backend + Gruppen/Klassen. = EXP-009, Phase 4, eigene Exploration. | EXP-009, validierte Nutzerbasis | L |

MU-01..05 sind der realistische nächste Schritt (klein, additiv, Local-First).
MU-20 ist bewusst ein eigener, großer Block und **kein** Einstieg.

---

## Bewertung

Das teure Missverständnis bei „Multi-User" ist, sofort an Cloud-Konten (Stufe 3)
zu denken und damit ein Backend + Auth zu fordern, das es nicht gibt. Die
Architektur trägt aber bereits den **günstigen, wertvollen Teil**: das
Datenmodell ist `user_id`-ge-scoped, `findMostRecent` iteriert schon über
mehrere `users`-Zeilen, und die Storage-Abstraktion ist mehr-nutzer-neutral.

**Stufe 1 (lokale Profile) ist deshalb ein kleiner, additiver Schritt** — ein
Profil-Umschalter plus ein Isolations-Audit, kein Server, kein Login, keine
Migration. Stufe 2 (Geräte-Kopplung) ist die Umsetzung der bereits konzipierten
Sync-Architektur. Erst Stufe 3 (Cloud-Konten) ist ein großes Cloud-Thema und
deckungsgleich mit EXP-009 in Phase 4.

**Kein MVP-Blocker.** Stufe 1 ist additiv und Local-First; Stufe 3 wartet auf
eine validierte Nutzerbasis. Der Engpass für echte Multi-Mandanten-Fähigkeit ist
nicht das Schema, sondern Auth + Cloud-Backend — und das ist bewusst eine
Phase-4-Entscheidung, kein heutiger Code.
