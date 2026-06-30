# Content-Repos — eigenes Repository veroeffentlichen

Adaptive Learner liefert eine offizielle Inhaltsbibliothek mit, aber das
Content-System ist offen: Du kannst dein **eigenes Content-Repository**
auf GitHub betreiben, es in der App verbinden und es anderen Lernenden
zur Verfuegung stellen. Diese Seite gibt den Ueberblick; die
ausfuehrliche Schritt-fuer-Schritt-Anleitung steht im
**[Content-Repo-Guide](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**.

---

## Was ist ein Content-Repo?

Ein Content-Repo ist ein GitHub-Repository, das **Content-Sets** im
Adaptive-Learner-Format enthaelt. Ein Set ist eine Sammlung von
Lektionen fuer ein Sprachpaar und Niveau (z. B. "Spanisch A1 fuer
Deutschsprachige") oder fuer ein Sachgebiet (z. B. "Python-Grundlagen").

Die offizielle Bibliothek und alle Nutzer-Repos verwenden **dasselbe
Format** — es gibt kein separates "offizielles" Schema. Sobald dein Repo
die Validierung besteht, ist es eine vollwertige Inhaltsquelle. Du
brauchst keinen eigenen Server: ein Content-Repo besteht nur aus Dateien
in einem Git-Repository.

---

## Voraussetzungen

- Ein **GitHub-Repository** (oeffentlich; privat ist per Repo-Token
  ebenfalls moeglich).
- Eine Wurzel-**`manifest.yaml`**, die deine Sets auflistet.
- Lektionen im **Lektionsformat** (Schema v1.3+; aktuell v1.4).
- Python 3 mit PyYAML, um vor dem Veroeffentlichen lokal zu validieren.

Die massgeblichen Format-Referenzen liegen im offiziellen Inhalts-Repo:

- [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

---

## Verzeichnisbaum

Ein Content-Repo folgt einem festen Aufbau. Die Quellsprache (in der die
Erklaerungen geschrieben sind) ist der oberste Ordner, Zielsprache und
Niveau bilden den naechsten:

```
mein-content-repo/
  manifest.yaml                  # Wurzel-Manifest: listet alle Sets
  sets/
    de/                          # Quellsprache (Deutschsprachige)
      es-a1/                     # Zielsprache + Niveau (Spanisch A1)
        manifest.yaml            # Set-Manifest: listet die Lektionen
        lessons/
          01-begruessung.json    # eine JSON-Datei je Lektion (NN-slug.json)
        assets/                  # optional: Bilder / Audio
  scripts/validate_content.py    # der Validator (aus dem Starter-Kit)
```

---

## Lokal pruefen

```bash
pip install pyyaml
python3 scripts/validate_content.py
```

Exit-Code 0, wenn alle Sets bestehen, sonst 1 mit einem Bericht je
Datei. Geprueft werden Schema, Verzeichnisstruktur und die
Qualitaets-Mindestanforderungen (>= 5 Uebungen, >= 2 Uebungstypen, >= 1
Theorieschritt je Lektion, gefuellte Kartenfelder usw.).

---

## Wie wird es in der App gelistet?

Sobald dein Repo validiert, verbindet ein Lernender es unter
**Einstellungen > Daten > Content-Repositories**: URL einfuegen, die App
holt das Wurzel-Manifest, validiert technisch, synchronisiert und cacht
die Sets. Sie erscheinen dann im **Content Browser** mit einem
Quellen-Badge. Repos lassen sich auch per `/add-repo`-Link und
QR-Code teilen.

In die **Empfohlenen Repositories** in der App kommt ein Repo nur ueber
die kuratierte `recommended-repos.json` des Projektteams — das ist der
Kanal fuer die offizielle Empfehlung (Trust 3).

---

## Trust-Levels

Das Trust-Level sagt, wie stark der Inhalt geprueft wurde — es geht um
Herkunft und Pruefung, nicht um ein Qualitaetsurteil.

| Level | Name | Bedeutung |
|-------|------|-----------|
| **1** | Validiert | Schema korrekt, Qualitaets-Mindestanforderungen bestanden — automatisch beim Sync. Inhalt nicht einzeln geprueft. |
| **2** | Verifiziert | Von der Community beigetragen und von einem Maintainer inhaltlich geprueft. |
| **3** | Offiziell | Vom Projektteam kuratiert und qualitaetsgesichert. |

Fuer Trust 2+ gilt ein hoeherer Anspruch als die technischen Minima:
korrekte Uebersetzungen, Artikel/Genus, vollstaendige Akzente, sinnvolle
Progression, plausible Distraktoren und kulturelle Korrektheit. Eine
optionale **KI-Pruefung** in der App hilft Autoren, solche Probleme vor
dem Teilen zu finden (siehe EXP-033); sie ist beratend und blockiert das
Teilen nie.

---

## Gegenseitigkeit fuer Kurse und Webseiten (EXP-029)

Lektionen und Sachgebiete koennen **Begleitmedien** tragen (Videos,
Podcasts, Artikel, Buecher, Kurse, Webseiten). Der Filter fuer
kommerzielle Medien ist **Gegenseitigkeit, nicht der Preis**: freie
Medien sind immer erlaubt; kommerzielle Kurse/Webseiten nur, wenn der
Anbieter zurueckverlinkt, ein eigenes Content-Repo betreibt oder eine
dokumentierte Partnerschaft besteht. So werden Content-Autoren zu
Oekosystem-Partnern statt zu Werbetreibenden. Details in
`docs/explorations/EXP-029-media-reciprocity.md`.

---

## Starter-Kit als Vorlage

Der schnellste Einstieg ist das fertige Starter-Repo
**[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test)**:
Es enthaelt `docs/`, Vorlagen je Domaene, eine vollstaendige
Beispiel-Lektion (Inception-Effekt), ein lauffaehiges Beispiel-Set,
`books.yaml` und den Validator. Forke es, ersetze die Beispiel-Lektion
durch deine eigene, registriere sie im Wurzel-`manifest.yaml`,
validiere und verbinde das Repo in der App.

---

## Weiterfuehrend

- **[Vollstaendiger Content-Repo-Guide](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**
- [Lektionen erstellen — Ueberblick](overview.md)
- [Buchempfehlungen](books.md)
