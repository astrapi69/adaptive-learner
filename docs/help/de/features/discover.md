# Inhalte entdecken

**Entdecken** ist der Ort, an dem du neue Lektions-Sets in der
gesamten Bibliothek findest und herunterlädst. Es lebt als
**Entdecken-Tab im Content-Hub** (`/content`); der ältere Link
`/discover` funktioniert weiterhin und leitet dorthin um.

Die Trennung ist Absicht: **Meine Inhalte** zeigt nur, was du
bereits heruntergeladen hast, während **Entdecken** der Katalog
ist, den du durchsuchst und aus dem du ziehst. So bleibt deine
tägliche Lernoberfläche frei von Sets, die du noch nicht gewählt
hast.

<!-- TODO: Screenshot — der Entdecken-Tab mit Suchindex und Download-Knöpfen pro Set -->

---

## Suchindex

Entdecken stützt sich auf einen **Suchindex** über den Katalog.
Die Eingabe filtert sofort über Set-Titel, Beschreibungen,
Domänen, Lektionstitel, Karten-Vorder- und -Rückseiten und Tags.
Die Suche ist tolerant gegenüber Groß-/Kleinschreibung und Akzenten
und versteht deutsche Digraphen (ae/oe/ue/ss). Der Index wird bei
der ersten Interaktion träge aufgebaut — kein Backend-Aufruf, er
funktioniert in beiden Speichermodi.

---

## Ein Set herunterladen

Jedes Ergebnis trägt eine **Download**-Aktion. Der Download kopiert
das Set in deinen lokalen Cache (IndexedDB im reinen Browser-Modus,
der Dateisystem-Cache im Server-Modus); danach erscheint es unter
**Meine Inhalte** und **Weitermachen** und ist offline spielbar.

Jedes Set zeigt ein **Quellen-Badge** — Offiziell / Gebündelt,
dein eigenes verbundenes Repo oder Offiziell empfohlen. Ein
Quellen-Filter schränkt den Katalog auf eine einzelne Quelle ein.
Siehe [Mehrere Content-Repositories](content-repos.md) zum
Verbinden und Verwalten eigener Quellen.

---

## Import-Tab

Der Content-Hub bietet außerdem einen **Import**-Tab, um einen
Chat-Export oder eine einzelne Lektionsdatei einzubringen. Alte
`/import`-Links leiten dorthin um.

---

## Verwandte Seiten

- [Content Browser](content-browser.md) — deine heruntergeladenen „Meine Inhalte"
- [Mehrere Content-Repositories](content-repos.md) — Quellen und Trust-Level
- [Lektionen und Wiederholungen](../user-guide/lessons.md) — der Lektionsablauf
