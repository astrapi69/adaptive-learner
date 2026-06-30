# Inhalte entdecken

**Entdecken** ist der Ort, an dem du neue Lektions-Sets in der
gesamten Bibliothek findest und herunterlädst. Es lebt als
**Entdecken-Tab im Content-Hub** (`/content`); der ältere Link
`/discover` funktioniert weiterhin und leitet dorthin um.

Die Trennung ist Absicht: **Meine Inhalte** zeigt nur, was du
bereits heruntergeladen hast, während **Entdecken** der Katalog
ist, den du durchsuchst und aus dem du ziehst. So bleibt deine
tägliche Lernoberfläche frei von Sets, die du noch nicht gewählt
hast. **Entdecken ist der Standard-Tab** des Content-Hubs, damit
neue Besucher zum Finden von Inhalten geführt werden statt auf einer
leeren „Meine Inhalte"-Seite zu landen.

<!-- TODO: Screenshot — der Entdecken-Tab mit Such-/Filter-Leiste, Ansicht-Umschalter und Download-Knöpfen pro Set -->

---

## Suche und Filter

Entdecken stützt sich auf einen **Suchindex** über den Katalog. Oben
sitzt eine **kompakte Such-/Filter-Leiste**: Tippe auf **Suche**, um
eine Anfrage einzugeben, oder auf **Filter**, um den Katalog mit
**kombinierbaren Filtern** einzugrenzen — **Sprache**, **Niveau**,
**Domäne**, **Trust**-Level und **KI-geprüft**. Suche und Filter
wirken zusammen, und die Leiste bleibt kompakt (sie klappt nur den
Teil aus, den du gerade nutzt), damit sie auf kleinen Bildschirmen
die Ergebnisse nicht verdrängt.

Die Eingabe filtert sofort über Set-Titel, Beschreibungen, Domänen,
Lektionstitel, Karten-Vorder- und -Rückseiten und Tags. Die Suche
ist tolerant gegenüber Groß-/Kleinschreibung und Akzenten und
versteht deutsche Digraphen (ae/oe/ue/ss). Der Index wird bei der
ersten Interaktion träge aufgebaut — kein Backend-Aufruf, er
funktioniert in beiden Speichermodi.

---

## Listen- und Kachelansicht

Entdecken nutzt dieselbe **globale Ansicht-Einstellung** wie *Meine
Inhalte*: Ein **Ansicht-Umschalter** wechselt den Katalog zwischen
einer kompakten **Liste** (Voreinstellung) und einem reicheren
**Kachel-Grid**. Änderst du sie hier, ändert sich auch *Meine
Inhalte*, und die Wahl wird gemerkt. Du kannst sie auch unter
**Einstellungen → Lernen** setzen.

---

## Ein Set herunterladen

Jedes Ergebnis trägt eine **Download**-Aktion. Der Download kopiert
das Set in deinen lokalen Cache (IndexedDB im reinen Browser-Modus,
der Dateisystem-Cache im Server-Modus); danach erscheint es unter
**Meine Inhalte** und ist offline spielbar.

Jedes Set zeigt ein **Quellen-Badge** — Offiziell / Gebündelt,
dein eigenes verbundenes Repo oder Offiziell empfohlen. Der
**Trust**-Filter (siehe oben) schränkt den Katalog auf eine einzelne
Quelle oder ein Trust-Level ein. Siehe
[Mehrere Content-Repositories](content-repos.md) zum Verbinden und
Verwalten eigener Quellen.

---

## Import-Tab

Der Content-Hub bietet außerdem einen **Import**-Tab, um einen
Chat-Export oder eine einzelne Lektionsdatei einzubringen. Die
**Aktionsbuttons** zum Importieren/Erstellen und deine **Meine
Lektionen** (selbst erstellte oder importierte Lektionen) leben jetzt
ebenfalls hier. Alte `/import`-Links leiten dorthin um.

---

## Verwandte Seiten

- [Content Browser](content-browser.md) — deine heruntergeladenen „Meine Inhalte"
- [Mehrere Content-Repositories](content-repos.md) — Quellen und Trust-Level
- [Lektionen und Wiederholungen](../user-guide/lessons.md) — der Lektionsablauf
