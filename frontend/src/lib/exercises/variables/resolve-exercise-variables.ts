/**
 * Parametric-exercise resolution (#3109, schema v1.14, engine#151).
 *
 * ``learn-content-engine`` 0.24.1 added ``Exercise.variables`` (each SAMPLED
 * via ``min``/``max``/optional ``step``, or COMPUTED via an ``expression``
 * over earlier-declared variables) and lets any string field of the
 * exercise reference one as ``{{name}}``. The engine validates the contract
 * and never samples, evaluates or substitutes - that is this module's job,
 * run ONCE PER ATTEMPT before the exercise reaches its renderer.
 *
 * Pure and renderer-agnostic: no React, no DOM. {@link resolveExerciseVariables}
 * is the single entry point; an exercise without ``variables`` passes
 * through unchanged (same object reference) so a lesson about Jinja2
 * templates never has its literal ``{{ server }}`` touched (only an
 * exercise that DECLARES ``variables`` is scanned, per the contract).
 */

import type {ContentLessonExercise} from "../../../storage/types";

type ExerciseVariable = NonNullable<ContentLessonExercise["variables"]>[number];

export interface ResolveExerciseVariablesOptions {
    /** Random source for SAMPLED variables. Defaults to ``Math.random``;
     *  override with a deterministic function in tests. */
    random?: () => number;
    /** Reuse these previously drawn/computed values instead of sampling and
     *  evaluating again - the review-replay path: a revisited attempt shows
     *  the exact same concrete instance the learner originally saw. A
     *  variable missing from this map (e.g. content changed since the
     *  attempt) falls back to a fresh sample/evaluation. */
    values?: Readonly<Record<string, number>>;
}

export interface ResolvedExerciseVariables {
    /** The concrete exercise: every ``{{name}}`` substituted, no braces
     *  left. Identical (same reference) to the input when it declares no
     *  variables. */
    exercise: ContentLessonExercise;
    /** The drawn (sampled) or computed value per declared variable name,
     *  rounded to its display precision - the shape to persist alongside an
     *  attempt so a review can reconstruct the same instance. */
    values: Record<string, number>;
    /** Tolerance for an ``accept`` entry that is a PURE reference to a
     *  toleranced variable (e.g. ``accept: ["{{sum}}"]``), keyed by the
     *  substituted (display) text of that entry. A partial reference
     *  (``"The answer is {{sum}}"``) never grades numerically - only the
     *  existing text matcher applies there. */
    toleranceByAcceptText: ReadonlyMap<string, number>;
}

const PLACEHOLDER_RE = /\{\{([a-z][a-z0-9_]*)\}\}/g;
const PURE_REFERENCE_RE = /^\{\{([a-z][a-z0-9_]*)\}\}$/;

/** Count of decimal digits in ``n``'s shortest string form (``0.5`` -> 1,
 *  ``0.25`` -> 2, ``2`` -> 0). Used to derive display/rounding precision
 *  from a SAMPLED variable's ``step``. */
function decimalPlaces(n: number): number {
    const s = n.toString();
    const dot = s.indexOf(".");
    return dot === -1 ? 0 : s.length - dot - 1;
}

function roundToPrecision(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/** integers without decimals; decimals with the precision ``step`` implies,
 *  so a step of 0.5 never prints float noise like ``1.50000001``. Computed
 *  variables (no ``step``) round to a fixed precision for the same reason -
 *  ``String()`` on the rounded number then drops any trailing zeros. */
export function formatVariableValue(value: number, step: number | undefined): string {
    const decimals = step !== undefined ? decimalPlaces(step) : 6;
    return String(roundToPrecision(value, decimals));
}

/** Draws a value for one SAMPLED variable (``min``/``max``, optional
 *  ``step``). Without ``step`` the value is an integer in ``[min, max]``;
 *  with ``step`` it is one of ``min``, ``min + step``, ``min + 2*step``, ...
 *  up to (never past) ``max``. */
export function sampleVariable(
    variable: Pick<ExerciseVariable, "name" | "min" | "max" | "step">,
    random: () => number,
): number {
    const min = variable.min ?? 0;
    const max = variable.max ?? min;
    if (variable.step !== undefined && variable.step > 0) {
        // Tiny epsilon guards a max that lands exactly on the grid from
        // being excluded by float error in the division.
        const steps = Math.floor((max - min) / variable.step + 1e-9);
        const k = Math.floor(random() * (steps + 1));
        return min + k * variable.step;
    }
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    const range = Math.max(hi - lo + 1, 1);
    const k = Math.floor(random() * range);
    return lo + k;
}

class ExpressionError extends Error {}

const TOKEN_RE = /\s*([()+\-*/]|\d+(?:\.\d+)?|\.\d+|[a-z][a-z0-9_]*)\s*/g;

function tokenize(expression: string): string[] {
    const tokens: string[] = [];
    let idx = 0;
    while (idx < expression.length) {
        TOKEN_RE.lastIndex = idx;
        const m = TOKEN_RE.exec(expression);
        if (!m || m.index !== idx) {
            throw new ExpressionError(
                `Cannot parse expression near '${expression.slice(idx)}' in: ${expression}`,
            );
        }
        tokens.push(m[1]);
        idx = TOKEN_RE.lastIndex;
    }
    return tokens;
}

/** Evaluates a COMPUTED variable's expression: decimal numbers, variable
 *  names, ``+ - * /``, parentheses, unary minus - the deliberately small
 *  grammar the engine's own validator parses (never evaluates). Names
 *  resolve against ``values`` (variables declared earlier in the list). */
export function evaluateExpression(
    expression: string,
    values: Readonly<Record<string, number>>,
): number {
    const tokens = tokenize(expression);
    let pos = 0;
    const peek = (): string | undefined => tokens[pos];
    const advance = (): string => {
        const tok = tokens[pos];
        if (tok === undefined) {
            throw new ExpressionError(`Unexpected end of expression: ${expression}`);
        }
        pos++;
        return tok;
    };

    function parseExpr(): number {
        let value = parseTerm();
        while (peek() === "+" || peek() === "-") {
            const op = advance();
            const rhs = parseTerm();
            value = op === "+" ? value + rhs : value - rhs;
        }
        return value;
    }
    function parseTerm(): number {
        let value = parseUnary();
        while (peek() === "*" || peek() === "/") {
            const op = advance();
            const rhs = parseUnary();
            value = op === "*" ? value * rhs : value / rhs;
        }
        return value;
    }
    function parseUnary(): number {
        if (peek() === "-") {
            advance();
            return -parseUnary();
        }
        if (peek() === "+") {
            advance();
            return parseUnary();
        }
        return parsePrimary();
    }
    function parsePrimary(): number {
        const tok = advance();
        if (tok === "(") {
            const value = parseExpr();
            if (advance() !== ")") {
                throw new ExpressionError(`Expected ')' in: ${expression}`);
            }
            return value;
        }
        if (/^[0-9.]/.test(tok)) {
            const n = Number(tok);
            if (!Number.isFinite(n)) {
                throw new ExpressionError(`Invalid number '${tok}' in: ${expression}`);
            }
            return n;
        }
        if (/^[a-z][a-z0-9_]*$/.test(tok)) {
            const value = values[tok];
            if (value === undefined) {
                throw new ExpressionError(
                    `Undefined variable '${tok}' in expression: ${expression}`,
                );
            }
            return value;
        }
        throw new ExpressionError(`Unexpected token '${tok}' in: ${expression}`);
    }

    const result = parseExpr();
    if (pos !== tokens.length) {
        throw new ExpressionError(`Unexpected trailing input in: ${expression}`);
    }
    return result;
}

/** The variable name when ``text`` (trimmed) is EXACTLY one ``{{name}}``
 *  reference and nothing else, else null. Distinguishes an ``accept`` entry
 *  that IS a variable's value (tolerance-gradeable) from one that merely
 *  MENTIONS it (text-matched as before). */
function pureReferenceName(text: string): string | null {
    const m = PURE_REFERENCE_RE.exec(text.trim());
    return m ? m[1] : null;
}

function substituteString(text: string, formatted: Readonly<Record<string, string>>): string {
    return text.replace(PLACEHOLDER_RE, (whole, name: string) =>
        Object.hasOwn(formatted, name) ? formatted[name] : whole,
    );
}

/** Recursively substitutes ``{{name}}`` in every string leaf of an
 *  arbitrary JSON-like value (arrays, plain objects, opaque
 *  ``ext_payload`` included) - depth-first, type-preserving. */
function deepSubstitute<T>(value: T, formatted: Readonly<Record<string, string>>): T {
    if (typeof value === "string") {
        return substituteString(value, formatted) as unknown as T;
    }
    if (Array.isArray(value)) {
        return value.map((item) => deepSubstitute(item, formatted)) as unknown as T;
    }
    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            out[key] = deepSubstitute(item, formatted);
        }
        return out as T;
    }
    return value;
}

/** Resolves an exercise's ``variables`` (if any) into a concrete instance:
 *  samples/evaluates every declared variable in declaration order, then
 *  substitutes every ``{{name}}`` occurrence across the WHOLE exercise
 *  object. An exercise without ``variables`` (or an empty list) passes
 *  through as the SAME object reference - untouched, including any literal
 *  ``{{...}}`` it might contain (Jinja2 lessons). */
export function resolveExerciseVariables(
    exercise: ContentLessonExercise,
    options: ResolveExerciseVariablesOptions = {},
): ResolvedExerciseVariables {
    const variables = exercise.variables;
    if (!variables || variables.length === 0) {
        return {exercise, values: {}, toleranceByAcceptText: new Map()};
    }
    const random = options.random ?? Math.random;
    const reuse = options.values;

    const values: Record<string, number> = {};
    const formatted: Record<string, string> = {};
    const toleranceByName = new Map<string, number>();

    for (const variable of variables) {
        const reused = reuse?.[variable.name];
        const raw =
            reused !== undefined
                ? reused
                : variable.expression !== undefined
                  ? evaluateExpression(variable.expression, values)
                  : sampleVariable(variable, random);
        const decimals = variable.step !== undefined ? decimalPlaces(variable.step) : 6;
        const rounded = roundToPrecision(raw, decimals);
        values[variable.name] = rounded;
        formatted[variable.name] = formatVariableValue(rounded, variable.step);
        if (variable.tolerance !== undefined) {
            toleranceByName.set(variable.name, variable.tolerance);
        }
    }

    const resolvedExercise = deepSubstitute(exercise, formatted);

    const toleranceByAcceptText = new Map<string, number>();
    for (const acceptEntry of exercise.accept ?? []) {
        const name = pureReferenceName(acceptEntry);
        if (name !== null && toleranceByName.has(name)) {
            toleranceByAcceptText.set(formatted[name], toleranceByName.get(name)!);
        }
    }

    return {exercise: resolvedExercise, values, toleranceByAcceptText};
}
