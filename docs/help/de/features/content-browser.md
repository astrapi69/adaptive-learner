# Content Browser

Der **Content Browser** („Meine Inhalte") ist der **Meine-Inhalte-
Tab des Content-Hubs** unter `/content`. Er zeigt nur die
Lektionssätze, die du bereits heruntergeladen hast, mit dem Suchfeld
oben und deinem lokalen Katalog darunter. Um *neue* Sätze zu finden
und herunterzuladen, nutze den **Entdecken**-Tab - siehe
[Inhalte entdecken](discover.md). Entdecken ist der **Standard-Tab**,
beim Öffnen von `/content` landest du also im Katalog; wechsle zu
*Meine Inhalte*, sobald du etwas heruntergeladen hast.

Die Seitenkopfzeile trägt den Titel **Meine Inhalte** und einen
kleinen **Info-Button** (das ⓘ-Symbol). Der Einleitungstext wird
nicht mehr dauerhaft angezeigt - klicke auf den Info-Button, um zu
lesen, wofür dieser Tab da ist (deine heruntergeladenen Inhalte,
samt ihrer Quellen), ohne dass er die übrige Zeit Platz wegnimmt.

<!-- TODO: Screenshot - Content Browser mit Titel, Info-Button, Ansicht-Umschalter und Set-Baum -->

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

## Listen- und Kachelansicht

Ein **Ansicht-Umschalter** ändert, wie deine heruntergeladenen
Sätze dargestellt werden:

- **Liste** - eine kompakte, flache Liste, die sich schnell
  scrollen lässt, besonders auf dem Handy. Das ist die
  **Voreinstellung**.
- **Kacheln (Grid)** - die reichere Baumansicht
  *Quellsprache → Zielsprache → Niveau*.

Deine Wahl ist eine **globale Ansicht-Einstellung**: Sie gilt für
*Meine Inhalte* und *Entdecken* gleichermaßen und wird über Besuche
hinweg gemerkt. Du kannst sie auch unter **Einstellungen → Lernen**
setzen. (Hattest du zuvor Kacheln gewählt, bleibt diese Wahl
erhalten; nur neue Nutzer starten in der Liste.)

Die heruntergeladenen Sätze sind nach **Download-Zeit** sortiert
(zuletzt heruntergeladen zuerst), nicht alphabetisch - so findest du
das gerade Geladene leicht wieder.

> **Weitermachen ist umgezogen.** Das „Weitermachen"-Panel
> (Continue Learning) ist nicht mehr in diesem Tab - es lebt jetzt
> im **Dashboard**, der einzigen Stelle, die es besitzt. Siehe
> [Dashboard](../user-guide/dashboard.md).

---

## Heruntergeladene Sätze auswählen und verwalten

In *Meine Inhalte* kannst du heruntergeladene Sätze **mehrfach
auswählen** und in einem Schritt **stapelweise löschen**. Du kannst
die Liste außerdem **filtern**, auch **nach Quelle**, um sie auf das
Gewünschte einzugrenzen.

---

## Sprachen und Wissen

Der Katalog teilt sich in zwei Bäume:

- **Sprachen** - als Baum *Quellsprache → Zielsprache → Niveau*,
  gefiltert auf deine App-Sprache (zusätzliche Quellsprachen
  kannst du in Einstellungen → Lernen aktivieren).
- **Wissen** - Nicht-Sprach-Domänen (z. B. Programmierung,
  Psychologie) mit eigenen Symbolen.

---

## Direktlink zu einem einzelnen Satz

Jeder Satz hat einen eigenen **Deep-Link** unter
`/content/set/:setId`, der diesen Satz direkt öffnet und den
Katalog-Baum überspringt. Öffnest du den Link, landest du direkt
beim Satz - in beiden Speichermodi. Genau das ermöglicht das
**Teilen einzelner Sätze**: ein QR-Code oder Teilen-Link auf
Satz-Ebene kann jetzt auf einen bestimmten Satz zeigen, nicht nur
auf die App-Startseite.

Verweist der Link auf einen Satz, der nicht existiert (oder den du
noch nicht heruntergeladen hast), zeigt die Seite einen
freundlichen **Nicht-gefunden-Zustand** mit einem Weg zurück zum
Katalog statt eines Fehlers.

---

## Quell-Badges und Quell-Filter

Jeder heruntergeladene Satz trägt ein **Quell-Badge**, das zeigt,
woher er stammt:

- **Offiziell** / **Bundled** - aus dem offiziellen Katalog bzw.
  in die App eingebaut.
- **Eigenes Repo** - aus einem von dir verbundenen Repository.
- **Offiziell empfohlen** - aus der kuratierten Empfehlungsliste.

Ein **Quell-Filter** blendet bei Bedarf nur Sätze einer
bestimmten Quelle ein. Mehr dazu unter
[Mehrere Content-Repositories](content-repos.md).

---

## Teilen per Einladungscode

Besitzt du ein **privates Content-Repository** und hast dafür ein
Repo-Token gesetzt, kannst du einen **Einladungscode** (mit QR-Code
und Link) erzeugen, der den Zugang zu diesem Repo teilt. Eine
lernende Person **löst einen Einladungscode ein**, um das Repository
zu ihren eigenen Quellen hinzuzufügen. Siehe
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

## Meine Lektionen (jetzt im Importieren-Tab)

Selbst erstellte oder importierte Lektionen - zusammen mit den
**Aktionsbuttons** zum Importieren/Erstellen - sind in den
**Importieren-Tab** des Content-Hubs umgezogen. Dort stehen sie
neben dem Chat-Import als eine gemeinsame Fläche „eigene Inhalte
mitbringen", mit denselben Aktionen zum Abspielen, Bearbeiten,
Löschen, Exportieren und Teilen. Der *Meine-Inhalte*-Tab behält den
Baum der heruntergeladenen Sätze (mit deinen eigenen Lektionen, in
den passenden veröffentlichten Knoten eingefaltet, samt „(+N
eigene)"-Zähler). Wie du eigene Lektionen baust, steht unter
[Lektionen erstellen](../content-creation/overview.md).

---

## Verwandte Seiten

- [Lektionen und Wiederholungen](../user-guide/lessons.md) - der Lektionsablauf
- [Mehrere Content-Repositories](content-repos.md) - Quellen verbinden und verwalten
- [Meine Lektionen](../user-guide/my-lessons.md)
