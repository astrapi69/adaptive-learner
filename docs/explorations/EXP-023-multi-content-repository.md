# EXP-023: Multi-Content-Repository Architektur

## Vision

Bildung und Lernen frei zugänglich für alle. Adaptive Learner wird zur offenen
Lernplattform, auf der jeder Inhalte konsumieren, erstellen und teilen kann.
Gleichzeitig können Coaches, Lehrer und Institutionen private Repositories
mit spezialisierten Lektionen betreiben, für Kurse, Nachhilfe oder
professionelle Weiterbildung.

Das Content-Ökosystem besteht aus drei Säulen:

1. **Offenes Wissen:** Das offizielle Repository liefert kostenlose,
   qualitätsgesicherte Inhalte für alle.
2. **Eigene Inhalte:** Jeder User kann eigene Lektionen erstellen,
   strukturieren und versionieren.
3. **Community und Coaches:** Verifizierte Repositories von Dritten,
   öffentlich oder privat, erweiterbar und bewertbar.

---

## Konzept

### Repository-Typen

| Typ | Sichtbarkeit | Quelle | Beispiel |
|-----|-------------|--------|----------|
| Offiziell | öffentlich, read-only | astrapi69/adaptive-learner-content | 330+ Lektionen, 16 Sets, 5 Domänen |
| Eigenes | privat, read-write | User's GitHub Repo | Eigene Lektionen, eigene Kurse |
| Community | öffentlich, read-only für Konsumenten | Andere User/Organisationen | "Spanisch für Mediziner", "React Advanced" |
| Coach/Privat | privat, read-only für eingeladene User | Coach/Lehrer GitHub Repo | Nachhilfe-Material, Kursunterlagen |

### Trust Levels

| Level | Name | Bedeutung | Wie erreicht |
|-------|------|-----------|-------------|
| 0 | Unbekannt | Nicht geprüft, User trägt volles Risiko | Default beim Hinzufügen |
| 1 | Technisch validiert | Schema korrekt, validate_content.py bestanden, kein Schadcode | Automatisch bei Verbindung |
| 2 | Community-geprüft | Mindest-Rating, mehrere User nutzen es aktiv | Community-Voting + Nutzungsdaten |
| 3 | Offiziell empfohlen | Inhaltlich geprüft, pädagogisch sinnvoll | Manuelles Review durch Maintainer |

### User Experience

**Konsument (Lerner):**
- Öffnet S > Inhalte
- Sieht offizielles Repo (immer aktiv, nicht entfernbar)
- Kann Community-Repos hinzufügen (URL eingeben oder aus kuratierter Liste)
- Content Browser zeigt alle Quellen mit Quell-Badge
- Filter nach Quelle möglich

**Ersteller (Content Creator):**
- Verbindet eigenes GitHub Repo in S > Inhalte
- Erstellt Lektionen im Lesson Creator
- Lektionen werden in eigenes Repo gepusht (Share Wizard)
- Kann Repo öffentlich machen und zur Verifizierung einreichen

**Coach / Lehrer:**
- Eigenes privates Repo mit spezialisierten Inhalten
- Teilt Zugangs-Link/Token mit Schülern
- Schüler fügen das Repo in ihrer App hinzu
- Coach sieht (später) aggregierte Fortschritte der Schüler

---

## Architektur-Optionen

### Option A: GitHub-only (empfohlen für Phase A)

Alle Repos sind GitHub Repositories. Content wird per GitHub API
(raw fetch) oder git clone gezogen. Vorteile:

- Versionierung eingebaut (git)
- Branching für Draft-Lektionen
- PRs für Community-Beiträge zum offiziellen Repo
- GitHub Token Management existiert bereits im Projekt
- Private Repos über GitHub Token zugangsgesteuert

Nachteile:
- GitHub-Account nötig für Ersteller
- API Rate Limits (60/h unauthentifiziert, 5000/h mit Token)
- Kein eigener Discovery-Mechanismus

### Option B: Eigener Content-Server (später, Phase C)

Ein zentraler Index-Server der Repos registriert, validiert und durchsuchbar macht.
Vorteile: Discovery, Bewertungen, Trust-Verwaltung zentral.
Nachteile: Infrastruktur, Kosten, Moderation, Single Point of Failure.

### Empfehlung

Phase A-B: Option A (GitHub-only). Kein eigener Server.
Phase C: Option B evaluieren wenn Community-Features gebraucht werden.

---

## Technische Knackpunkte

### 1. Content-Ladereihenfolge und Namenskollision

Repositories werden in definierter Reihenfolge geladen:
1. Offizielles Repo (Basis)
2. Eigenes Repo (überschreibt bei gleicher Set-ID)
3. Community/Coach Repos (additiv)

Bei Kollision (gleiche Set-ID aus zwei Quellen):
- User-eigenes Repo hat Vorrang vor offiziellem
- Community-Repos kollidieren nicht untereinander (verschiedene Namespaces)
- Namespace-Konvention: `{github-username}/{set-name}` verhindert Kollisionen

### 2. Offline-Verhalten

Nach erstem Sync wird Content lokal gecacht:
- Dexie: contentSets + contentSetFiles Tabellen (existieren bereits)
- Jeder Cache-Eintrag trägt die Repo-Quelle als Metadatum
- Offline: gecachter Content verfügbar, kein Netzwerk nötig
- Online: Sync prüft Version/Hash, lädt nur Änderungen

### 3. Validierung

`validate_content.py` läuft gegen jedes Repo:
- Schema v1.3 Konformität (alle Pflichtfelder)
- exercise_type muss aus bekannter Liste stammen
- Keine leeren Lektionen
- Kein executable Code in Content-Dateien (Security)
- Ergebnis bestimmt Trust Level 0 -> 1

### 4. Share Wizard Integration

Der Share Wizard braucht ein Ziel-Repo:
- Default: offizielles Repo (PR erstellen)
- Wenn eigenes Repo verbunden: Option "In mein Repository speichern"
- Kein PR nötig für eigenes Repo (direct push)

### 5. GitHub Token Management

Existiert bereits für Lern-Repository:
- S > Daten > GitHub Token
- Derselbe Token kann für Content-Repos wiederverwendet werden
- Scope beachten: Token braucht `repo` Scope für private Repos

### 6. Coach-Szenario (Privates Repo teilen)

- Coach erstellt privates GitHub Repo
- Coach generiert einen Fine-Grained Token (read-only, nur dieses Repo)
- Coach teilt Token + Repo-URL mit Schülern (oder generiert einen
  Einladungs-Link in der App)
- Schüler fügt Repo + Token in S > Inhalte hinzu
- Später: QR-Code oder Deep-Link für einfaches Onboarding

---

## Phasen-Schnitt

### Phase A — MVP (v1.64-65)

> **Status: implemented (#118, merged).**

Scope:
- Offizielles Repo bleibt Default, immer geladen, nicht entfernbar
- User kann EIN eigenes Repo setzen in S > Inhalte (GitHub URL + Branch + Token)
- Technische Validierung beim Verbinden (Schema-Check)
- Content wird nach Verbindung lokal gecacht (Dexie)
- Content Browser zeigt Quelle als Badge ("Offiziell" / "Eigenes Repo")
- Sync-Button in S > Inhalte ("Jetzt synchronisieren")

Nicht in Phase A:
- Mehrere Repos
- Community-Repos von Dritten
- Verifizierung / Trust Levels
- Coach-Features
- Discovery / kuratierte Liste

Definition of Done:
- User kann eigenes Repo verbinden und Lektionen daraus lernen
- Offline funktionsfähig nach erstem Sync
- validate_content.py läuft gegen User-Repo
- Content Browser unterscheidet Quellen visuell
- Dexie-Mode und API-Mode
- Tests: Verbindung, Sync, Cache, Offline, Badge-Anzeige

### Phase B — Multi-Repo + Teilen (später)

> **Status: implemented (#122, on branch — pending release).** Trust
> Level 0→1 (technical validation), per-repo source filter, deep-link +
> QR sharing, and private/coach repos via a per-repo token are done.
> Deferred to Phase C: Trust Level 2/3 (community-verified / officially
> recommended), one-time invite tokens.

- User kann MEHRERE Repos setzen
- Repos teilen (URL kopieren, QR-Code)
- Automatische technische Validierung (Trust Level 0 -> 1)
- Coach kann privates Repo mit Token teilen
- Content Browser: Filter nach Quelle

### Phase C — Community-Ökosystem (viel später)

- Verifizierungs-Workflow in der App
- Community-Rating / Sterne-Bewertung pro Repo
- "Verifiziert" und "Offiziell empfohlen" Badges
- Kuratierte Liste empfohlener Repos (in-app oder separater Index)
- Optional: zentraler Index-Server für Discovery
- Aggregierte Fortschrittsanzeige für Coaches
- Einladungs-Links / Deep-Links für einfaches Onboarding

---

## Offene Fragen

1. Soll das offizielle Repo per git clone gezogen werden (groß, aber vollständig)
   oder per GitHub API raw fetch (kleiner, aber einzelne Dateien)?
   Empfehlung: Raw fetch für Phase A, git clone optional für Power-User.

2. Wie oft wird automatisch synchronisiert? Bei App-Start? Täglich?
   Nur manuell? Empfehlung: manuell + bei App-Start wenn älter als 24h.

3. Braucht Phase A schon Namespace-Prefixe ({username}/{set})?
   Empfehlung: Ja, von Anfang an, sonst Migrationkosten später.

4. Soll validate_content.py client-seitig laufen (im Browser/Dexie)
   oder nur server-seitig? Empfehlung: Vereinfachte Variante client-seitig
   (Schema-Check), volle Validierung server-seitig.

5. Wie wird ein Coach-Token sicher übermittelt? QR-Code ist BF,
   aber der Token ist dann im QR sichtbar. Empfehlung: Einmal-Token
   der nach Aktivierung durch einen persistierten Zugang ersetzt wird.

---

## Bewertung

Die Vision ist stark und differenziert Adaptive Learner von reinen
Lern-Apps: nicht nur konsumieren, sondern erstellen und teilen.
Der Phasen-Schnitt ist entscheidend. Phase A ist realistisch mit
dem bestehenden Stack (GitHub API, Dexie Cache, Content Browser).
Phase B und C brauchen Community-Wachstum um sinnvoll zu sein.

Risiko: Scope Creep. Die Community-Features sind verlockend aber
gefährlich für den MVP. Phase A strikt einhalten, erst nach
stabilem Release Phase B evaluieren.

Größter technischer Hebel: Die Content-Lade-Infrastruktur in
Phase A so bauen, dass Phase B nur Konfiguration ist (Liste statt
einzelnes Repo), kein Architektur-Umbau.
