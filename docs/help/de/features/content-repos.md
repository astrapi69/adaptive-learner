# Mehrere Content-Repositories

Lektionen kommen aus **Content-Repositories** — öffentlichen
GitHub-Repos, die strukturierte Lektionssätze bündeln. Du bist
nicht auf den offiziellen Katalog beschränkt: Adaptive Learner
kann mehrere Repositories gleichzeitig laden, eigene verbinden
und kuratierte empfehlen (EXP-023).

<!-- TODO: Screenshot — Einstellungen → Daten → Abschnitt Content-Repositories mit offiziellem Repo + einem eigenen Repo -->

---

## Das offizielle Repository

Das offizielle Repo
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
ist immer geladen und lässt sich nicht entfernen. Es liefert den
gepflegten Standard-Katalog (Sprachkurse, Python-Grundlagen,
Psychologie und mehr). Jeder Satz daraus trägt im Content Browser
das Quell-Badge **Offiziell**.

Zusätzlich ist eine Auswahl an Lektionen direkt in die App
**eingebaut** (Bundled), damit die öffentliche GitHub-Pages-Seite
auch ohne Netzwerkverbindung sofort Inhalte zeigt. Existiert ein
Satz sowohl gebündelt als auch im offiziellen Repo, gewinnt die
höhere Version; bei Gleichstand wird die GitHub-Variante bevorzugt.

---

## Ein eigenes Repository verbinden

Unter **Einstellungen → Daten → Content-Repositories** fügst du
eine GitHub-Repo-URL hinzu. Die App prüft das Repo automatisch
(siehe *Trust-Stufen* unten), synchronisiert den Lektionskatalog
und legt ihn lokal im selben Cache ab wie offizielle Inhalte
(Dateisystem im Server-Modus, IndexedDB im reinen Browser-Modus).

- **Manuelle und automatische Synchronisierung.** Du kannst
  jederzeit „Jetzt synchronisieren" drücken; zusätzlich
  aktualisiert sich jedes Repo automatisch alle 24 Stunden.
- **Quell-Badge.** Sätze aus deinem Repo tragen im Content
  Browser ein eigenes Quell-Badge, sodass du jederzeit siehst,
  woher eine Lektion stammt.

---

## Mehrere Repositories verwalten

Du kannst beliebig viele Repos verbinden. In der Liste unter
**Einstellungen → Daten** kannst du sie:

- **Hinzufügen** über die Repo-URL,
- **Entfernen** (das offizielle Repo bleibt geschützt),
- **Neu anordnen** — die Reihenfolge bestimmt die **Priorität**.
  Tragen zwei Repos denselben Satz, gewinnt das weiter oben
  stehende.

Ältere Installationen mit nur einem verbundenen Repo werden
automatisch in die neue Listendarstellung übernommen.

---

## Repositories teilen

Du kannst ein Repo per **Deep-Link** und **QR-Code** weitergeben.
Ein Link der Form `/add-repo?...` öffnet bei der Empfängerin
direkt den „Repository hinzufügen"-Dialog mit vorausgefüllter URL;
der QR-Code macht dasselbe auf dem Smartphone. So teilst du einen
Kurs mit deiner Lerngruppe ohne manuelles Abtippen.

<!-- TODO: Screenshot — Teilen-Dialog mit QR-Code -->

---

## Trust-Stufen

Jedes verbundene Repo durchläuft eine **automatische technische
Validierung**, die bei jeder Synchronisierung erneut läuft. Daraus
ergibt sich eine Trust-Stufe:

| Stufe | Bedeutung |
|---|---|
| **0** | Noch nicht validiert oder Prüfung fehlgeschlagen. |
| **1** | Technisch gültig: mindestens eine Lektion, kein ausführbarer Inhalt. |
| **3** | **Offiziell empfohlen** — aus der kuratierten Empfehlungsliste. |

Die Validierung ist rein technisch (Struktur + Sicherheit). Eine
inhaltliche/community-basierte Bewertung (Trust 2) braucht einen
gemeinsamen Backend-Dienst und ist derzeit zurückgestellt.

---

## Empfohlene Repositories

Das offizielle Repo pflegt eine kuratierte Liste
(`recommended-repos.json`). Unter **Einstellungen → Daten** gibt
es daraus einen Entdecken-Bereich, in dem du empfohlene
Repositories mit **einem Klick** hinzufügst. Sie erscheinen mit
dem Badge **Offiziell empfohlen** (Trust 3).

---

## Lokale Bewertungen

Du kannst jedem Repo lokal **Sterne** geben. Diese Bewertung ist
rein privat und wird nur auf deinem Gerät gespeichert — sie hilft
dir, deine eigenen Quellen zu ordnen. Community-weite Bewertungen
brauchen ebenfalls einen gemeinsamen Backend-Dienst und sind
zurückgestellt.

---

## Private und Coach-Repositories

Ein Repo kann privat sein (etwa von einer Lehrkraft). Dafür
hinterlegst du pro Repo einen **persönlichen Zugriffstoken**. Der
Token wird lokal (localStorage) gehalten und ist bewusst **nicht**
Teil der exportierbaren Konfiguration, damit er beim Teilen der
Einstellungen nicht versehentlich mitgegeben wird.

---

## Verwandte Seiten

- [Content Browser](content-browser.md) — Sätze finden, filtern, herunterladen
- [Lektionen erstellen](../content-creation/overview.md) — eigene Inhalte beisteuern
- [Backup und Wiederherstellung](backup.md) — verbundene Repos sind Teil des Snapshots
