/**
 * Mission catalog loader (EXP-010 / Phase 56C).
 *
 * Reads the bundled ``frontend/src/data/missions/templates.json``
 * (regenerated from the plugin YAML by ``make sync-missions``).
 * Same catalog in both storage modes - no API roundtrip.
 */

import templatesBundle from "../../data/missions/templates.json";
import type {MissionTemplate} from "./types";

const TEMPLATES: readonly MissionTemplate[] = (
    templatesBundle as {templates: MissionTemplate[]}
).templates;

/** All bundled mission templates. */
export function getTemplates(): readonly MissionTemplate[] {
    return TEMPLATES;
}

/** Look up a mission template by id, or undefined when unknown. */
export function getTemplate(id: string): MissionTemplate | undefined {
    return TEMPLATES.find((t) => t.id === id);
}
