# Content Browser

Der **Content Browser** („Meine Inhalte") ist der **Meine-Inhalte-
Tab des Content-Hubs** unter `/content`. Er zeigt nur die
Lektionssätze, die du bereits heruntergeladen hast, rund um den
Lernfluss aufgebaut: zuerst Suche, dann Weitermachen, dann dein
lokaler Katalog. Um *neue* Sätze zu finden und herunterzuladen,
nutze den **Entdecken**-Tab — siehe
[Inhalte entdecken](discover.md).

<!-- TODO: Screenshot — Content Browser mit Suchfeld, Continue-Learning-Bereich und Set-Baum -->

---

## Suche

Ganz oben steht ein **Suchfeld über die volle Breite**. Es filtert
sofort (entprellt, gegen den lokal zwischengespeicherten Katalog)
über Set-Titel, Beschreibungen, Domäne, Lektionstitel,
Karten-Vorder- und -Rückseiten sowie Tags. Die Suche ist
gegenüber Groß-/Kleinschreibung und Akzenten **tolerant** und
kennt deutsche Digraphen (ae/oe/ue/ss). Treffer ersetzen den
Katalog-Baum, mit Hervorhebung, Trefferzahl und Leerzustand.
`Cmd/Ctrl + K` springt direkt ins Suchfeld.

---

## Weitermachen

Direkt unter der Suche zeigt **Weitermachen** die zuletzt
berührte Lektion pro Satz, jeweils mit genau einer Aktion:
**fortsetzen** (laufende/pausierte Lektion, Schritt n von gesamt),
**nächste** Lektion samt Sternen nach einem Abschluss, oder
**Satz abgeschlossen**.

---

## Sprachen und Wissen

Der Katalog teilt sich in zwei Bäume:

- **Sprachen** — als Baum *Quellsprache → Zielsprache → Niveau*,
  gefiltert auf deine App-Sprache (zusätzliche Quellsprachen
  kannst du in Einstellungen → Lernen aktivieren).
- **Wissen** — Nicht-Sprach-Domänen (z. B. Programmierung,
  Psychologie) mit eigenen Symbolen.

---

## Quell-Badges und Quell-Filter

Jeder heruntergeladene Satz trägt ein **Quell-Badge**, das zeigt,
woher er stammt:

- **Offiziell** / **Bundled** — aus dem offiziellen Katalog bzw.
  in die App eingebaut.
- **Eigenes Repo** — aus einem von dir verbundenen Repository.
- **Offiziell empfohlen** — aus der kuratierten Empfehlungsliste.

Ein **Quell-Filter** blendet bei Bedarf nur Sätze einer
bestimmten Quelle ein. Mehr dazu unter
[Mehrere Content-Repositories](content-repos.md).

---

## Buchempfehlungen

Pflegt der Katalog für eine Domäne empfohlene Bücher
(`books.yaml`), zeigt der Content Browser sie als **weiterführende
Literatur** zur jeweiligen Domäne. Das funktioniert in beiden
Speichermodi und braucht kein Backend. Format und Pflege:
[Buchempfehlungen](../content-creation/books.md).

---

## Subject-Filter

Hast du deinen Lernprojekten Subjects (Fachgebiete) zugeordnet,
zeigt das **Dashboard** einen Subject-Filter, der **nur deine
eigenen** Subjects auflistet (versteckt, wenn keine vorhanden),
nach **häufigster Nutzung** sortiert und ab mehr als fünf
Einträgen nach Kategorie gruppiert.

---

## Meine Lektionen

Selbst erstellte oder importierte Lektionen erscheinen im Abschnitt
**Meine Lektionen** mit Aktionen zum Abspielen, Bearbeiten,
Löschen, Exportieren und Teilen. Wie du eigene Lektionen baust,
steht unter [Lektionen erstellen](../content-creation/overview.md).

---

## Verwandte Seiten

- [Lektionen und Wiederholungen](../user-guide/lessons.md) — der Lektionsablauf
- [Mehrere Content-Repositories](content-repos.md) — Quellen verbinden und verwalten
- [Meine Lektionen](../user-guide/my-lessons.md)
