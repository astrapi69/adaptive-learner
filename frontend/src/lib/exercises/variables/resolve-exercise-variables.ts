/**
 * Parametric-exercise resolution (#3109, schema v1.14, engine#151).
 *
 * The engine owns the whole contract since engine#220: it samples every
 * SAMPLED variable, evaluates every COMPUTED one with the same parser its
 * validator uses, rounds each to its display precision and substitutes
 * every ``{{name}}`` reference. This module only binds the engine's generic
 * resolver to the app's exercise type, so call sites keep their import
 * (#3346: the app's own 290-line second parser and its copy of
 * ``sampleVariable`` are gone).
 *
 * Run ONCE PER ATTEMPT before the exercise reaches its renderer. An
 * exercise without ``variables`` comes back as the same object, so a
 * lesson about Jinja2 templates never has its literal ``{{ server }}``
 * touched.
 *
 * @example
 * const {exercise, values} = resolveExerciseVariables(rawExercise, {
 *     values: reviewed?.resolved_variables,
 * });
 */

import {resolveExerciseVariables as engineResolveExerciseVariables} from "learn-content-engine";
import type {
    ResolveExerciseVariablesOptions,
    ResolvedExerciseVariables as EngineResolvedExerciseVariables,
} from "learn-content-engine";

import type {ContentLessonExercise} from "../../../storage/types";

export {evaluateExpression} from "learn-content-engine";

/** The engine's resolution result for an app exercise. */
export type ResolvedExerciseVariables = EngineResolvedExerciseVariables<ContentLessonExercise>;

/** Resolves an exercise's ``variables`` (if any) into a concrete instance,
 *  replaying ``options.values`` where given. Delegates to the engine. */
export function resolveExerciseVariables(
    exercise: ContentLessonExercise,
    options?: ResolveExerciseVariablesOptions,
): ResolvedExerciseVariables {
    return engineResolveExerciseVariables(exercise, options);
}
