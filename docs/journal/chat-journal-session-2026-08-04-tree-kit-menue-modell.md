# Chat-Journal: tree-kit veröffentlicht, Menü-Modell entworfen, Launcher nachgezogen

Datum: 2026-08-04. Vier Repositories berührt: `adaptive-learner`, `tree-kit`
(neu), `bibliogon`, `topos`.

Kurzfassung des Ertrags: Ein Paket ist entstanden und wird benutzt, ein zweites
ist entworfen und begründet halbiert, ein drittes ist mit Zahlen abgelehnt
worden. Nebenbei fielen sechs Befunde derselben Form an — die Meldung war in
Ordnung, das Artefakt nicht.

Die Kette steht in den Vorgängen (#2341/#2342, #2343, #2344, #2345/#2346,
#2347, #2348/#2349, bibliogon #706/#707, #708/#709, #710, topos #8/#9/#10).
Hier stehen die Entscheidungswege, die offenen Punkte und die Fallen.

---

## 1. Was entstanden ist

### `@astrapi69/tree-kit@0.1.0` — veröffentlicht und im Einsatz

Der TypeScript-Port von `astrapi69/tree-api` + `gen-tree` lag seit Juni 2026
als eigener Ordner im Frontend (731 Zeilen). Er ist jetzt ein eigenes Paket,
und adaptive-learner konsumiert es (#2341, PR #2342: **9 Zeilen rein, 743
raus**).

Der Grund für den Neubau statt eines Umzugs war nicht Geschmack:

- `tree-model`, die einzige Abhängigkeit, wurde zuletzt **2018-05-12**
  veröffentlicht. Das verletzt `reusability.md` Stufe 3 direkt und hebt die
  Sache regelkonform auf Stufe 4.
- Jeder Zugriff allokierte einen neuen Wrapper, also war
  `a.parent() === b.parent()` für Geschwister **immer falsch**. `Set`,
  `useMemo`-Abhängigkeiten und `key`-Vergleiche waren damit unbrauchbar.
- `children()` lief den ganzen Teilbaum ab und filterte pro Knoten über
  `getPath()`. Beim Rendern ergibt das O(n²·Tiefe).

Entwurf: `TreeNode` als reine, zyklenfreie Daten, `TreeCursor` als flüchtiger
Navigationszeiger, Traversierung als Generator. Damit überleben Bäume
`JSON.stringify` und `structuredClone` unverändert.

**Wichtig für später:** `[Symbol.iterator]` gehört NICHT auf den Knoten. Eine
Methode ist eine eigene Eigenschaft, und `structuredClone` wirft bei
Funktionen — genau die Eigenschaft wäre kaputt, für die das Cursor-Modell
gewählt wurde. Der Iterator sitzt am Cursor.

Die Reihenfolge war der Ertrag: Die Migration lief als Wegwerf-Probe gegen ein
lokales Tarball, **bevor** veröffentlicht wurde. Die Oberfläche trug ohne eine
einzige Ergänzung. Damit ist die veröffentlichte Fassung eine, die benutzt
worden ist — statt einer, die nach der ersten Benutzung nachgebessert werden
muss.

### `editor-menu-model` — entworfen, nicht gebaut

Exploration in `bibliogon/docs/explorations/editor-menu-model.md` (#706, PR
#707). Kein Repository, kein Paket, keine Implementierung.

Der Befund, der das Vorhaben trägt: `bibliogon/lib/components/EditorMenu.tsx`
ist bereits ein Menü-Modell — ein Renderer, **vier Bauer** (Artikel, Buch,
Comic, Bilderbuch), Aktions-Dispatch über String-IDs, Deaktivierung mit
Begründung. Die Konsolidierung war bewusste, abgeschlossene Arbeit
(bibliogon #382).

Der stärkere Beleg ist ein anderer: bibliogons SETTINGS-MENU-ARCHITECTURE.md sind
636 Zeilen, geschrieben damit *ein anderes Projekt das Muster ohne Zugriff auf
die Quelle nachbaut* — und adaptive-learners Settings-Navigation ist das
Ergebnis. **Die Abstraktion existiert bereits, als Prosa.** Das ist die
teuerste Form von Wiederverwendung, die es gibt.

---

## 2. Entscheidungen und ihre Begründung

### Der Geltungsbereich halbiert sich

`editor-menu-model`, nicht `menu-core`. Eine Settings-Navigation trägt
Auswahlzustand, Testkennungen und eine Gefahren-Variante; ein Menü trägt
Aktionen, Trenner und Untermenüs. Sie ähneln sich nur aus genügender
Entfernung.

Der Prüfstein `sidebar-model.ts` (39 Zeilen) fiel an vier harten Blockern
durch — `testId` als Pflichtfeld ohne Gegenstück, `variant: "danger"`,
optionale Gruppenüberschrift, `activeTab` ohne Heimat. **Diese Blocker sind
kein Mangel des Modells, sondern der Beleg, dass es zwei Dinge sind.**

Ausdrücklich ausserhalb: Settings-Navigation und Hauptnavigation. Benannt,
damit niemand später glaubt, sie seien vergessen worden.

### Aktions-IDs sind eine geschlossene Menge

`MenuModel<TId extends string>` statt freier Zeichenkette. Das entscheidende
Argument war nicht die ungeprüfte Umdeutung, die es beseitigt, sondern der
Defekt darunter: **Keiner der vier `switch` hat einen `default`-Zweig**, also
tut eine vertippte oder umbenannte Kennung schlicht nichts. Erfolgreich
ausgeführt, falsches Ergebnis, kein Signal.

Preis: ein zweiter Typparameter auf sechs Deklarationen. Geschätzt war „ein
Typparameter", tatsächlich ist er sechsmal da — die Zeremonie gehört genau
beziffert.

### Der Fokus-Automat wird kein Paket

Mit Zahlen abgelehnt, damit es in einem Jahr nicht erneut vorgeschlagen wird.

`useMenuButtonBehavior.ts`: 143 Zeilen, davon 91 Code — 58
rahmenwerk-/DOM-gebunden, 12 reine Syntax, 12 Typdeklarationen, **9 echte
reine Logik**.

Der ausschlaggebende Befund: Der Haken hält **keinen Indexzustand**. Zwei
`useState`-Zellen, `open` und `pos`, keine davon verfolgt den Fokus. Jeder
Pfeiltastendruck leitet aus dem DOM ab und schreibt per `.focus()` zurück.
Einen Automaten herauszulösen hiesse Zustand **erfinden**, nicht vorhandenen
anheben.

Zwei Nebenkorrekturen: Es gibt **keinen** Roving-Tabindex (`grep tabIndex`
über Haken und beide Konsumenten: nichts), und es ist echter DOM-Fokus, kein
`aria-activedescendant` — letzteres wäre auch nicht verdrahtbar, die Einträge
haben keine `id`-Attribute.

### Auflage statt Risiko

Renderer und alle vier Bauer wechseln im **selben PR**. Drei Mechanismen
rendern sonst falsch, ohne einen Übersetzungsfehler zu erzeugen:

1. Die Trennerumbenennung — der Renderer verzweigt auf `item.separator`, und
   weil jedes `EditorMenuItem`-Feld optional ist, bleibt ein
   `{kind:"separator"}` zuweisbar. Er rendert **als Aktionszeile**.
2. Die `disabled`-Karte gehört drei Bauern gemeinsam und wird an **fünf**
   Renderstellen gelesen; die Prop ist optional und auf `{}` vorbelegt. Wer
   sie in einem Bauer weglässt, macht alle deaktivierten Einträge **aktiv**.
3. `readonly T[]` ist nicht auf `EditorMenuGroup[]` zuweisbar.

---

## 3. Offene Punkte

### Entscheidung beim Betreiber

**bibliogon #710 — ohne Authentifizierung, offen gebunden.**
`docker-compose.prod.yml:37` veröffentlicht `"${BIBLIOGON_PORT:-7880}:80"`
ohne Host-Präfix, also auf allen Schnittstellen. Belegt im Vorgang: keine
Auth-Bibliothek, keine Login-Route, keine Auth-Middleware. Wer den Port
erreicht, hat vollen Zugriff.

Der DAL-Bump behebt das **nicht** — 0.26.0 deckt nur `image`/`dockerfile`, im
Compose-Modus entscheidet die Compose-Datei. Steht so im PR, damit niemand den
Versionssprung für die Erledigung hält.

Vorlage im Vorgang: Loopback als Standard, eine Bind-Adress-Variable zum
bewussten Öffnen. Bricht für jeden, der es heute übers Netz erreicht — das ist
der Punkt.

**bibliogon #706 — editor-menu-model.** Alle zwölf Entwurfsentscheidungen
getroffen. Wartet auf einen dritten Verbraucher oder darauf, dass der
koordinierte Renderer-plus-Bauer-PR ohnehin ansteht.

### Arbeit, wenn Zeit ist

**#2343 — die Paritätsprüfung der Hauptnavigation prüft gegen sich selbst.**
Erwartungswert und DOM stammen aus derselben Konstante. Bei leerem
`NAV_TARGETS` läuft der ganze Block **grün**, während die App keine Navigation
rendert. Aufgefangen nur mobil, durch eine Literalliste; Desktop ist
ungedeckt.

Nebenbei: Der Docstring behauptet zwei Renderer. Es gibt **einen**
Konsumenten und **eine** Ausgabestelle, umgeschaltet per CSS-Variante. Der
Satz ist aus `sidebar-model.ts` übernommen, wo er stimmt.

**#2344 — die Settings-Navigation hat gar keine Paritätsprüfung.** Dort
existieren die zwei echt getrennten Komponenten, und nichts vergleicht sie;
ihre Testdaten unterscheiden sich sogar. Eine Prüfung muss auf `item.value`
schlüsseln, **nicht** auf `item.testId` — `SettingsMobileMenu` ignoriert das
Feld und leitet aus `value` ab.

**#2347 — die Entwickler-Doku beschreibt einen Aufbau, den es nicht mehr
gibt.** Vier Behauptungen gleichzeitig falsch: zwei Dienste statt einem
(`app`), nginx statt FastAPI für die Statics, Container-Port 80 statt 8000,
Standard-Port 7880 statt 8501. In beiden Sprachen. Der Beleg, dass nginx seit
#2058 weg ist, steht in einem **Testkommentar** — ein Kommentar weiss es, die
Dokumentation nicht.

### Nur benannt, nicht ausgearbeitet

Der TipTap-Kontextmenü-**Befehlssatz** existiert unabhängig in beiden
Repositories: `editorContextMenuActions.ts` (228 Zeilen, bibliogon) und
`editor-commands.tsx` (487 Zeilen, hier), rund dieselben 30 Kommandos. Das ist
gedoppelter **Inhalt**, nicht eine gedoppelte **Form** — ein eigenes Vorhaben.

### Pflicht, die an der ersten Paket-Nutzung hängt

`bibliogon/docs/SETTINGS-MENU-ARCHITECTURE.md` als **abgelöst kennzeichnen,
nicht löschen**, im selben PR wie die erste Paket-Nutzung. Ein Dokument, das
eine Anleitung zum Nachbauen ist, wird durch die Ablösung nicht falsch,
sondern irreführend — und irreführend fällt nicht auf.

---

## 4. Die Fallen, sechsmal dieselbe Form

Jedes Mal war die Meldung in Ordnung und das Artefakt nicht. Wer hier
weiterarbeitet, sollte die Form kennen, weil sie nicht auffällt.

1. **`gh pr merge` nahm einen veralteten Kopf.** PR #1 in tree-kit hatte
   `bdfd58f` gespeichert, der Zweig stand auf `2b55dc2` — per API vorher
   geprüft. Zwei Commits fielen still weg. Ohne Amend, ohne Force-Push.
   *Konsequenz: vor jedem Merge `pulls/<N> --jq .head.sha` gegen den
   gepushten SHA prüfen, danach die erwarteten Pfade auf dem Zielzweig
   belegen.*
2. **Ein Klon-Test belegte eine schwächere Aussage als der alte.** Er prüfte
   nur `cloned !== original` — was ein flacher Abzug ebenfalls erfüllt. Der
   alte mutierte den Abzug und prüfte das Original.
3. **npm meldete „Published", das Register antwortete 404.** Belastbar war der
   `PUT 200` im Protokoll, nicht der Lesepfad; sichtbar nach rund 270
   Sekunden. Meine erste Schlussfolgerung („restricted") war falsch.
4. **Ein gelöschtes Verzeichnis brach einen Doku-Verweis** — und mein erster
   Fix nicht, weil der Pfad in Backticks stehen blieb. Der Gate liest jedes
   gebacktickte Vorkommen als Existenzbehauptung, unabhängig vom Tempus.
5. **Ein Pin sah hinterher aus und war gedeckelt.** `^0.25.1` löst `<0.26.0`
   auf; `>=48,<50` schliesst den Fix ausdrücklich aus. Nicht Versionsstrings
   vergleichen, sondern ausrechnen, worauf der Pin **auflöst**.
6. **Ein leerer Diff war ein Pfadfehler.** `git diff -- backend/poetry.lock`
   aus `backend/` heraus löst auf `backend/backend/…` auf und kommt leer
   zurück. Ein leeres Ergebnis ist kein Befund, solange nicht geprüft ist, ob
   überhaupt etwas geprüft wurde.

---

## 5. Was ich falsch hatte

Stehen gelassen, weil ein Bericht, der seine eigenen Fehler verschweigt, ihre
Wiederholung einlädt.

- **„`nav-targets.ts` ist ein Modell mit zwei Renderern."** Falsch — ein
  Renderer mit CSS-Variante. Ich hatte die Behauptung aus dem Docstring
  ungeprüft übernommen. Damit zählt es **nicht** als zweite Instanz des
  Musters.
- **„`useMenuButtonBehavior` implementiert einen Roving-Tabindex."** Falsch —
  es gibt keinen `tabIndex` im Haken oder in seinen Konsumenten.
- **„Der Prüfstein ist ein Verbraucher."** Falsch — er ist eine andere Form.
  Ihn als Prüfstein einzuführen war richtig, ihn bestehen zu erwarten nicht.
- **Ein Zitat mit richtiger Zeilennummer und falschem Pfad.** Von einem
  Agenten übernommen und verkürzt. Der Unterschied lag nicht in mehr
  Sorgfalt, sondern darin, danach die übrigen sieben tragenden Zitate
  **einzeln** gegen den Baum zu halten, statt aus dem einen Fund zu
  schliessen, der Rest sei in Ordnung.
- **Eine Konfiguration geändert und ihre Zusicherung stehen gelassen.** Alle
  drei Launcher-Builds fielen daran. Behoben nicht durch Umdrehen des Wertes,
  sondern durch Pinnen der **Regel** — beide Hälften, ohne Bedingung, weil
  eine bedingte Zusicherung bei einem Moduswechsel fehl-offen grün geblieben
  wäre.

---

## 6. Zwei Sicherheitsbefunde, verschiedener Ausgang

**`cryptography` 49.0.0, CVE-2026-69247 (HIGH):** ein **blockiertes Gate, kein
Vorfall**. Die verwundbare Stelle ist PKCS#7-`EnvelopedData`-Entschlüsselung —
`grep` über `backend/app` und `plugins`: kein Treffer. Genutzt wird
ausschliesslich `Fernet`. Behoben (#2348/#2349), weil eine bekannte
HIGH-Meldung auszuliefern keine verteidigbare Position ist, nicht weil wir
betroffen waren.

**bibliogons offene Bindung:** der umgekehrte Fall. Das Gate schweigt, weil im
Compose-Modus die Compose-Datei entscheidet, und der Befund ist echt, weil
keine Authentifizierung dahintersteht.

Die Lehre daraus ist nicht „Gates ernst nehmen", sondern: Ein rotes Gate sagt
nichts über die Betroffenheit, und ein grünes nichts über die Sicherheit. Die
Frage, die beides entscheidet, war hier in drei Suchen beantwortet.
