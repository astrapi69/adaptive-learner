/**
 * Fill a parsed lesson with the defaults the engine's lesson schema
 * declares (#3372).
 *
 * The API backend returns lessons through a Pydantic model, so every
 * defaulted field is present there. The browser (Dexie) path parses raw
 * JSON, and ``ContentLesson`` types those fields as always present:
 * exercises without ``card_ids`` crashed the result export, the correction
 * round and review building. #1636 and #3349 each patched one field; this
 * walks the engine schema itself (the single source of the defaults), so
 * a default added upstream is covered without an app change.
 *
 * Only non-null defaults are applied: a ``null`` default means "absent",
 * and the app types those fields as optional.
 *
 * @example
 * const lesson = applyLessonSchemaDefaults(JSON.parse(raw));
 */

import engineLessonSchema from "learn-content-engine/schema/lesson.schema.json";

interface SchemaNode {
    $ref?: string;
    anyOf?: SchemaNode[];
    oneOf?: SchemaNode[];
    type?: string | string[];
    properties?: Record<string, SchemaNode>;
    items?: SchemaNode;
    default?: unknown;
}

const ROOT = engineLessonSchema as SchemaNode & {$defs: Record<string, SchemaNode>};

function resolve(node: SchemaNode): SchemaNode {
    if (node.$ref?.startsWith("#/$defs/")) {
        return ROOT.$defs[node.$ref.slice("#/$defs/".length)] ?? {};
    }
    return node;
}

function hasType(node: SchemaNode, type: string): boolean {
    return Array.isArray(node.type) ? node.type.includes(type) : node.type === type;
}

/** The branch of a union that describes ``value`` (object or array). */
function branchFor(node: SchemaNode, value: unknown): SchemaNode | null {
    const resolved = resolve(node);
    const union = resolved.anyOf ?? resolved.oneOf;
    if (!union) return resolved;
    for (const option of union.map(resolve)) {
        if (Array.isArray(value) ? hasType(option, "array") : option.properties !== undefined) {
            return option;
        }
    }
    return null;
}

function fill(value: unknown, node: SchemaNode): void {
    if (value === null || typeof value !== "object") return;
    const schema = branchFor(node, value);
    if (schema === null) return;
    if (Array.isArray(value)) {
        if (schema.items) for (const item of value) fill(item, schema.items);
        return;
    }
    const target = value as Record<string, unknown>;
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
        if (!(key in target) && property.default !== undefined && property.default !== null) {
            target[key] = structuredClone(property.default);
        }
        if (key in target) fill(target[key], property);
    }
}

/** Return ``lesson`` with every missing non-null schema default filled in
 *  (in place; the same object is returned for chaining). */
export function applyLessonSchemaDefaults<T>(lesson: T): T {
    fill(lesson, ROOT);
    return lesson;
}
