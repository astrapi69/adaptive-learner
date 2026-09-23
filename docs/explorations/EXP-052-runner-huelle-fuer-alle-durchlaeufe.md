# EXP-052: Eine Runner-Hülle für alle Durchläufe

**Kategorie:** Querschnitt · **Phase:** Analyse (kein Code in diesem
Dokument) · **Priorität:** P4 (Label des Issues: Refactor ohne eigenen
Nutzerwunsch, aber drei offene Vorgänge warten auf denselben Ort) ·
**Abhängig von:** #3169 (Anlass), #3173 (Kompaktkopf, dessen natürlicher Ort
diese Hülle ist), #3168 (doppelter Tipp, unabhängig, aber die
Hinweis-Buchführung darum ist eine Hüllenfrage), #1569/#3004 (Tap- und
Tastatur-Klasse), #3016/#2696 (Aufnahme-Klasse), EXP-020
(Flusssteuerung Prüfen/Weiter), EXP-044 (CSS-Vereinheitlichung) ·
**Issue:** #3169

> Explorationsdokument. Kein Code, keine Umbenennung, keine
> Testid-Änderung. Ist-Aufnahme aus den sechs Seiten (Pfade und
> Zeilenbereiche vom Stand `origin/develop` f46cda407, 2026-09-22), die
> Drift-Fälle mit Beleg, der Entwurf einer Hülle mit drei Einschüben, ein
> Migrationsplan in Scheiben mit den Folgen für Bildgrundlinien und
> FeatureShots je Scheibe, Risiken, offene Entscheidungen und
> Abnahmekriterien.

---

## Anlass

Frage des Owners am 2026-09-22 beim Vergleich Wiederholungssitzung gegen
normale Lektion: "Warum haben wir nicht eine View für alle
Aufgaben-Durchläufe und Lektionen?" (#3169)

Die Antwort aus dem Code: die Übungs-Renderer sind seit Phase 46D geteilt
(`ExerciseDispatcher` in
`frontend/src/components/exercises/shell/ExerciseDispatcher.tsx`), die
Seiten-Hülle darum herum nicht. Sechs Seiten unter
`frontend/src/pages/lesson/` bauen Kopf, Fortschritt, Fuß,
Zwei-Phasen-Knopf, Tastaturkürzel und Statusbildschirme je für sich, in
fünf Varianten mit teils identischem, teils abweichendem Verhalten. Jede
Änderung an der Hülle muss bis zu sechsmal gebaut, sechsmal geprüft und in
sechs Testflächen abgesichert werden.

Drei offene Vorgänge warten auf genau diesen Ort: der Kompaktkopf für das
iPhone (#3173 nennt die Hülle als "natürlichen Ort, sonst muss es sechsmal
gebaut werden"), die Hinweis-Buchführung um #3168 herum, und jede weitere
Aufnahme- oder Tap-Korrektur der Klassen #3016 und #1569.

---

## Ist-Aufnahme: die sechs Seiten

Stand f46cda407; Zeilenzahlen per `wc -l`, Zeilenbereiche aus den Dateien.

| Seite | Route (`frontend/src/App.tsx` 257-264) | Zeilen | Quelle des Durchlaufs |
|---|---|---|---|
| `frontend/src/pages/lesson/Lesson.tsx` | `/lesson/:setSlug/:setId/:filename` | 617 | `useLesson` (gecachte Lektion, persistierter Fortschritt) |
| `frontend/src/pages/lesson/AdaptiveLesson.tsx` | `/adaptive-lesson/:setId` | 614 | `useAdaptiveLesson` (aus Fehlern generiert) |
| `frontend/src/pages/lesson/ErrorReplayLesson.tsx` | `/error-replay/:setSlug/:setId/:filename` | 563 | Router-State (`location.state`, Zeilen 142-158), kein Hook |
| `frontend/src/pages/lesson/Review.tsx` | `/review/:setId` | 549 | `useReviewLesson` (synthetisiert aus der SRS-Warteschlange) |
| `frontend/src/pages/lesson/EndlessLesson.tsx` | `/endless-lesson/:setId` | 492 | `useEndlessLesson` (Strom ohne Ende) |
| `frontend/src/pages/lesson/ShuffleLesson.tsx` | `/shuffle-lesson/:setId` | 429 | `useShuffleLesson` (Set-übergreifend gemischt) |

Zusammen 3264 Zeilen Seitencode für einen Ablauf, der in allen sechs
derselbe ist: Status prüfen, Kopf, Fortschritt, aktuelle Übung über
`ExerciseDispatcher` im `controlled`-Modus, Zwei-Phasen-Knopf
Prüfen/Weiter, Zusammenfassung.

### Kopf, Fortschritt, Fuß, Optionen, Hinweis, Tastatur je Seite

Zeilenangaben ohne Dateinamen meinen die Seite der Spalte.

| Baustein | Lesson | Review | Shuffle | Endless | Adaptive | ErrorReplay |
|---|---|---|---|---|---|---|
| Kopf | `LessonHeader` (350-357; Komponente `components/lesson/chrome/LessonHeader.tsx`, 138 Zeilen: Positionszeile "Lektion n von m", Set-Link, kleine `h1` nach #1633) | inline `<header class="lesson-header">` 190-229: Zurück-Knopf, volle `h1`, Untertitel "n von m fällig" | inline 156-176: Zurück-Knopf, `h1`, Untertitel | inline 145-157: Zurück-Knopf, `h1`, kein Untertitel | inline 184-203: Zurück-Knopf, `h1`, `AdaptiveTransparencyDisplay` (522-553) | inline 272-295: Zurück-Knopf, `ReplayTitle` (82-132) mit Countdown-Ring der Blitzrunde |
| Fortschritt | `LessonProgressBar` (433-439; `components/lesson/chrome/LessonProgressBar.tsx`, 102 Zeilen, mit Checkpoint-Punkten #2874) in einer klebrigen Zeile mit den Optionen (425-486) | `ProgressBar` aus `shared/data-display` 231-244, Prozent inline 166-169 | `ProgressBar` 178-191, Prozent inline 142-143 | `EndlessStatLine` 159-166 (234-293): Zeit, Karten, Trefferquote, Pause/Ende | `ProgressBar` 205-218, Prozent inline 175-176 | `ProgressBar` 297-310, Prozent inline 263-264 |
| Fuß | `LessonFooterNav` 579-603 (`components/lesson/chrome/LessonFooterNav.tsx`, 189 Zeilen: Zurück mit Chevron und am Telefon verstecktem Text, Pause-Knopf, Prüfen mit Haken, Prüfungs-Fluss ohne Zurück) | `LessonStepNav` 269-291 (`shared/layout/LessonStepNav.tsx`, 136 Zeilen: Textknöpfe mit 14-px-Pfeilen, kein Pause) | `LessonStepNav` 214-236 | eigene `<nav>` 197-219: nur Prüfen/Weiter, kein Zurück | eigene `AdaptiveLessonNav` 423-487 (Kopie von `LessonStepNav` mit anderen Testids) | eigene `ErrorReplayNav` 416-468 (kein Zurück, auf der Zusammenfassung `null`) |
| Optionen-Chip / Modus | `LessonOptionsBar` 465-485 (Favorit, Modus-Umschalter, Vorlesen; `LessonModeProvider` 499) | nein | nein | nein (Pause/Ende in der Statuszeile) | nein | nein |
| Theorie-Link / Schwierigkeit / TTS | `LessonStepView` 534-564 (Theorie-Rücksprung 244-249, TTS-Mini-Player 608-613, Mentor-Notiz 568-574) | nein (nur `ExerciseDispatcher`, 426-444) | nein | nein | nein | nein |
| Zwei-Phasen-Zustand | `useLessonStepState` 200-209 (Hook `hooks/lesson/session/useLessonStepState.ts`, 113 Zeilen, samt Sperre bereits beantworteter Schritte) | inline 112-134 | inline 98-114 | inline 92-112, `goNext` inline 99-105 | inline 125-132 | inline 152-169 |
| Enter-Kürzel | über `useLessonStepState` (96-101) | `useLessonEnterKey` 123-128 | 104-109 | 107-112 | **fehlt** (kein Import von `useLessonEnterKey`, Importe 28-65) | 190-195 |
| Hinweis-Buchführung (#594) | `clearHintUsage()` beim Lektionsstart 178-180; Stempel in `LessonStepView` 187 | Stempel im Hook (`useReviewLesson.ts` 279), **kein Löschen** | Stempel `useShuffleLesson.ts` 195, kein Löschen | Stempel `useEndlessLesson.ts` 240, kein Löschen | Stempel `useAdaptiveLesson.ts` 292, kein Löschen | Stempel inline 233-244, kein Löschen |
| Tap-/Viewport-Hooks | `useStepReanchor` 277 (#959/#3126), `useOrientationReanchor` 283 (#1422) | keine | keine | keine | keine | keine |
| Statusbildschirme | `LessonStatusView` 304-311 (`components/lesson/steps/LessonStatusView.tsx`) | `renderReviewStatus` 300-394 | `renderShuffleStatus` 243-316 | `renderEndlessStatus` 421-492 | `renderAdaptiveLessonStatus` 269-358 | Leerzustand inline 199-226 |
| Zusammenfassung | `LessonSummaryScreen` 502-522 | `ReviewSummary` 476-549 über `shared/gamification/ReviewSummary` | `ShuffleSummary` 374-429 (eigene Sektion) | `EndlessSummary` 348-417 (rendert ein zweites `<main>`, 380) | `AdaptiveSummary` 562-614 plus `SaveAdaptiveLessonButton` 229-234 | `ErrorReplaySummary` 478-563 mit Konfetti |
| "spielbarer Schritt" | `isPlayableExerciseStep` 328 | `isPlayableExerciseStep` 165 | inline `SUPPORTED_EXERCISE_TYPES.has` 137-141 | inline 128-132 | `isPlayableExerciseStep` 174 | `isPlayableExerciseStep` 175 |

Was daraus folgt, in Zahlen (alle per `grep` am Stand f46cda407):

- Die Fuß-Klassenkette `sticky bottom-0 z-10 mt-4 flex flex-row
  items-center gap-2 border-t border-border bg-bg-primary pt-3 pb-safe`
  steht sechsmal in fünf Dateien (`LessonFooterNav.tsx` 103 und 134,
  `LessonStepNav.tsx` 97, `EndlessLesson.tsx` 198, `AdaptiveLesson.tsx`
  439, `ErrorReplayLesson.tsx` 432). Fünf Fuß-Implementierungen für zwei
  Verhaltensweisen (mit und ohne Zurück).
- Vier `render*Status`-Funktionen von je rund 90 Zeilen (Review, Shuffle,
  Endless, Adaptive) mit derselben Kaskade fehlender Parameter / lädt /
  leer / nicht heruntergeladen, je mit eigenem Testid-Präfix und eigenem
  i18n-Namensraum (`review.*`, `shuffle.*`, `endless.*`, `adaptive.*`) für
  dieselben Sätze ("Zurück zum Dashboard", "nicht heruntergeladen",
  "konnte nicht geladen werden").
- Vier inline-Kopien der Prozentrechnung des Fortschritts (Review 169,
  Shuffle 143, Adaptive 176, ErrorReplay 264), die `LessonProgressBar`
  längst kapselt (41-42).
- Fünf inline-Kopien des Zwei-Phasen-Zustands, den `useLessonStepState`
  seit #1790 kapselt; nur `Lesson.tsx` nutzt den Hook.
- `LessonModeProvider` hat einen Konsumenten (`Lesson.tsx` 499). Die fünf
  anderen Läufer laufen laut Docstring von
  `hooks/lesson/modes/useLessonMode.tsx` (9-12) immer in der
  `practice`-Konfiguration: alle Hilfen an, sofortiges Feedback.
- `LESSON_ROUTE_PREFIXES` in `hooks/lesson/session/useIsLessonActive.ts`
  (18-23) kennt vier der sechs Routen. `/shuffle-lesson/` und
  `/endless-lesson/` fehlen; `components/nav/Navigation.tsx` (70) und
  `components/nav/BottomTabBar.tsx` (50) lesen diesen Hook, um die
  Navigation in einem Durchlauf einzuklappen. Ein Nebenfund dieser
  Aufnahme, noch ohne Issue (siehe Abnahmekriterien).

### Was bereits geteilt ist

Damit die Hülle nichts Vorhandenes neu erfindet:

- `ExerciseDispatcher` (Phase 46D): alle sechs Seiten rendern die Übung
  darüber, im `controlled`-Modus mit `ExerciseHandle.submit()`.
- `useLessonEnterKey` (#103/#154): fünf von sechs Seiten (Adaptive fehlt);
  zusätzlich der `CorrectionBlock`
  (`components/exercises/feedback/CorrectionBlock.tsx` 334).
- `useLessonStepState` (#1790): kapselt Zwei-Phasen-Zustand, Enter-Kürzel
  und die Sperre bereits beantworteter Schritte; nur Lesson.
- `LessonStepNav` (`shared/layout`): props-getrieben, zwei Konsumenten
  (Review, Shuffle); laut Docstring (8-11) für "every lesson / review /
  error-replay player" gebaut, von drei Läufern trotzdem kopiert statt
  genutzt.
- `ProgressBar` (`shared/data-display`): vier Konsumenten.
- Die vier Modus-Hooks in `frontend/src/hooks/lesson/modes/`: identische
  Status-Union `"loading" | "empty" | "not-cached" | "ready" | "error"`
  (`useReviewLesson.ts` 52-57, `useShuffleLesson.ts` 37-42,
  `useEndlessLesson.ts` 37-42, `useAdaptiveLesson.ts` 59-64), identische
  Signatur `recordStepAttempts(attempts)`, identische Tallies
  `sessionScoreCorrect` / `sessionScoreTotal` (Endless: `stats`). Das ist
  die halbe Quellen-Schnittstelle, sie existiert schon.

---

## Drift-Fälle mit Beleg

Vier Vorgänge zeigen, was die sechsfache Hülle kostet. Jeder ist eine
eigene Klasse; die Hülle ist der gemeinsame Nenner.

### #3016 / #2696: Aufnahme-Klasse

Ein Bildvergleich prüft nur, was die Referenz unterscheidbar macht. Die
Bildgrundlinien decken die Läufer so ab (`e2e/visual/helpers.ts`):
`e2e/visual/critical-surfaces.spec.ts` rendert 22 Flächen mal 3 Viewports,
davon fünf im Läufer (`lesson-theory`, `lesson-cloze`, `lesson-matching`,
`lesson-summary`, `review-session`; Einträge 1105-1109).
`e2e/visual/theme-regression.spec.ts` rendert 7 Ansichten mal 12 Themes,
davon vier im Läufer (`lesson-matching`, `lesson-result`,
`lesson-reading-comprehension-checked`, `lesson-graded-quiz-checked`;
Einträge 44-47). Für Shuffle, Endless, Adaptiv und Fehler-Replay existiert
**keine** Grundlinie (`e2e/visual/screenshots/` enthält nur `lesson-*` und
`review-session-*`). Von den 58 FeatureShots in
`e2e/scripts/capture-feature-screenshots.ts` (Liste ab 1061) laufen zehn
im Lektions-Läufer (`lesson-modes/*` 3, `lesson-navigation/position-zeile`,
`lesson-review/summary`, `matching-animation/*` 2, `answer-toggle/*` 2,
`exercise-explanation/falsche-antwort`); für die fünf anderen Läufer gibt
es keinen einzigen.

Die #3016-Reparatur der Aufnahmehöhe (`expandViewportToDocument`, ab 538)
musste je Fläche geprüft werden; die Wiederholungssitzung brauchte dazu
einen eigenen Anker (`assertSurfaceStillReady`, Fall `review-session`
1848-1854, aus #2703), weil ihre Hülle ein anderes Anker-Paar
(`review-page` plus `review-subtitle`) hat als die Lektion
(`lesson-page`). Mit einer Hülle ist ein Anker-Paar für alle sechs Läufer
derselbe Code, und eine Aufnahme-Korrektur wird einmal geprüft. Ohne Hülle
bleiben vier Läufer außerhalb jeder Aufnahme, weil jeder eine eigene
Seed-Routine bräuchte.

### #1569 / #3004 / #1834: Tap- und Tastatur-Klasse (iOS)

Die App-weiten Teile der Klasse liegen richtig: `useVisualViewportRealign`
(#1832) und `useKeyboardPreReveal` (#3004) hängen in `frontend/src/App.tsx`
(112, 116). Die Läufer-eigenen Teile nicht: `useStepReanchor` (#959/#3126,
ein Schrittwechsel scrollt die Aufgabe ins Bild) und
`useOrientationReanchor` (#1422, Neuausrichtung nach Drehung) sind nur in
`Lesson.tsx` (277, 283) eingehängt; die fünf anderen Läufer richten nach
einem Schrittwechsel und nach einer Drehung nichts neu aus. Ebenso die
#1834-Korrektur des Fuß-Überlaufs auf iOS WebKit (`shrink-0` plus
Auto-Margins, `LessonFooterNav.tsx` 73-78, 141, 158): nur dort, in den vier
anderen Füßen nicht. Der #3173-Befund (Tastatur verdeckt das Feld auf
kurzen Seiten) wurde auf der Fehler-Replay-Seite gemacht, also auf einem
Läufer ohne diese Hooks.

### #3168: doppelter Tipp und die Hinweis-Ökonomie

Der doppelte Tipp selbst sitzt in drei Renderern (`cloze-feedback.tsx` 53,
`FreeTextExercise.tsx` 229, `word-tiles-feedback.tsx` 46, jeweils neben
`ExerciseHint`) und ist von der Hülle unabhängig; #3168 bleibt ein eigener
Vorgang. Der Hüllen-Anteil ist die Buchführung darum:
`frontend/src/lib/hints/hint-usage.ts` ist ein modulweiter Satz von
Übungs-IDs, den laut seinem Docstring "the lesson viewer" beim Start
löscht. Das tut nur `Lesson.tsx` (179). Wiederholung, Shuffle, Endless,
Adaptiv und Fehler-Replay stempeln `hint_used` beim Aufzeichnen
(Fundstellen in der Tabelle), löschen aber nie: ein in einer vorherigen
Lektion aufgedeckter Tipp auf einer wiederverwendeten Übungs-ID wird in
der nächsten Wiederholungssitzung als "Tipp genutzt" in die SRS-Zeile
gestempelt. Dass die fünf Läufer außerdem ohne `LessonModeProvider`
laufen, heißt: eine Prüfungs-Konfiguration (Tipps aus) kann dort nie
greifen, auch wenn die Lernende sie in der Lektion gewählt hat.

### #3173: Kompaktkopf für das iPhone

Der Owner-Vorschlag (Navigation "Lektion 33 von 115", Lernset-Link und
Titel in das Optionen-Panel; Kopf bei offener Tastatur einklappen) trifft
fünf Kopf-Varianten: `LessonHeader` mit Positionszeile und Set-Link
(Lesson), drei inline-Köpfe mit voller `h1` plus Untertitel (Review,
Shuffle, Adaptiv), einer ohne Untertitel (Endless), einer mit
Countdown-Ring (ErrorReplay). Das Optionen-Panel, in das die Elemente
wandern sollen (`LessonOptionsPanel`, #1625), existiert nur in der
Lektion. Das Issue selbst zieht den Schluss: "Natürlicher Ort: die
Runner-Hülle aus #3169, sonst muss es sechsmal gebaut werden."

---

## Vorschlag: `LessonRunner` mit drei Einschüben

Eine Komponente `LessonRunner` in einem neuen Ordner
`components/lesson/runner/` (mit Barrel), die den kompletten Rahmen einmal
rendert und drei Dinge von außen nimmt.

### `source`: woher die Schritte kommen

Ein Adapter über die vorhandenen Modus-Hooks, keine neuen Datenhooks. Die
Seite ruft ihren Hook wie heute und reicht das Ergebnis in eine normierte
Form:

```ts
interface RunnerSource {
    status: "loading" | "empty" | "not-cached" | "ready" | "error";
    error: string | null;
    title: string;
    subtitle?: string;
    /** Der aktuelle Schritt, oder null auf der Zusammenfassung. */
    step: ContentLessonStep | null;
    cards: ContentLessonCard[];
    /** Für die Attempt-Ableitung im Dispatcher (Review: review_lesson_id). */
    lessonId: string;
    /** Indexierte Läufe; null für den Endlos-Strom. */
    position: {index: number; total: number} | null;
    isSummary: boolean;
    goNext: () => void;
    goPrev?: () => void;
    recordStepAttempts: (attempts: readonly ElementAttempt[]) => Promise<void>;
    /** Nur die persistierende Lektion: Fortschrittszeile für die Sperre. */
    progress?: LessonProgress | null;
}
```

Sechs Adapter: `useLessonSource` (um `useLesson`), `useReviewSource`,
`useShuffleSource`, `useEndlessSource` (mit `position: null`),
`useAdaptiveSource`, `useErrorReplaySource` (aus dem Router-State; die
Rundenlogik `retryStillWrong` aus `ErrorReplayLesson.tsx` 246-253 wandert
in den Adapter und ist damit erstmals ohne Seite testbar).

### `summary`: was am Ende steht

Ein Render-Einschub, der die Tallies bekommt und seine Zusammenfassung
rendert. Die sechs vorhandenen Komponenten bleiben (`LessonSummaryScreen`,
`ReviewSummary`, `ShuffleSummary`, `EndlessSummary`, `AdaptiveSummary`
plus `SaveAdaptiveLessonButton`, `ErrorReplaySummary` mit Konfetti); sie
ziehen nur aus den Seitendateien in eigene Dateien um und werden über den
Einschub eingehängt:

```ts
summary: (tallies: {
    correct: number;
    total: number;
    remaining?: number;
    masteredDelta?: number | null;
    stats?: EndlessStats;
}) => ReactNode;
```

Die Hülle rendert das Zusammenfassungs-Element an genau einer Stelle
(zwischen Fortschritt und Fuß) und entscheidet über die Policy, ob der Fuß
auf der Zusammenfassung erscheint; `EndlessSummary` rendert dann kein
zweites `<main>` mehr (heute Zeile 380).

### `policy`: was diese Art Durchlauf zeigt und darf

Reine Daten, kein JSX. Eine Konstante je Läufer, damit ein
Verhaltensunterschied zwischen zwei Läufern ein Diff in einer Tabelle ist,
nicht ein Diff in zwei Seiten:

```ts
interface RunnerPolicy {
    testIdPrefix:
        | "lesson"
        | "review"
        | "shuffle"
        | "endless"
        | "adaptive-lesson"
        | "error-replay";
    i18nNamespace: string;
    header: {
        kind: "lesson" | "session";
        backTo: string;
        showSubtitle: boolean;
        extra?: ReactNode;
    };
    progress: "bar" | "stats" | "none";
    footer: {prev: boolean; pause: boolean; icons: boolean; onSummary: boolean};
    options: {chip: boolean; modeToggle: boolean; favorite: boolean; readAloud: boolean};
    theoryLink: boolean;
    persistProgress: boolean;
    mode: LessonMode | "inherit";
    enterShortcut: true;
    reanchor: true;
    clearHintsOnStart: true;
}
```

Die drei `true`-Literale sind Absicht: Enter-Kürzel, Neuausrichtung und
Hinweis-Löschen sind keine Optionen, die ein Läufer abwählen kann. Genau
das ist heute der Drift (Adaptiv ohne Enter, fünf Läufer ohne
Neuausrichtung, fünf ohne Löschen).

### Was in der Hülle einmal lebt

- `<main id="main" class="lesson-page" data-testid="{prefix}-page">` mit
  dem Scroll-Anker (#959).
- Kopf: `LessonHeader` in zwei Ausprägungen (`lesson` mit Positionszeile
  und Set-Link, `session` mit Zurück-Knopf und Untertitel) plus `extra`
  (Transparenz-Block, Countdown-Ring). Der #3173-Kompaktkopf wird später an
  dieser einen Stelle gebaut.
- Fortschrittszeile: `LessonProgressBar` (mit Optionen-Chip, wenn die
  Policy ihn vorsieht), oder die Statuszeile (Endless), oder nichts.
- Zwei-Phasen-Zustand und Enter-Kürzel: `useLessonStepState`. Heute
  verlangt der Hook die Option `progress` (24-28); die fünf flüchtigen
  Läufer reichen `null`.
- `useStepReanchor` und `useOrientationReanchor`.
- `clearHintUsage()` beim Start jedes Durchlaufs.
- `LessonModeProvider` um den Inhalt, mit dem Modus aus der Policy (die
  fünf flüchtigen Läufer pinnen `practice`, damit sich nichts ändert; ob
  sie später den Lektionsmodus erben, ist eine offene Entscheidung).
- Statusbildschirme: ein `RunnerStatusView` (Verallgemeinerung von
  `LessonStatusView`) mit Testid-Präfix und i18n-Namensraum, ersetzt die
  vier `render*Status`-Kopien und den Leerzustand des Replays.
- Fuß: ein `RunnerFooter` (Verallgemeinerung von `LessonFooterNav`, weil
  dort die iOS-Korrekturen liegen), gesteuert über die Fuß-Policy.
  `LessonStepNav` in `shared/layout` bleibt als app-freies Primitiv oder
  wird nach der Migration entfernt (offene Entscheidung).
- Die Übung: `ExerciseDispatcher` im `controlled`-Modus; `onComplete`
  stempelt, zeichnet auf und schaltet auf Weiter.

### Was NICHT in die Hülle gehört

- Die Modus-Hooks selbst (`useReviewLesson` und Geschwister) bleiben, wo
  sie sind; die Hülle kennt nur `RunnerSource`.
- Die Lektions-eigene Chrome (Combo, Tension, Maskottchen,
  Zeitmodus-Status, Mentor-Notiz, TTS-Mini-Player, Resume-, Exit- und
  Herzen-Dialoge, `LessonStepView` mit Theorie-Rücksprung) bleibt
  Beiwerk der Lektion. Sie kommt über Kinder-Slots der Hülle herein
  (`aboveContent`, `belowContent`, `overlays`), nicht als
  Policy-Schalter; sonst trägt jede Wiederholungssitzung zwanzig tote
  Props.
- Die Zusammenfassungen bleiben je Läufer eigen (Einschub `summary`).

### Wie eine Seite danach aussieht

```tsx
export default function ReviewPage() {
    const {setId, quick} = useReviewParams();
    const source = useReviewSource({setId, limit: quick ? 5 : readReviewLimit()});
    return (
        <LessonRunner
            source={source}
            policy={REVIEW_POLICY}
            summary={(tallies) => (
                <ReviewSummary {...tallies} onAnotherRound={source.reload} />
            )}
        />
    );
}
```

Zielgröße je Seite: unter 120 Zeilen (heute 429 bis 617).

---

## Migrationsplan in Scheiben

Reihenfolge: Review zuerst (kleinste Hülle, sichtbarster Unterschied zur
Lektion, Anlass der Owner-Frage), Lesson zuletzt (größte Hülle, die
meisten Bildgrundlinien). Eine Scheibe ist ein PR, ein Anliegen. Jede
Scheibe trägt ihre Bildgrundlinien im selben PR (`quality-checks.md`,
#1640) und wird nach #2682 zugerechnet: jede geänderte PNG ist entweder
der Scheibe zurechenbar oder wird zurückgesetzt.

### Scheibe 0: Fundament ohne sichtbare Änderung

- `RunnerStatusView`, `RunnerFooter` (aus `LessonFooterNav`),
  `useLessonStepState` mit optionalem `progress`, die Typen `RunnerSource`
  und `RunnerPolicy`, der leere `LessonRunner`. Keine Seite wird
  umgestellt.
- Tests: Unit-Tests je Baustein (vier je Feature nach `tdd.md`); die
  vorhandenen `LessonFooterNav.test.tsx` und `LessonStatusView.test.tsx`
  bleiben grün.
- Bildgrundlinien: keine Fläche ändert sich. Ein dispatchter 0-Diff-Lauf
  ist der Beleg, Label `visual-baselines-unaffected` mit Begründung im
  PR-Text. Vorsicht #3023: 0-Diff ist hier erwartet, weil nichts Sichtbares
  beabsichtigt ist; sobald eine Scheibe etwas Sichtbares beabsichtigt, ist
  0-Diff ein Befund.
- FeatureShots: keine. Testplan: keiner (reines Refactoring).

### Scheibe 1: Review

- `Review.tsx` auf `LessonRunner` mit der Wiederholungs-Policy (Kopf
  `session`, Fortschritt `bar`, Fuß mit Zurück, ohne Pause, Icons an, kein
  Optionen-Chip, Modus `practice`).
- Sichtbare Änderungen, jede eine Entscheidung (siehe unten): die
  Fuß-Optik wechselt von `LessonStepNav` (Textknöpfe, 14-px-Pfeile) auf
  den Lektions-Fuß (Chevrons, Haken, Text am Telefon versteckt); der Kopf
  wird zur `session`-Ausprägung von `LessonHeader`.
- Verhalten, das neu dazukommt: Neuausrichtung nach Schrittwechsel und
  Drehung, Hinweis-Löschen beim Start, und die Sperre beantworteter
  Schritte (#1790, aus `useLessonStepState`). `Review.tsx` setzt heute bei
  jedem Schrittwechsel `setChecked(false)` und `setAnswerable(false)`
  (132 bis 137), unabhängig von der Richtung: wer zurückgeht, bekommt einen
  beantworteten Schritt als unbeantwortet vorgelegt und löst mit der
  zweiten Antwort einen zweiten `recordStepAttempts` für dasselbe Element
  im selben Lauf aus. Derselbe Fehlertyp wie die Hinweis-Buchführung: eine
  Messung, die in einem von sechs Läufern richtig ist. Alle drei sind
  nutzersichtbar, also Testplan-pflichtig (DE + EN); die Sperre bekommt
  einen Test (nach Zurück: Eingabe gesperrt, kein zweiter
  `recordStepAttempts`, derselbe Test, der für das ErrorReplay-Ja Bedingung
  ist), und der PR-Body benennt, dass sich aufgezeichnete Versuche ändern
  können (Owner-Ergänzung 2026-09-23 zum Start von Scheibe 1).
- Testids: `review-page`, `review-subtitle`, `review-progress-bar`,
  `review-prev`, `review-check`, `review-next`, `review-step-*`,
  `review-summary*` bleiben über `testIdPrefix`. `Review.test.tsx`,
  `Review.enter.test.tsx`, `Review.twophase.test.tsx` und der Anker in
  `assertSurfaceStillReady` (1848-1854) bleiben unverändert grün. Der
  Testid-Gate (#1661, überwacht `frontend/src/pages/lesson/` und
  `frontend/src/components/lesson/`) darf nichts melden.
- Bildgrundlinien: `review-session` mal 3 Viewports ändert sich
  absichtlich (Fuß, Kopf). Löschen-dann-Resync (#2719/#3023), weil ein
  Wechsel der Fuß-Icons unter der 2500-Pixel-Toleranz bleiben kann.
- FeatureShots: heute keiner. Neu `review-session/schritt` und
  `review-session/zusammenfassung` (Desktop + Mobile) in der Liste und in
  `e2e/visual/features/README.md`; das ist der erste FeatureShot eines
  Nicht-Lektions-Läufers.
- Dexie-Gate: `e2e/dexie/dexie-mode.spec.ts` läuft `/review/` bereits;
  `make test-dexie-smoke` bleibt Pflicht.

### Scheibe 2: Shuffle und Endless

- Die beiden kleinsten Seiten, ohne Bildgrundlinie, ohne E2E-Spec (ein
  `grep` über `e2e/` findet für `shuffle-lesson` und `endless-lesson`
  nichts), ohne FeatureShot, und Shuffle ohne jede Seitentest-Datei. Reiner
  Gewinn an Abdeckung.
- Endless zwingt die Hülle zur Ehrlichkeit: `position: null`, Fortschritt
  `stats` (die Statuszeile mit Pause/Ende wird ein `header.extra` oder die
  dritte Fortschritts-Ausprägung), kein Zurück, kein `goPrev`. Trägt die
  Hülle das nicht sauber, ist das Design falsch, nicht Endless.
- Nebenfund schließen: `LESSON_ROUTE_PREFIXES` um beide Routen ergänzen
  (eigenes Issue nach GITHUB-ISSUE-PFLICHT, regressionsgepinnt in den
  Tests von `useIsLessonActive`).
- Neu je Läufer: ein Dexie-Smoke-Lauf beider Routen, FeatureShots
  `shuffle-session/schritt` und `endless-session/statuszeile`, und je eine
  3-Viewport-Grundlinie in `SURFACE_NAMES` (`shuffle-session`,
  `endless-session`), damit die Aufnahme-Klasse #3016 diese Flächen
  erstmals sieht. Testplan DE + EN je Modus (die einzige Erwähnung heute
  ist der Block zum Matching-Umschalter,
  `docs/manual-tests/testplan-adaptive-learner.md` 1155-1160 und
  `docs/manual-tests/testplan-adaptive-learner-en.md` 1091).

- Entscheide vor dem ersten Commit (Owner-Review 2026-09-23 zum Start):
  - **Spielbar heisst eins.** Shuffle und Endless filtern heute inline nur
    `SUPPORTED_EXERCISE_TYPES` (Kerntypen); die Hülle nutzt
    `isPlayableExerciseStep` (Kern- oder Extension-Typen). Mit der
    Umstellung spielen beide Läufe auch Extension-Übungen, die dort nie
    gerendert wurden (im echten Inhalt 20 `ext:al-speak-and-record` in
    `adaptive-learner-content`, 12 in `alc-dog-training`, in
    `alc-psychology` 8 `categorization`, 4 `error-correction`, 3
    `reading-comprehension`, 2 `graded-quiz`). Das ist gewollt und eine
    inhaltliche Erweiterung, keine Refactoring-Nebenwirkung: eine
    Definition von "spielbar", kein Policy-Feld für eine Typmenge;
    Testplan-pflichtig, und der Visual-Device-Check enthält mindestens ein
    `speak-and-record` in einer Endlossitzung auf dem Gerät.
  - **`endRun` als eigene Policy-Spalte.** Endless ist der einzige Lauf
    ohne letzten Schritt und braucht ein explizites Ende. Pause und Ende
    werden zusammen im Fuß bedient (`pause: true`, `endRun: true` nur für
    Endless); die Statuszeile wird reine Anzeige, damit ist Befund 2
    vollständig aufgelöst.
  - Randnotiz: die zwei `<main>` in `EndlessLesson.tsx` schliessen sich
    gegenseitig aus (früher Rücksprung mit `EndlessSummary`); das ist
    Code-Dopplung, kein doppeltes Landmark zur Laufzeit.

### Scheibe 3: Adaptiv und Fehler-Replay

- Beide haben Dexie-Specs (`e2e/dexie/adaptive-lesson.spec.ts`,
  `e2e/dexie/error-replay.spec.ts`) und eigene Testids; beide bringen eine
  Kopf-Erweiterung (`AdaptiveTransparencyDisplay`, `ReplayTitle` mit
  Countdown-Ring) über `header.extra` und eine
  Zusammenfassungs-Erweiterung (`SaveAdaptiveLessonButton`, Konfetti) über
  `summary`.
- Adaptiv bekommt das Enter-Kürzel; Fehler-Replay behält keinen
  Zurück-Knopf (Entscheidung). Beides Testplan-pflichtig.
- Der Router-State-Ursprung des Replays wird zu `useErrorReplaySource`;
  die Rundenlogik bekommt erstmals eigene Tests.
- Bildgrundlinien: keine vorhanden, neu anlegen (`adaptive-lesson`,
  `error-replay` in `SURFACE_NAMES`, je 3 Viewports). FeatureShots neu:
  `adaptive-lesson/transparenz`, `error-replay/zusammenfassung`.

### Scheibe 4: Lesson

- Die größte Hülle, mit der meisten Chrome, und die einzige mit
  persistiertem Fortschritt (Resume, Pause, Sperre beantworteter Schritte,
  Zeitmodus, Prüfungsmodus).
- Strategie: Inversion. Die Hülle wurde in Scheibe 0 AUS `Lesson.tsx`
  extrahiert (Fuß, Statusansicht, Zustand); der Render-Baum der Lektion
  soll nach der Umstellung byte-identisch sein. Erwartung: 0-Diff auf allen
  60 Lektions-Grundlinien (4 Ansichten mal 12 Themes = 48; 4 Flächen mal 3
  Viewports = 12) und den zehn Lektions-FeatureShots. Der dispatchte
  0-Diff-Lauf ist hier der Beleg, und weil die Änderung nicht sichtbar sein
  SOLL, ist 0-Diff hier kein Befund, sondern die Abnahme.
- Bricht die Erwartung (ein Diff), ist die Ursache zu benennen, nicht die
  Grundlinie zu erneuern (#1532).
- Testplan: keine Änderung, wenn 0-Diff hält.

### Scheibe 5 (danach, eigener Vorgang): Kompaktkopf #3173

- Erst wenn alle sechs Läufer auf der Hülle laufen: Kompaktkopf und
  Tastatur-Einklappen einmal bauen, alle sechs bekommen es.
  Bildgrundlinien und FeatureShots aller Läufer ändern sich dann
  absichtlich und in einem PR, zurechenbar, statt über Monate verteilt.
- Deshalb gehört #3173 nicht in Scheibe 1 bis 4: ein Kopf-Umbau mitten in
  der Migration macht jede Grundlinien-Änderung doppeldeutig (Migration
  oder Umbau?).

---

## Risiken

- **Verhaltens-Konvergenz ist eine Produktentscheidung, kein
  Nebeneffekt.** Enter im adaptiven Läufer, Neuausrichtung in fünf
  Läufern, Pause in der Wiederholung, Zurück im Replay: jede Angleichung
  ändert Nutzerverhalten. Die Policy-Tabelle macht sie sichtbar; der Owner
  entscheidet je Zeile (siehe unten). Ohne diese Entscheidung vorab wird
  die Migration zur Verhaltensänderung durch die Hintertür.
- **Testid-Vertrag.** Sechs Präfixe, zwölf Seitentest-Dateien für fünf
  der sechs Seiten (74 bis 1187 Zeilen; Shuffle hat keine), die
  Dexie-Specs, der Anker der Wiederholungs-Grundlinie. Eine
  Vereinheitlichung auf `runner-*` würde alles auf einmal brechen und den
  Testid-Gate auslösen. Die Präfixe bleiben (Policy).
- **i18n-Dubletten.** Vier Namensräume für dieselben Sätze. Werden sie
  zusammengelegt, fallen Schlüssel in allen 11 Katalogen weg; nach
  `pr-policy.md` (#2578) ist das ein eigener, vorangehender i18n-PR je
  Scheibe. Werden sie nicht zusammengelegt, trägt `RunnerStatusView` einen
  Namensraum-Parameter und der Zustand bleibt, wie er ist. Beides geht;
  nur nicht beides halb.
- **Endless ist strukturell anders** (Strom, Timer, Pausenzustand, kein
  Index). Die Versuchung ist, die Hülle mit Endless-Sonderfällen zu
  durchsetzen. Die Gegenwehr ist `position: null` und Fortschritt `stats`
  als erstklassige Fälle, mit eigenem Test.
- **`LessonModeProvider` um alle Läufer** ändert nichts, solange
  `practice` gepinnt ist. Erbt die Wiederholung später den Lektionsmodus,
  greift die Prüfungs-Konfiguration (keine Tipps, verzögertes Feedback)
  plötzlich auch dort. Das ist wünschenswert oder nicht; es darf nicht
  versehentlich passieren.
- **Komplexitäts-Ratchet** (`complexity-check.yml`). Eine Hülle, die sechs
  Läufer trägt, sammelt Verzweigungen. Policy als Daten, Kinder-Slots statt
  Schalter, ein Baustein je Datei halten `LessonRunner` selbst unter dem
  Budget; die Zahl wird je Scheibe gemessen, nicht am Ende.
- **Testfläche wandert.** `Lesson.test.tsx` (1187 Zeilen) prüft heute
  Hülle und Lektion gemeinsam. Nach Scheibe 4 gehören die Hüllen-Fälle in
  die Tests des Runner-Ordners, die Seitentests bleiben
  Integrationstests. Kein Test wird gelöscht, nur verschoben
  (`implementation-workflow.md`: nie Tests schwächen).
- **Bildvergleichs-Toleranz** (#3023): kleine Fuß-Änderungen (Icon 14 px
  gegen 20 px) können unter `maxDiffPixels: 2500` bleiben.
  Löschen-dann-Resync je betroffenem Motiv, sonst bleibt die Referenz alt
  und gilt als geprüft.
- **Dexie-Parität** ist durch die Migration nicht gefährdet (alle Quellen
  laufen über `getStorage()`), muss aber je Scheibe über
  `make test-dexie-smoke` neu bewiesen werden; ein Läufer, der im
  API-Modus grün ist, ist nicht bewiesen (`lessons/content-storage.md`).

---

## Offene Entscheidungen

Vor Scheibe 1 zu treffen; jede Zeile ist eine Policy-Spalte.

1. **Verhaltensmatrix.** Ratifiziert am 2026-09-23, siehe Abschnitt
   "Ratifizierte Verhaltensmatrix" unten; die Tabelle hier bleibt als
   Vorschlagsstand stehen. Vorschlag als Startpunkt:

   | Policy | Lesson | Review | Shuffle | Endless | Adaptive | ErrorReplay |
   |---|---|---|---|---|---|---|
   | Zurück-Knopf | ja | ja | ja | nein | ja | nein (heute) oder ja (Angleichung) |
   | Pause-Knopf | ja | nein | nein | Statuszeile | nein | nein |
   | Optionen-Chip / Modus | ja | nein | nein | nein | nein | nein |
   | Theorie-Link / Schwierigkeit / TTS-Box | ja | nein | nein | nein | nein | nein |
   | Enter-Kürzel | ja | ja | ja | ja | **ja (neu)** | ja |
   | Neuausrichtung Schritt/Drehung | ja | **ja (neu)** | **ja (neu)** | **ja (neu)** | **ja (neu)** | **ja (neu)** |
   | Hinweis-Löschen beim Start | ja | **ja (neu)** | **ja (neu)** | **ja (neu)** | **ja (neu)** | **ja (neu)** |
   | Fortschritt persistiert | ja | nein | nein | nein | nein | nein |
   | Modus | Wahl der Lernenden | practice (später erben?) | practice | practice | practice | practice |

2. **Fuß-Optik.** Lektions-Fuß (`LessonFooterNav`: Chevrons, Haken, Text
   am Telefon versteckt, iOS-Korrekturen) oder Sitzungs-Fuß
   (`LessonStepNav`: Textknöpfe, Pfeile)? Vorschlag: Lektions-Fuß für
   alle, weil dort die #1834-Korrekturen liegen und die Lektion die
   meistgenutzte Fläche ist.
3. **Kopf-Ausprägung.** Bekommt die Wiederholung den kompakten
   Lektionskopf (kleine `h1`, Set-Link) oder behält sie volle `h1` plus
   Untertitel? Vorschlag: `session`-Ausprägung mit Zurück-Knopf, Titel und
   Untertitel, alles in der kleinen Schrift von #1633; der Untertitel ("n
   von m fällig", "aus k Lektionen", Transparenz-Block) bleibt, weil er
   Information trägt, die der Lektion fehlt.
4. **i18n zusammenlegen** (ja: i18n-PR je Scheibe zuerst; nein:
   Namensraum-Parameter). Vorschlag: nein in Scheibe 1 bis 4, ja als
   eigener Aufräum-Vorgang danach, damit die Migrations-Diffs klein
   bleiben.
5. **`LessonStepNav` in `shared/layout`**: entfernen nach Scheibe 2 (dann
   ohne Konsumenten) oder als app-freies Primitiv behalten, das
   `RunnerFooter` umhüllt? Vorschlag: entfernen; `reusability.md` will
   geteilte Teile app-frei, aber ein Primitiv ohne Konsumenten ist totes
   Gewicht (Dead-Code-Ratchet).
6. **Endless: volles Mitglied oder Strom-Variante?** Vorschlag: volles
   Mitglied mit `position: null` und Fortschritt `stats`.
7. **Name.** `LessonRunner` (Vorschlag) oder `SessionRunner`.
   `frontend/src/pages/lesson/Session.tsx` ist bereits die Chat-Sitzung
   der sechs Methoden; `Session` als Präfix wäre doppeldeutig.
8. **Ort.** `components/lesson/runner/` (app-spezifisch: kennt
   `getStorage`, i18n-Schlüssel, Testid-Vertrag) oder `shared/`?
   Vorschlag: `components/lesson/runner/`; nur die props-getriebenen
   Primitive darunter (Fuß, Fortschritt) bleiben `shared/`-fähig.
9. **Fehler-Replay als Hook** (`useErrorReplaySource`) oder weiter
   Router-State in der Seite? Vorschlag: Hook, für Testbarkeit und Parität
   mit den fünf anderen Quellen.
10. **Erbt die Wiederholung später den Lektionsmodus?** Nicht in dieser
    Migration; als eigener Vorgang nach Scheibe 4 aufnehmen.

---

## Abnahmekriterien

Für das Gesamtvorhaben; je Scheibe der zutreffende Teil.

- Genau ein Fuß, ein Fortschrittsbalken, eine Statusansicht, ein
  Zwei-Phasen-Hook im Baum: die Klassenkette `sticky bottom-0 ... pb-safe`
  kommt unter `frontend/src/` einmal vor (heute sechsmal),
  `render*Status` null Mal (heute viermal), die inline-Prozentrechnung
  null Mal (heute viermal), `useLessonEnterKey({` außerhalb von
  `useLessonStepState` und `CorrectionBlock` null Mal (heute viermal).
- Alle sechs Routen rendern durch `LessonRunner`; ein Vitest-Pin je Seite
  (die Seite rendert `data-testid="{prefix}-page"` aus der Hülle) hält
  das.
- Enter-Kürzel, Neuausrichtung und Hinweis-Löschen in allen sechs Läufern,
  je ein Test pro Läufer und Verhalten (Reproduktion, Happy Path, Rand,
  Grenze nach `tdd.md`).
- `LESSON_ROUTE_PREFIXES` kennt alle sechs Routen, gepinnt.
- Jeder Läufer hat einen Dexie-Smoke-Lauf, ein FeatureShot-Paar (Desktop +
  Mobile) im Katalog und eine 3-Viewport-Grundlinie in `SURFACE_NAMES`;
  heute erfüllt das nur die Lektion vollständig, die Wiederholung zur
  Hälfte (Grundlinie ja, FeatureShot nein).
- Bildgrundlinien liegen im selben PR wie die Scheibe, jede geänderte PNG
  zugerechnet (#2682); Scheibe 0 und 4 belegen 0-Diff mit einem
  dispatchten Lauf.
- Testplan DE + EN je Scheibe aktualisiert, wo Verhalten dazukommt
  (Scheibe 1 bis 3), Verweis auf #1087, wo es den PR sprengt.
- `make test`, `bunx tsc --noEmit`, ESLint, `make test-dexie-smoke`,
  Komplexitäts-Gate, Testid-Gate und Dead-Code-Ratchet grün je Scheibe.
- Seitendateien unter `frontend/src/pages/lesson/` je unter 120 Zeilen
  (heute 429 bis 617); die Hüllen-Bausteine je eine Sorge, unter 200
  Zeilen.
- Kein neuer i18n-Schlüssel ohne alle 11 Kataloge; kein entfernter
  Schlüssel außerhalb eines vorangehenden i18n-PRs.

---

## Owner-Review 2026-09-23: technische Entscheidungen

Der Owner hat Analyse und Migrationsstrategie freigegeben, sobald drei
technische Fragen geklärt sind, und Akzeptanzkriterien ergänzt (Wortlaut im
Issue #3169). Die Antworten, in dieses Dokument zurückgeschrieben, damit es
die Spezifikation bleibt:

1. **Standard-Props oder Render-Props?** Gemischt, nach Datenfluss.
   `source` und `policy` sind Standard-Props (Daten, keine Darstellung; die
   Policy ist ein Konfigurationsobjekt, das die Hülle zur Laufzeit
   auswertet). Nur `summary` ist eine Render-Prop `(tallies) => ReactNode`,
   weil die Zusammenfassung Laufdaten braucht, die erst die Hülle kennt.
   Keine Kinder-Slots für Kopf oder Fuß: die kommen aus der Policy, sonst
   wandern die JSX-Verzweigungen zurück in die Seiten. State Management
   bleibt in den bestehenden Modus-Hooks; die Seite ruft ihren Hook und
   normiert das Ergebnis zu `RunnerSource`.
2. **Feature Flags oder direkt?** Direkt, in Scheiben. Scheibe 0 baut die
   Hülle ohne Konsumenten (0-Diff-Lauf als Beleg), jede weitere Scheibe
   stellt genau eine Seite um und trägt Bildgrundlinien und FeatureShots im
   selben PR; der Rückweg ist der Revert der Scheiben-PR. Ein Flag hielte
   zwei Hüllen parallel, beide bräuchten Grundlinien, und das Flag wäre
   nach #335 eine tote Kontrolle. `strict: true` und das Visual-Gate sind
   das Sicherheitsnetz.
3. **Tastaturmapping ohne Fuß-Navigation?** Das Mapping lag nie im Fuß.
   Enter kommt aus `useLessonStepState` / `useLessonEnterKey`, die
   Kürzel-Freigabe aus `useLessonShortcuts`; beide mountet die Hülle einmal
   (`policy.enterShortcut: true` ist ein Literal, das schließt die
   Adaptiv-Lücke). Der Fuß wird nicht entfernt, sondern zu `RunnerFooter`
   (aus `LessonFooterNav`, wo die #1834-Korrekturen liegen) mit der
   Fuß-Policy `{prev, pause, icons, onSummary}`; `LessonStepNav` fällt nach
   Scheibe 2 weg. Die Enter-Aktion löst die Hülle aus dem Schrittzustand
   auf (Prüfen bei offener Antwort, Weiter nach dem Ergebnis), der Fuß
   rendert nur denselben Zustand.

Ergänzte Akzeptanzkriterien des Owners (zusätzlich zu "Abnahmekriterien"
oben): alle sechs Modi nutzen `LessonRunner`; die Seitendateien sind
entfernt oder reine Routing-Wrapper; Bildgrundlinien und FeatureShots für
alle sechs Modi existieren und bestehen; keine Regressionen in #1569, #3016
und #590/#594 (je ein Test pro Läufer und Verhalten); Testabdeckung der
Policy-Logik mindestens 80 Prozent (Policy-Auswertung als reine Funktionen
mit Tabellentests über die sechs Konstanten, praktisch vollständig).

Die Verhaltensmatrix ist inzwischen ratifiziert (nächster Abschnitt).

---

## Ratifizierte Verhaltensmatrix (Owner-Entscheid 2026-09-23)

Grundlage ist der Code auf `develop` d576575a0. Vier Befunde gehen der
Ratifikation voraus; drei ändern die Matrix, einer ist ein Datenfehler mit
eigenem Vorgang.

### Befund 1: "Zurück" sind zwei Bedienelemente

Der Kopf-Ausstieg verlässt den Durchlauf (`review-back-btn`,
`shuffle-back-btn`, `endless-back-btn`, `adaptive-lesson-back-btn`,
`error-replay-back-btn` zur Lektion; die Lektion hat stattdessen den
Set-Link in `LessonHeader`, #2793). Das Fuß-Schritt-Zurück geht einen
Schritt zurück im selben Durchlauf (`lesson-prev`, `LessonStepNav.onPrev`,
`AdaptiveLessonNav.onPrev`; fehlt in Endless und im `ErrorReplayNav`). Eine
Zeile dafür entscheidet zwei Dinge mit einem Default; die Zeile wird in
`exit` und `prevStep` gesplittet.

### Befund 2: "Statuszeile" ist kein Policy-Wert

`EndlessStatLine` mischt Anzeige (Zeit, Karten, Trefferquote) mit Bedienung
(Pause, Ende). Entscheid: der Pause-Knopf wandert in den Fuß, an dieselbe
Stelle wie bei der Lektion; `EndlessStatLine` wird reine Anzeige im
Fortschritts-Bereich. `pause` ist damit ein Boolean, Endless volles Mitglied
ohne Sonderweg (deckt Punkt 6 mit ab). Sichtbare Änderung, gehört in die
Endless-Scheibe mit eigener Grundlinie, nicht in Scheibe 0.

### Befund 3: der Kopf trägt Inhalt, den keine Flagge ausdrückt

`ReplayTitle` rendert den `LessonCountdownRing` der Blitzrunde,
`AdaptiveTransparencyDisplay` den Erklärblock aus `transparency`. Entscheid:
ein zweiter Render-Prop `headerExtra?: (source) => ReactNode`, derselbe
Mechanismus wie `summary` und aus demselben Grund. Kopf-Ausstieg, Titel und
Textuntertitel bleiben Standard-Props. Zwei Render-Props, nicht sechs
Kinder-Slots; Antwort 1 des Owner-Reviews bleibt in der Sache erhalten.

### Befund 4: die Hinweis-Zeile ist ein Datenfehler

`clearHintUsage()` wird nur in `Lesson.tsx` gerufen; fünf Läufer stempeln
`hint_used` aus dem vorigen Durchlauf weiter und verkürzen damit
SRS-Intervalle falsch. Eigener Vorgang #3196, eigener PR VOR Scheibe 1 und
unabhängig von der Hülle: ein Datenkorrektur-Fix darf nicht in einem
Refactoring-PR verschwinden, sonst nimmt der Revert der Scheibe den Fix
mit. In der Matrix steht die Zeile danach als hergestellter Zustand.

### Matrix

| Policy | Lesson | Review | Shuffle | Endless | Adaptive | ErrorReplay |
|---|---|---|---|---|---|---|
| `exit` (Kopf) | Set-Link | ja | ja | ja | ja | ja (zur Lektion) |
| `prevStep` (Fuß) | ja | ja | ja | nein (strukturell) | ja | ja (neu) |
| `pause` (Fuß) | ja | nein | nein | ja (neu, aus der Statuszeile) | nein | nein |
| `optionsBar` | ja | nein | nein | nein | nein | nein |
| `theoryLink` / Schwierigkeit / TTS | ja | nein | nein | nein | nein | nein |
| `enterShortcut` | ja | ja | ja | ja | ja (neu) | ja |
| `reanchor` (Schritt + Drehung) | ja | ja (neu) | ja (neu) | ja (neu) | ja (neu) | ja (neu) |
| `clearHints` beim Start | ja | ja | ja | ja | ja | ja (#3196) |
| `persistProgress` | ja | nein | nein | nein | nein | nein |
| `mode` | Wahl der Lernenden | `practice` | `practice` | `practice` | `practice` | `practice` |
| `headerExtra` | nein | nein | nein | nein | Transparenzblock | Countdown-Ring |

Begründung der drei festgelegten Zellen:

- **ErrorReplay `prevStep`: ja.** Das heutige Nein ist keine Entscheidung
  gegen das Zurück, sondern Folge des inline geführten Zwei-Phasen-Zustands
  (ErrorReplay wie Endless), dem die Sperre bereits beantworteter Schritte
  aus `useLessonStepState` (#1790) fehlt. Die Hülle mountet den Hook für
  alle; mit der Sperre ist Zurück ein Nur-Lesen-Rückblick. Abnahme: je
  Läufer ein Test, dass nach Zurück auf einen beantworteten Schritt die
  Eingabe gesperrt ist und kein zweiter `recordStepAttempts`-Aufruf erfolgt;
  ohne diesen Test wird das Ja nicht gemerged.
- **Endless `prevStep`: nein, strukturell.** `position: null`, Schritte aus
  dem Strom; es gibt keinen vorherigen Schritt ohne Rückwärts-
  Materialisierung. Eigenschaft der Quelle, kein Policy-Wert; im
  `RunnerPolicy`-Docstring vermerken, damit es niemand als Inkonsistenz
  "korrigiert".
- **Review `mode`: `practice`, ohne Fragezeichen.** Die Vererbungsfrage
  lebt ausschliesslich in Punkt 10 (eigener Vorgang nach Scheibe 4); ein
  Fragezeichen in einer ratifizierten Tabelle würde im Code zur Bedingung.

Mit ratifiziert: Punkt 2 (Lektions-Fuß für alle; ohne ihn gäbe es keine
gemeinsame Stelle für den Endless-Pause-Knopf) und Punkt 6 (Endless volles
Mitglied).

### Nebenfund mit eigenem Vorgang

`LESSON_ROUTE_PREFIXES` (`hooks/lesson/session/useIsLessonActive.ts`) kennt
vier der sechs Routen; `/shuffle-lesson/` und `/endless-lesson/` fehlen,
also klappt die Navigation dort nicht ein. Unabhängig von der Hülle: #3197.

### Startfreigabe für Scheibe 0

1. Der Hinweis-Fix #3196 läuft als eigener PR, vor oder parallel zu
   Scheibe 0, gemerged bevor eine Scheibe eine Grundlinie zieht.
2. Der `RunnerPolicy`-Typ trägt die Spalten dieser Tabelle mit genau diesen
   Namen (`exit`, `prevStep`, `pause`, `optionsBar`, `theoryLink`,
   `enterShortcut`, `reanchor`, `clearHints`, `persistProgress`, `mode`,
   plus der Render-Prop `headerExtra` an der Hülle); die Endless-Zeile
   trägt die strukturelle Begründung im Docstring.

## i18n-Entscheid vor Scheibe 1 (Owner-Entscheid 2026-09-23)

Grundlage `develop` dfefc8e05 und die elf Kataloge. Scheibe 0 (#3201) hatte
gemeldet, dass `lesson.error_replay` keine Statusbildschirm-Schlüssel trägt
und `error.invalid_data` nur unter `lesson.*` liegt; die vorgeschlagenen
Auswege (neue `lesson.error_replay.*`-Schlüssel, oder die Hülle liest immer
`lesson.*`) tragen beide nicht.

### Was die Kataloge sagen

Fünf Statustexte, vier Namensräume (`review`, `shuffle`, `endless`,
`adaptive`), alle elf Sprachen besetzt. Drei davon sind in der Quelle (en)
wortgleich, also echte Dopplung: `back_to_dashboard`, `not_cached_body`,
`error.missing_params`. Zwei sind zu Recht verschieden, weil sie der
lernenden Person erklären, warum genau dieser Lauf nichts zeigt:
`empty_body` ("All caught up! ..." gegen "This set needs at least two
lessons ..." gegen "Nothing to adapt yet ...") und `error.load_failed`.

"Immer `lesson.*`" geht nicht: `lesson.back_to_dashboard` und
`lesson.empty_body` existieren nicht, und `lesson.error.missing_params`
("No lesson selected ...") sowie `lesson.not_cached_body` ("This lesson
isn't downloaded ...") sprechen von einer Lektion, wo fünf Läufer ein Set
brauchen.

Nebenbefund: die Dopplung hatte bereits Drift erzeugt. Im Deutschen drei
Fassungen eines englischen Satzes (`not_cached_body`: "Öffne den
Inhalts-Browser zuerst." gegen "... um es zuerst herunterzuladen." gegen
"... um es zuerst zu laden."), dazu "Inhalts-Set" gegen "Inhaltsset"; el,
es, fr, hi, id, ja, ko, pt, tr trugen ebenfalls Varianten, und
`repo.back_to_dashboard` war eine fünfte Kopie desselben Satzes. Dieselbe
Fehlerklasse wie die fünf Fuß-Implementierungen: kopierte Wahrheit driftet,
und kein Test vergleicht sie. Issue #3203.

### Entscheid

1. **Neuer Namensraum `runner.*` für die geteilte Chrome**, in allen elf
   Katalogen: `runner.back_to_dashboard`, `runner.not_cached_body`,
   `runner.error.missing_params`, `runner.error.invalid_data`. Letzterer
   kommt von `lesson.error.invalid_data`, von "lesson" auf "content"
   neutralisiert. Für jede Sprache gewinnt die Fassung, die der englischen
   Quelle und den Begriffen des eigenen Katalogs am nächsten liegt (de:
   "Dieses Set ist noch nicht heruntergeladen. Öffne den Inhaltsbrowser,
   um es zuerst herunterzuladen." und "Kein Inhalts-Set ausgewählt."; el
   `σετ` statt `σύνολο`; pt die im Katalog vorherrschende
   "baixado"-Varietät; tr "Panoya dön", weil die Navigation "Pano" sagt).
   Alle bestehenden Kopien werden auf diese eine Fassung gezogen, damit
   alter und neuer Pfad bis Scheibe 4 dasselbe rendern. Eigener i18n-PR
   vor Scheibe 1 (#2578): PR #3204.
2. **`empty_body` und `error.load_failed` bleiben pro Läufer** und werden
   über die Policy adressiert: zwei neue Felder `emptyBodyKey` und
   `loadFailedKey` in `RunnerPolicy`; die sechs eingefrorenen Policies
   tragen die bestehenden Schlüssel als Literale. Kein Katalog ändert sich
   dafür, die Hülle bekommt keine Verzweigung. `emptyBodyKey` ist
   `string | null`: `LessonStatusKind` kennt keinen Leerzustand, eine
   Lektion ist fehlend oder ungeladen, nie leer; ein Pflichtschlüssel hätte
   einen toten Eintrag in elf Katalogen erzwungen (Owner-Entscheid zur
   ersten Fassung von PR #3206).
3. **ErrorReplay braucht keine neuen Schlüssel.** `lesson.error_replay.empty`
   existiert in allen elf Katalogen und ist genau der Leerzustandstext, den
   die Seite heute inline rendert; die Policy zeigt mit `emptyBodyKey`
   darauf. Für `loadFailedKey` ist `lesson.error.load_failed` sachlich
   richtig, weil der Replay aus einer konkreten Lektion kommt.
4. **Abräumen der ersetzten Kopien erst in Scheibe 4**, wenn die letzte
   Seite umgestellt ist. Solange die Originale neben `RunnerFooter` und
   `RunnerStatusView` liegen, laufen beide Pfade. Kein Test schlägt auf
   unbenutzte Schlüssel an (geprüft: `i18n-sync`, `update-guard-parity`,
   `full-tree-key-coverage` prüfen nur Schlüssel, die der Code liest).
5. **Ein Test macht die Drift künftig rot**: für jeden `runner.*`-Schlüssel
   darf kein Namensraum in keiner Sprache eine abweichende Kopie desselben
   englischen Texts führen. Er lebt in `i18n-sync.test.ts`, weil das die
   eine Datei ist, die der `i18n_only`-Pfad der PR-CI namentlich ausführt;
   ein reiner Katalog-PR kann einen Runner-Satz also nicht unbemerkt neu
   abzweigen. RED-Beleg: mit den Schlüsseln, aber ohne Konsolidierung,
   fielen drei der vier Drift-Prüfungen.

### Die Regel: geteilt wird bei gleicher Bedingung, nicht bei gleichem Satz

Die erste Fassung von PR #3206 liess die Hülle `not_cached_body` und
`error.missing_params` für jeden Lauf aus `runner.*` lesen, auch für die
Lektion, mit der Begründung, das Set sei ohnehin das, was geladen wird. Der
Owner lehnte das ab, und zwar nicht wegen des Wortlauts, sondern weil die
auslösenden Bedingungen verschieden sind:

- Fünf Läufer: `not-cached` fällt, wenn `listSets()` kein Set mit dieser
  `setId` findet. Das Set fehlt tatsächlich; der Inhaltsbrowser ist der
  nächste Schritt.
- Lektion: `not-cached` fällt, wenn `getLesson(source, setId, filename)`
  mit 404 oder `not found|not cached` wirft (`useLesson.ts` 170/177). Das
  Set kann vollständig heruntergeladen sein und trotzdem genau diese
  Lektionsdatei fehlen, oder der Dateiname in der URL ist falsch. Mit
  `runner.not_cached_body` sähe die Person das Set im Inhaltsbrowser
  heruntergeladen stehen und hätte keinen nächsten Schritt: nicht nur
  unpräzise, sondern nicht handlungsfähig.
- `missing_params`: der Lektions-Guard ist `!source || !setId ||
  !filename`, den fünf anderen fehlt nur die `setId`. "No lesson selected"
  und "No content set selected" beschreiben verschiedene fehlende Dinge.

**Regel:** Ein Schlüssel wird geteilt, wenn die auslösende Bedingung
identisch ist, nicht wenn der Satz gleich aussieht. Sie sagt alle vier
Policy-Schlüssel korrekt voraus, ohne dass man sie einzeln diskutiert:
`emptyBodyKey`, `loadFailedKey`, `notCachedBodyKey`, `missingParamsKey`.
Nach dem Kriterium "klingt gleich" wäre `not_cached_body` in `runner.*`
gelandet, was in der ersten Fassung gerade passiert ist; nach dem
Kriterium "gleiche Bedingung" nicht.

Folge für `RunnerPolicy`: zwei weitere Felder `notCachedBodyKey` und
`missingParamsKey`, gleiches Muster wie `emptyBodyKey`. Die Lektion zeigt
auf `lesson.*`, die fünf anderen auf `runner.*`. `runner.back_to_dashboard`
übernimmt die Lektion dagegen (den Schlüssel hat sie heute gar nicht), und
`runner.error.invalid_data` bleibt geteilt: das ist der freundliche
Nicht-Dev-Fallback, der über den Inhaltsautor spricht, nicht über den
Läufer. Der Paritätstest zur Lektion deckt damit nur noch einen geteilten
Satz ab statt drei; der Key-Echo-Test pinnt die anderen beiden.

### Zu den beiden Annahmen aus Scheibe 0

- **Replay leert Hinweise beim Mount, nicht pro Runde**: bestätigt. Die
  Blitzrunde ist kein neuer Lauf, sondern ein Abschnitt desselben; pro
  Runde zu leeren hiesse, einen in Runde eins aufgedeckten Tipp beim
  erneuten Antreffen desselben Elements zu vergessen.
- **`RunnerFooter` und `RunnerStatusView` neben den Originalen, mit
  Byte-Paritätstests, Dopplung endet mit Scheibe 4**: bestätigt, mit
  Auflage: die Paritätstests werden in derselben PR gelöscht, die das
  letzte Original entfernt. Ein Paritätstest gegen eine gelöschte Datei
  ist entweder rot oder er testet nichts, und die zweite Variante ist die
  gefährlichere.

### Stand

Scheibe 0 ist gemerged (#3201, c1ff0fdf0); die Vorbedingungen #3196
(b33eddd23) und #3197 (2cc1beb14) lagen vorher auf `develop`. Der i18n-PR
#3204 (0c116d8d9, #3203 geschlossen) und der Policy-PR #3206 (13074eb0d,
vier Schlüssel-Spalten, Regel oben) sind gemerged.

Scheibe 1 ist gemerged (#3210, 7c74e234b): `Review.tsx` 569 auf 63 Zeilen,
die Hülle komponiert Kopf (`RunnerHeader`, Session-Ausprägung), Balken
(`RunnerProgress`), Schritt (`RunnerStep`), Fuß, Statusbildschirme,
Zusammenfassung, Enter, Neuausrichtung, Hinweis-Löschen und die Sperre
(`useRunStepResults` als lauf-lokale Ergebnisquelle für
`useLessonStepState`, das dafür `stepId` und einen auf `step_results`
verengten `progress`-Typ bekam). Adapter `hooks/lesson/sources/useReviewSource`.
Drei Abweichungen vom Entwurf, jede im PR benannt: `RunnerSource` trägt
`setId`, `runKey` und `tallies` (der Modus-Hook besitzt die Zahlen, die
Hülle kann die Element-Zählung aus #3170 nicht nachbauen); das Runner-Barrel
exportiert nur die konsumierte Fläche (Dead-Code-Ratchet, kein Banking; jede
Scheibe ergänzt ihre Policy beim Konsum); die Sticky-Kette bleibt bei 7, weil
`Review.tsx` sie nie inline trug (`LessonStepNav`, das Shuffle noch nutzt;
Abbau in Scheibe 2). Baselines per Löschen-dann-Resync, Bänder-Analyse im
PR-Kommentar: Fuß und +12 px (flex-Spalte) sind die Scheibe, Untertitel
(#3170), Matching-Reihenfolge (#2882) und Nav-Knöpfe (#3123) Fremd-Drift
unter der Toleranz seit der Aufnahme vom 21.08. Vier FeatureShots
`review-session/{schritt,zusammenfassung}`. Nächste: Scheibe 2 (Shuffle
und Endless), mit dem Abbau von `LessonStepNav`.

---

## Verwandte Dokumente

- EXP-020 (Lektions-Flusssteuerung Prüfen/Weiter): der Zwei-Phasen-Knopf,
  den die Hülle einmal trägt.
- EXP-044 (CSS-Vereinheitlichung): die Fuß-Klassenkette ist ein Kind der
  Tailwind-Phase-B-Migration (#1419) und wurde mit jeder Kopie mitkopiert.
- `lessons/ci-gates.md`, "Ein Bildvergleich prüft nur, was die Referenz
  unterscheidbar macht" (#2696) und "Nachtrag #3016": die Aufnahme-Klasse,
  die diese Hülle auf einen Ort zieht.
- `lessons/frontend.md`, "React `useEffect` deps + i18n test mocks": der
  Grund, warum `useReviewLesson` den Titel als Ref liest (#2703) und der
  Anker der Wiederholungs-Grundlinie existiert.
