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
2. **Das Format in der Engine erweitern.** Das kanonische Zuhause des
   Lektionsformats ist das Paket
   [learn-content-engine](https://github.com/astrapi69/learn-content-engine):
   den Typ dort ins Schema, in die handgeschriebene semantische Schicht
   (`validate.ts`) und in die
   [Format-Referenz](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
   aufnehmen, dann die Engine releasen. Eine Formatänderung **beginnt in der
   Engine** - das `schema/*.json` der App ist ein Byte-Spiegel des gepinnten
   Release mit genau einem Schreiber
   (`scripts/sync_schema_mirror_from_engine.py`, #2265).
3. **Pin bumpen, Sync laufen lassen.** Den `learn-content-engine`-Pin in
   `frontend/package.json` erhöhen, dann `make sync-schema` im **selben PR**:
   es frischt den Spiegel `schema/*.json` aus dem installierten Paket auf und
   regeneriert jedes abgeleitete Artefakt - die strukturelle Pydantic-Schicht
   (`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py`
   via `scripts/generate_pydantic_models.py`), die TS-Lektionstypen
   (`frontend/src/storage/types/content/lesson-schema.generated.ts`) und die
   Format-Referenz-Doku. Ein gespiegeltes oder generiertes Artefakt **nie von
   Hand editieren**; das Drift-Gate `make sync-schema-check` schlägt sonst
   fehl.
4. **Semantische Schicht + Schema-Version.** Die App-seitigen Feld-
   übergreifenden Regeln als dünne Subklasse in
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`
   ergänzen (die strukturellen Felder sind generiert; nur die Semantik ist
   handgeschrieben) und `CURRENT_SCHEMA_VERSION` in `models.py` an der
   Schema-Version des gepinnten Engine-Release halten (**Minor** = additiv;
   alter Content bleibt über den Major-Version-Match gültig).
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
   (`frontend/src/lib/content/validation/content-validator.ts`) erweitern.
   Die Qualitätsminima leben in der `quality-rules.json` der Engine
   (gespiegelt nach `schema/quality-rules.json`); berührt der Typ sie, werden
   sie in der Engine erweitert, nicht in der App.
8. **Authoring-Doku.** Den Typ in die
   [Katalog-Tabelle](authoring-content.md#aufgabentyp-katalog-status) und einen
   `### <typ>`-Referenzblock mit JSON-Beispiel aufnehmen (EN + DE).
9. **Tests.** Schema akzeptiert ein gültiges Beispiel und lehnt ein ungültiges
   ab (fehlendes Pflichtfeld / Extra-Key); der Renderer rendert + bewertet
   korrekt/falsch; der SRS-Versuch wird aufgezeichnet; mobile Visual-Baseline
   ergänzen, falls die Optik des Controls neu ist.
10. **Folge-Arbeit (nicht diese PR).** Die Content-Repos
    (`adaptive-learner-content`) übernehmen den neuen Typ, wenn sie ihr
    Engine-Release neu pinnen; vermerken, nicht darauf warten.

## Warum das klein bleibt

Weil das Format aus dem gepinnten Engine-Release gespiegelt wird und jedes
App-Artefakt aus diesem Spiegel abgeleitet ist (Schritt 3) und der
Dispatcher-Paritätstest Registry-gleich-Enum erzwingt (Schritt 5), ist ein
neuer Typ eine additive Änderung mit fester Form: Engine → Pin → generieren →
Renderer → Bewertung → Doku → Tests. Keine parallel handgepflegte Kopie kann
driften, und kein Typ kann ohne Renderer ausgeliefert werden.
