# Neuen Aufgabentyp hinzufügen

Das kanonische Modell wird **nicht** auf Vorrat erweitert. Ein neuer
Aufgabentyp kommt nur, wenn konkreter Content ihn braucht - und dann als eine
kleine, additive PR. Dies ist das verbindliche Rezept, abgeleitet aus der
realen `cloze`/`select`-Multiple-Choice-Arbeit (#1342) und der EXP-039-
Schema-Pipeline.

Bevor du beginnst: prüfe, ob es wirklich ein neuer **Typ** ist und nicht eine
Darstellungsform oder eine Konvention, die der
[Aufgabentyp-Katalog](authoring-content.md#aufgabentyp-katalog-status) schon
abdeckt (Text-Multiple-Choice, Wahr/Falsch, Dropdown/Radio/Checkbox sind
**keine** neuen Typen). Er muss **binär SRS-bewertbar** sein (ein einziges
korrekt/falsch-Ergebnis pro Element) - das ist die Grenze, die die
„Bewusst nicht"-Liste des Katalogs zieht.

## Schritte

1. **EXP-Eintrag / Begründung.** Bedarf, binäre Bewertungssemantik und
   Abgrenzung zu bestehenden Typen in der passenden Exploration festhalten
   (`docs/explorations/EXP-041-*` für Aufgabentyp-Eignung, oder eine neue EXP).
   Kein Typ ohne dokumentierten Grund.
2. **Pydantic-Modell + Enum.** Den Wert zum `ExerciseType`-Enum und die
   typspezifischen Felder + `model_validator` (mit `model_config =
   ConfigDict(extra="forbid")`) in
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`
   ergänzen. Das Schema (App) ist die aktuelle Quelle der Wahrheit (EXP-039).
3. **Generierung laufen lassen.** `make sync-schema` regeneriert `schema/*.json`
   und die TS-Lektionstypen
   (`frontend/src/storage/types/content/lesson-schema.generated.ts`) + die
   Format-Referenz-Doku. Ein generiertes Artefakt **nie von Hand editieren**;
   das Drift-Gate `make sync-schema-check` schlägt sonst fehl.
4. **Schema-Version bumpen.** `CURRENT_SCHEMA_VERSION` in `models.py` um einen
   **Minor**-Schritt (additiv) erhöhen; alter Content bleibt gültig
   (Major-Version-Match).
5. **Renderer registrieren.** Den Branch + den Typ zu
   `SUPPORTED_EXERCISE_TYPES` in
   `frontend/src/components/exercises/shell/ExerciseDispatcher.tsx` ergänzen.
   Die **Registry muss dem Enum entsprechen** - ein Paritätstest erzwingt das,
   sodass ein nicht gerenderter Typ die CI bricht (die Invariante, die totes
   Schema verhindert).
6. **Bewertung / SRS anschließen.** Aus dem Renderer via
   `useControlledExercise` ein `ExerciseScored` ausgeben; der geteilte
   `onComplete`-→-`recordStepResult`-Pfad in `LessonStepView.tsx` fächert jeden
   Versuch bereits über `getStorage().elementErrors.recordBulk` auf - diesen
   wiederverwenden, keinen zweiten Aufzeichnungspfad bauen.
7. **Content-Repo-Validierung.** Den Client-Validator
   (`frontend/src/lib/content/validation/content-validator.ts`) erweitern und,
   falls der Typ die Qualitätsminima berührt, die geteilten `QUALITY_RULES` in
   `scripts/generate_lesson_schema.py` (von learn-content-engine
   übernommen; die Content-Repos spiegeln die Engine, auf deren Release gepinnt).
8. **Authoring-Doku.** Den Typ in die
   [Katalog-Tabelle](authoring-content.md#aufgabentyp-katalog-status) und einen
   `### <typ>`-Referenzblock mit JSON-Beispiel aufnehmen (EN + DE).
9. **Tests.** Schema akzeptiert ein gültiges Beispiel und lehnt ein ungültiges
   ab (fehlendes Pflichtfeld / Extra-Key); der Renderer rendert + bewertet
   korrekt/falsch; der SRS-Versuch wird aufgezeichnet; mobile Visual-Baseline
   ergänzen, falls die Optik des Controls neu ist.
10. **Folge-Arbeit (nicht diese PR).** Die Bibliothek `learn-content-engine`
    zieht das erweiterte Schema bei ihrer Migration nach; vermerken, nicht
    darauf warten.

## Warum das klein bleibt

Weil das Schema generiert wird (Schritt 3) und der Dispatcher-Paritätstest
Registry-gleich-Enum erzwingt (Schritt 5), ist ein neuer Typ eine additive
Änderung mit fester Form: Modell → generieren → Renderer → Bewertung → Doku →
Tests. Kein parallel handgepflegter Spiegel kann driften, und kein Typ kann
ohne Renderer ausgeliefert werden.
