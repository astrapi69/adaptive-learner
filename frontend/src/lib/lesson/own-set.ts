/**
 * Own-set predicate for mentor-mode affordances (#2766/#2768).
 *
 * A lesson counts as the learner's OWN editable content when it lives in
 * the user-generated source (created, imported, or an "Edit as a copy"
 * fork) and is not an analysis set — analysis sets (``analysis-*``) edit
 * via the import re-analyse flow, not the lesson editor.
 *
 * @example
 * if (isOwnEditableSet(source, setId)) showMentorAffordances();
 */

import {USER_GENERATED_SOURCE} from "../../storage/types";

/** True when the set is user-generated and editable in the lesson editor. */
export function isOwnEditableSet(source: string, setId: string): boolean {
    return source === USER_GENERATED_SOURCE && !setId.startsWith("analysis-");
}
