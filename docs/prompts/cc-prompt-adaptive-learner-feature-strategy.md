# CC-Prompt: @astrapi69/feature-strategy Integration in Adaptive Learner

GitHub Issue ZUERST: "Integrate @astrapi69/feature-strategy to replace
ad-hoc feature gating"
Closes #XX im Commit.

---

## ZUSTANDS-POLICY (Projektregel, vom Maintainer entschieden)

| Zustand | Wann | Tooltip/Reason |
|---------|------|----------------|
| active | Feature funktioniert | Keiner |
| disabled | User kann handeln | "API-Schlüssel konfigurieren" |
| disabled | Genuinely unmöglich in diesem Deployment | "Nur mit der Desktop-App verfügbar" |
| hidden | NUR Dev-Feature-Flags während Entwicklung | Keiner |

Hidden wird in der Produkt-UI NICHT verwendet. Alles was dem User
gehört ist sichtbar, entweder active oder disabled mit Erklärung.
Begruendung: beim Testen ist sofort sichtbar was fehlt, und disabled
Desktop-Features kommunizieren dass die Desktop-App existiert.

Das Fail-Closed-Verhalten der Library (unbekannte Feature-IDs ->
hidden) bleibt davon unberührt: das ist ein Sicherheitsnetz für
Tippfehler, keine UI-Policy.

---

## KRITISCHE VORAB-ANFORDERUNGEN

Lies diese vier Punkte BEVOR du eine einzige Zeile Code schreibst.
Vom Library-Autor verifiziert. Nicht optional.

### A. Echte API lesen, nicht diesen Prompt kopieren

Dieser Prompt beschreibt die Architektur und das Ziel. Die EXAKTEN
API-Aufrufe, Props, Typen und Konstruktoren MUSST du aus den
tatsächlichen .d.ts Dateien lesen:

```bash
cat node_modules/@astrapi69/feature-strategy/dist/index.d.ts
cat node_modules/@astrapi69/feature-strategy-react/dist/index.d.ts
```

Die Code-Beispiele in diesem Prompt sind ILLUSTRATIV, nicht copy-paste.
Wenn der Prompt etwas anderes schreibt als die .d.ts: die .d.ts gewinnt.

Bekannte Eckpunkte der echten API:
- FeatureProvider nimmt `registry` + `context`
  (Strategy wird auf der Registry gesetzt, nicht als separater Prop)
- `<Feature>` verwendet `whenDisabled` / `whenHidden` Props
- ConditionalFeatureStrategy nimmt ein `Record<featureId, FeatureCondition>`,
  KEINE einzelne Evaluationsfunktion über alle Features
- Strategien können sich enthalten: `evaluate()` darf `undefined`
  zurueckgeben, dann greift der `defaultState` des Descriptors
- Unbekannte Feature-IDs löst die Registry zu `hidden` auf (fail closed)

### B. defaultState + Abstention ist das Kernprinzip — keine Totalfunktion

Die Library ist so gedacht: Descriptors tragen den Normalzustand,
die Strategy enthält NUR Abweichungsregeln und enthält sich bei
allem anderen.

FALSCH (Strategy als Totalfunktion, dupliziert die Feature-Listen):

```
// NIEMALS SO: ALWAYS_ACTIVE_SET in der Strategy pflegen
if (featureId in ALWAYS_ACTIVE_SET) return 'active';
...
return 'active'; // Fallback fuer Unbekanntes
```

Probleme: der defaultState der Descriptors wird toter Code, jedes
Feature steht in zwei Quellen (Descriptor + Set) die synchron gehalten
werden müssen, und der active-Fallback für unbekannte IDs hebelt
das Fail-Closed-Verhalten der Registry aus.

RICHTIG:
- Gruppe 1 (immer active): NUR Descriptor mit `defaultState: 'active'`.
  Taucht in der Strategy NICHT auf.
- Gruppe 2 (key-abhängig): Descriptor `defaultState: 'active'` PLUS
  Regel in der Strategy.
- Gruppe 3 (desktop-only): Descriptor `defaultState: 'active'` PLUS
  Regel in der Strategy.
- Kein Fallback-Zweig. Features ohne Regel: Strategy enthält sich.

Ergebnis: rund 10 Regeln statt 30, genau eine Quelle der Wahrheit
pro Feature.

### C. Context-Objekt MUSS memoized sein UND reaktiv

FALSCH (Performance-Bug, alle Consumer re-rendern bei jedem Parent-Render):

```typescript
// NIEMALS SO:
<FeatureProvider registry={registry} context={{ mode, hasAiKey }}>
```

RICHTIG:

```typescript
const featureContext = useMemo(
  () => ({ mode, hasAiKey }),
  [mode, hasAiKey]
);

<FeatureProvider registry={registry} context={featureContext}>
```

ZUSAETZLICH PFLICHT: `hasAiKey` muss REAKTIV sein (React-State oder
Store-Subscription). Ein einmaliger localStorage-Read beim Mount
bedeutet: User trägt Key in den Settings ein, alle KI-Buttons
bleiben disabled bis zum Reload. Prüfe wie der Key-Status aktuell
ermittelt wird. Wenn die Quelle nicht reaktiv ist, baue zuerst einen
reaktiven Hook (z.B. Store-basiert oder Event-basiert) und verifiziere:
Key in Settings eintragen -> KI-Buttons werden OHNE Reload active.

### D. Condition-Funktionen müssen billig und pur sein

Die Evaluation ist NICHT eager-im-Provider. Sie ist lazy-per-consumer:
`useFeature()` ruft `getState()` + `getReason()` bei jedem Render
des konsumierenden Components auf.

REGEL: Conditions dürfen NUR synchrone, pure Lookups auf dem
Context-Objekt sein. Kein Async, kein DOM-Zugriff, keine Berechnung,
kein localStorage-Read, kein API-Call. Der Key-Status wird im
Provider-Context bereitgestellt (siehe C), NICHT in der Condition
ermittelt.

---

## Kontext

Aktuell hat Adaptive Learner ad-hoc Feature-Gating:
- `disabled` + `title="API-Schlüssel erforderlich."` auf einzelnen Buttons
- FUNKTION-NICHT-VERFUEGBAR Regel in `.claude/rules/` (manuell, nicht enforced)
- Inkonsistente Entscheidung: manche Features disabled, manche hidden,
  manche vergessen (Anki-Seite war leer ohne Erklärung bis #276)
- API-Key-Checks verstreut in verschiedenen Komponenten
- NotebookLM AI-Buttons waren nicht key-gated (#281)

Ziel: zentrales Feature-Registry + Strategy-Pattern statt verteilte
if-checks. Zustaende gemaess Zustands-Policy oben.

---

## Gate vs Branch vs Infra — die drei Kategorien

NICHT alles gehört in die Feature-Registry. Saubere Trennung:

### True Gate (-> useFeature / <Feature>)

Feature das disabled wird basierend auf Mode/Key. Der User sieht
einen erklärenden Hinweis. Beispiele: Sync-Panel, Anki-Extraktion,
Session-Start.

### Logic Branch (-> useStorageMode() direkt)

Code der zwischen zwei Implementierungen ROUTET, nicht gated.
Beide Pfade sind aktiv, nur die Implementierung unterscheidet sich.
Beispiele: Export (Client-Engine vs Backend-Engine), Danger Zone
(Dexie-Reset vs API-Reset).

Diese bleiben auf `useStorageMode()` als roher Boolean.
NICHT in die Feature-Registry pressen.

### Infra (-> nicht anfassen)

`client.ts` guardedFetch, `api-storage.ts` Seam, Dexie-Mode-Regel.
Infrastruktur die den Storage-Contract durchsetzt. Kein Feature-Gating.

---

## Step 1 — Install

```bash
cd frontend && npm install @astrapi69/feature-strategy @astrapi69/feature-strategy-react
```

Verify: `npm ls @astrapi69/feature-strategy` zeigt die Version.

---

## Step 2 — .d.ts lesen und API verstehen

```bash
cat node_modules/@astrapi69/feature-strategy/dist/index.d.ts
cat node_modules/@astrapi69/feature-strategy-react/dist/index.d.ts
```

Notiere:
- Welche Klassen/Interfaces exportiert werden
- Welche Props FeatureProvider akzeptiert
- Welche Props das Feature Component akzeptiert
- Wie ConditionalFeatureStrategy konstruiert wird (Record-Shape!)
- Wie FeatureCondition aussieht (evaluate + optionales reason)
- Wie der Context an die Strategy weitergegeben wird

Erst wenn du die echte API verstanden hast: weiter.

---

## Step 3 — Feature-Konfiguration definieren

Erstelle `frontend/src/features/featureConfig.ts` mit DREI Deliverables:

### 3a. FEATURES-Konstante

Ein `as const` Objekt das CONSTANT_CASE-Namen auf kebab-case-IDs
mappt. Alle Verwendungen im Code laufen über diese Konstante,
niemals über String-Literale:

```typescript
export const FEATURES = {
  LESSON_PLAY: 'lesson-play',
  ANKI_EXTRACT: 'anki-extract',
  SYNC: 'sync'
  // ... alle 29 Features
} as const;
```

### 3b. Descriptors

ALLE 29 Features als FeatureDescriptor mit `defaultState: 'active'`.
Die Gruppenzugehoerigkeit steht NICHT im Descriptor, sie ergibt sich
aus den Strategy-Regeln (Gruppe 2 und 3) bzw. deren Abwesenheit
(Gruppe 1).

Gruppe 1 — immer active, KEINE Strategy-Regel:

```
LESSON_PLAY           Lektion spielen
LESSON_EXPORT_MD      Ergebnis als Markdown exportieren
LESSON_EXPORT_JSON    Ergebnis als JSON exportieren
CONTENT_BROWSER       Content Browser
CONTENT_REPO_ADD      Eigenes Repo hinzufuegen
CONTENT_REPO_SHARE    Repo teilen (Link/QR)
BACKUP_EXPORT         Backup erstellen
BACKUP_IMPORT         Backup importieren
FIRST_RUN_RESTORE     First-Run Backup Restore
REVIEW_SESSION        Wiederholungssitzung
ASSESSMENT            Lerntyp-Assessment
DASHBOARD             Dashboard
LEARNING_PATH         Lernpfad
PROGRESS              Fortschritt
ONBOARDING            Onboarding
THEMES                Theme-Wechsel
BOOK_RECOMMENDATIONS  Buchempfehlungen
LESSON_CREATE_MANUAL  Manuelle Lektion erstellen
NOTEBOOKLM_DOWNLOAD   NotebookLM-Paket herunterladen (kein KI)
```

Gruppe 2 — Strategy-Regel: disabled ohne Key (im Dexie-Mode),
reason `api-key-required`:

```
CONVERSATION_ANALYZE  Konversation analysieren
ANKI_EXTRACT          Anki-Karten extrahieren
SESSION_START         KI-Session starten
SESSION_RESUME        KI-Session fortsetzen
LEARNING_QUESTIONS    Lernfragen generieren (KI)
LEARNING_GUIDE        Lernleitfaden generieren (KI)
AI_LESSON_GENERATE    KI-Lektion generieren
```

Gruppe 3 — Strategy-Regel: disabled im Dexie-Mode (Policy: NICHT
hidden), reason `desktop-only`:

```
SYNC                  Sync mit Desktop
GIT_PERSIST           Git-Persistenz
LEARNING_REPO_GIT     Lern-Repository Git-Integration
```

### 3c. Registry als Modul-Konstante

Die Registry ist zustandslos konfiguriert, sie braucht KEIN useMemo
und gehört nicht in eine Komponente:

```typescript
export const featureRegistry = new FeatureRegistry<AppFeatureContext>();
featureRegistry.registerAll(descriptors);
featureRegistry.setStrategy(strategy);
```

(Exakte API gegen .d.ts prüfen.)

---

## Step 4 — Strategy erstellen

NUR Regeln für Gruppe 2 und 3. Kein Always-Active-Set, kein
Fallback-Zweig. Generiere das Rule-Record programmatisch aus zwei
kleinen Arrays, statt 10 Regeln von Hand zu schreiben.

Skizze (gegen echte API prüfen, Typen aus .d.ts):

```typescript
interface AppFeatureContext {
  mode: 'api' | 'dexie';
  hasAiKey: boolean;
}

const NEEDS_KEY = [
  FEATURES.CONVERSATION_ANALYZE, FEATURES.ANKI_EXTRACT,
  FEATURES.SESSION_START, FEATURES.SESSION_RESUME,
  FEATURES.LEARNING_QUESTIONS, FEATURES.LEARNING_GUIDE,
  FEATURES.AI_LESSON_GENERATE
];

const DESKTOP_ONLY = [
  FEATURES.SYNC, FEATURES.GIT_PERSIST, FEATURES.LEARNING_REPO_GIT
];

const rules = Object.fromEntries([
  ...NEEDS_KEY.map((id) => [id, {
    evaluate: (ctx?: AppFeatureContext) =>
      ctx === undefined ? undefined
        : ctx.mode === 'api' || ctx.hasAiKey ? 'active' : 'disabled',
    reason: 'api-key-required'
  }]),
  ...DESKTOP_ONLY.map((id) => [id, {
    evaluate: (ctx?: AppFeatureContext) =>
      ctx === undefined ? undefined
        : ctx.mode === 'dexie' ? 'disabled' : 'active',
    reason: 'desktop-only'
  }])
]);

const strategy = new ConditionalFeatureStrategy<AppFeatureContext>(rules);
```

Alternative falls die Record-Generierung sperrig wird: ein eigenes
Objekt das das FeatureStrategy-Interface implementiert (zwei Methoden:
getState, getReason). Auch dort gilt: enthält sich bei Features ohne
Regel (return undefined), kein active-Fallback, kein hidden.

---

## Step 5 — Provider einbauen

In `App.tsx` oder dem Root-Layout. MEMO PFLICHT, REAKTIVITAET PFLICHT
(siehe Anforderung C):

```typescript
const mode = useStorageMode();   // 'api' | 'dexie' — muss reaktiv sein
const hasAiKey = useHasAiKey();  // boolean — MUSS reaktiv sein, siehe C

const featureContext = useMemo<AppFeatureContext>(
  () => ({ mode, hasAiKey }),
  [mode, hasAiKey]
);

<FeatureProvider registry={featureRegistry} context={featureContext}>
  {children}
</FeatureProvider>
```

Die Registry kommt als Import aus featureConfig.ts (Step 3c),
NICHT als useMemo in der Komponente.

---

## Step 6 — Ad-hoc Gating durch useFeature / Feature ersetzen

### Audit: Finde alle Stellen

```bash
# API-Key disabled Buttons
grep -rn 'disabled.*API-Schlüssel\|api-key-required\|API.key.required' \
  frontend/src/ --include='*.tsx' --include='*.ts'

# title="API-Schlüssel" Tooltips
grep -rn 'title="API-Schlüssel' frontend/src/ --include='*.tsx'

# api-key-required-notice Komponente
grep -rn 'api-key-required-notice\|ApiKeyRequired' frontend/src/ --include='*.tsx'

# Sync/Git-Sektionen
grep -rn 'sync\|git-persist\|SYNC' frontend/src/ --include='*.tsx' \
  | grep -v node_modules | grep -v test
```

### Bekannte Umstellungsstellen

| # | Datei/View | Feature | Aktuell | Soll |
|---|-----------|---------|---------|------|
| 1 | Import-Detail: "Neu analysieren" | CONVERSATION_ANALYZE | disabled + title | useFeature disabled |
| 2 | Import-Detail: "Sitzung starten" | SESSION_START | disabled + title | useFeature disabled |
| 3 | Import-Detail: "Anki-Karten extrahieren" | ANKI_EXTRACT | disabled + title | useFeature disabled |
| 4 | Anki-Seite: Empty State Key-Hinweis | ANKI_EXTRACT | hardcoded Check | useFeature disabled |
| 5 | Fortschritt: "Lernfragen generieren" | LEARNING_QUESTIONS | NICHT gegated (#281) | useFeature disabled |
| 6 | Fortschritt: "NotebookLM-Paket" | NOTEBOOKLM_DOWNLOAD | kein Gate nötig | active (kein KI) |
| 7 | Fortschritt: "Lernleitfaden" | LEARNING_GUIDE | NICHT gegated (#281) | useFeature disabled |
| 8 | Dashboard: "Neue Session starten" | SESSION_START | prüfe aktuellen Zustand | useFeature disabled |
| 9 | Session-Seite: Resume/Start | SESSION_RESUME | prüfe aktuellen Zustand | useFeature disabled |
| 10 | S > Daten: Sync-Sektion | SYNC | prüfe aktuellen Zustand | disabled + Notice (NICHT hidden) |
| 11 | S > Lern-Repository: Git-Persistenz | GIT_PERSIST | prüfe aktuellen Zustand | disabled + Notice (NICHT hidden) |

### Umstellungs-Pattern

Für disabled BUTTONS (User soll verstehen warum):

```typescript
// Gegen echte API pruefen!
<Feature id={FEATURES.ANKI_EXTRACT}
  whenDisabled={
    <Button disabled title={t('feature.api_key_required')}>
      <Lock size={14} />
      Anki-Karten extrahieren
    </Button>
  }>
  <AnkiExtractButton />
</Feature>
```

Für disabled SEKTIONEN (Sync-Panel, Git-Persistenz): eine disabled
Sektion ist NICHT einfach ein ausgegrauter Block mit toten Controls.
Pattern: Sektions-Header bleibt sichtbar, die Controls werden durch
eine Notice-Card ersetzt die den Reason erklärt:

```typescript
<Feature id={FEATURES.SYNC}
  whenDisabled={(reason) => (
    <section>
      <h3>{t('settings.sync.title')}</h3>
      <NoticeCard icon={<Monitor size={16} />}>
        {t(`feature.${reason}`)}
      </NoticeCard>
    </section>
  )}>
  <SyncPanel />
</Feature>
```

Prüfe ob eine NoticeCard-ähnliche Komponente schon existiert
(api-key-required-notice). Wiederverwenden, nicht neu erfinden.

Für programmatischen Zugriff:

```typescript
const { state, reason } = useFeature(FEATURES.SESSION_START);

<Button
  disabled={state !== 'active'}
  onClick={state === 'active' ? startSession : undefined}
  title={state === 'disabled' ? t(`feature.${reason}`) : undefined}
>
  Session starten
</Button>
```

---

## Step 7 — i18n

Neue Keys in allen 8 Sprachen:

```yaml
feature:
  api_key_required: "API-Schlüssel erforderlich. Konfiguriere einen Provider in den Einstellungen."
  desktop_only: "Nur mit der Desktop-App verfügbar."
```

Die Reason-Strings der Strategy (`api-key-required`, `desktop-only`)
sind Maschinen-Keys, die UI übersetzt sie via i18n. Mappe konsistent:
reason `api-key-required` -> Key `feature.api_key_required`,
reason `desktop-only` -> Key `feature.desktop_only`.

Prüfe die bestehenden i18n Keys: gibt es schon ähnliche Texte
die wiederverwendet werden können? Nicht doppeln.

---

## Step 8 — ApiKeyRequiredNotice vereinheitlichen

Die gelbe `api-key-required-notice` Banner-Komponente (z.B. auf
Import-Detail) soll aus dem Feature-System gespeist werden:

- Wenn IRGENDEIN sichtbares Feature auf der aktuellen Seite
  `disabled` + `reason: api-key-required` ist → Banner zeigen
- ODER einfacher: die Notice bleibt als Komponente, wird aber
  nur gerendert wenn `useFeature(relevantesFeature).state === 'disabled'`

Nicht beide Systeme parallel laufen lassen. Entweder die Notice
liest aus dem Feature-System, oder sie wird durch Feature-Komponenten
ersetzt.

---

## Step 9 — Alte Gating-Artefakte löschen

Wenn ALLE Stellen umgestellt sind:

1. Prüfe ob `useOfflineFeatureGate` existiert. Wenn ja: löschen.
2. Prüfe ob `OfflineFeatureNotice` existiert. Wenn ja: löschen.
3. Prüfe ob ad-hoc `disabled + title="API-Schlüssel"` noch
   irgendwo steht. Wenn ja: umstellen oder löschen.
4. Grep-Verify:

```bash
grep -rn 'useOfflineFeatureGate\|OfflineFeatureNotice' \
  frontend/src/ --include='*.tsx' --include='*.ts'
# Muss 0 Treffer ergeben

grep -rn 'title="API-Schlüssel' frontend/src/ --include='*.tsx'
# Muss 0 Treffer ergeben (alle durch Feature-System ersetzt)
```

---

## Step 10 — Verify

### Feature-Tabelle (vom Maintainer bestätigt, Zustands-Policy beachtet)

| Feature | API-Mode | Dexie ohne Key | Dexie mit Key |
|---------|----------|----------------|---------------|
| lesson-play | active | active | active |
| lesson-export-md | active | active | active |
| lesson-export-json | active | active | active |
| content-browser | active | active | active |
| content-repo-add | active | active | active |
| content-repo-share | active | active | active |
| backup-export | active | active | active |
| backup-import | active | active | active |
| first-run-restore | active | active | active |
| review-session | active | active | active |
| assessment | active | active | active |
| dashboard | active | active | active |
| learning-path | active | active | active |
| progress | active | active | active |
| onboarding | active | active | active |
| themes | active | active | active |
| book-recommendations | active | active | active |
| lesson-create-manual | active | active | active |
| notebooklm-download | active | active | active |
| conversation-analyze | active | **disabled** (api-key-required) | active |
| anki-extract | active | **disabled** (api-key-required) | active |
| session-start | active | **disabled** (api-key-required) | active |
| session-resume | active | **disabled** (api-key-required) | active |
| learning-questions | active | **disabled** (api-key-required) | active |
| learning-guide | active | **disabled** (api-key-required) | active |
| ai-lesson-generate | active | **disabled** (api-key-required) | active |
| sync | active | **disabled** (desktop-only) | **disabled** (desktop-only) |
| git-persist | active | **disabled** (desktop-only) | **disabled** (desktop-only) |
| learning-repo-git | active | **disabled** (desktop-only) | **disabled** (desktop-only) |

### Verifikation

1. **GitHub Pages (Dexie, kein Key):** navigiere ALLE Views.
   - Active Features: funktionieren wie bisher.
   - Disabled Features: sichtbar mit Erklärung. Buttons disabled
     mit Tooltip, Sektionen mit Notice-Card. NICHTS ist hidden.
   - ZERO "tote Buttons" die nichts tun ohne Erklärung.
   - ZERO verschwundene Features: jedes Feature aus der Tabelle ist
     in der UI auffindbar, entweder active oder disabled+Reason.

2. **Key-Reaktivitaet (Anforderung C):** Key in S > Integrations
   eintragen. Alle api-key-required Features werden OHNE Reload
   active. Key wieder entfernen: Features werden OHNE Reload
   wieder disabled. Die desktop-only Features bleiben in beiden
   Faellen disabled. Eigener Verifikationspunkt, kein Nebeneffekt.

3. **API-Mode (wenn testbar):** alles active, nichts disabled.

4. **Fail-Closed-Stichprobe:** ein bewusst falsch getipptes
   `useFeature('does-not-exist')` in einer Test-Komponente muss
   `hidden` ergeben, nicht active. Danach wieder entfernen.
   (Das ist Library-Verhalten für Tippfehler, kein Widerspruch
   zur Zustands-Policy.)

5. **Grep-Verify:** 0 alte Gating-Artefakte (Step 9).

6. **Tests:** tsc clean, Vitest green, axe green, Visual Regression green.

---

## Commit-Strategie

Phasenweises Vorgehen (nicht ein Monolith-Commit):

1. `chore: install @astrapi69/feature-strategy + react adapter`
2. `feat: add feature registry and strategy configuration`
3. `refactor: wire FeatureProvider into App root`
4. `refactor: migrate desktop-only gates (sync, git-persist) to Feature`
5. `refactor: migrate api-key gates (AI, Anki, Session) to Feature`
6. `fix: key-gate NotebookLM AI buttons (#281)`
7. `refactor: remove legacy gating artifacts`
8. `test: verify feature-strategy integration`

Ein PR mit diesen Commits. Squash-Merge zu main.

---

## Do NOT

- Do NOT die feature-strategy Library ändern. Nur integrieren.
- Do NOT ein ALWAYS_ACTIVE_SET oder einen active-Fallback in die
  Strategy bauen. Gruppe 1 lebt ausschliesslich im defaultState
  der Descriptors. Die Strategy enthält sich bei allem ohne Regel.
- Do NOT irgendein Produkt-Feature hidden machen. Zustands-Policy:
  hidden ist NUR für Dev-Feature-Flags reserviert. Desktop-only
  Features sind disabled mit reason `desktop-only`.
- Do NOT disabled Sektionen als tote ausgegraute Controls rendern.
  Pattern: Header + Notice-Card (Step 6).
- Do NOT ad-hoc disabled Checks behalten "als Fallback". Sauber
  entfernen wenn die Feature-Komponente umgestellt ist.
- Do NOT Logic-Branches (Export-Engine, Reset-Pfad) in die
  Feature-Registry pressen. Die routen, die gaten nicht.
- Do NOT den Context OHNE useMemo uebergeben (Performance-Bug).
- Do NOT einen nicht-reaktiven Key-Status verwenden (Reload-Bug).
- Do NOT teure/impure Conditions in der Strategy verwenden.
- Do NOT Feature-IDs als String-Literale verstreuen. Immer über
  die FEATURES-Konstante.
- Do NOT Prompt-Code copy-pasten. .d.ts lesen.
- Kein mass-git add, explicit paths.
- Kein Version-Bump.
- TSDoc, keine Inline-Kommentare.
- i18n 8 Sprachen.
- Tailwind für UI.
