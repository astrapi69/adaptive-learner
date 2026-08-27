/**
 * LessonEditLink — mentor-mode Phase 1 (#2766, umbrella #2765).
 *
 * Options-panel entry that jumps from the running lesson straight into
 * the editor's edit route (``/create-lesson/edit/:source/:setId?lesson=``,
 * the #1740/#2210 deep link), so the author can fix a typo or an unclear
 * exercise they just stumbled over. Edits go through the editor's proven
 * write path (edit-remap, #2566) — the runner itself never mutates the
 * lesson.
 *
 * Self-gating: renders only for the learner's OWN editable sets
 * (``USER_GENERATED_SOURCE`` — created, imported, or "Edit as a copy"
 * forks). Analysis sets (``analysis-*``) edit via the import re-analyse
 * flow and downloaded sets via the content browser's "Edit as a copy",
 * so both render nothing here (tracked on #2765).
 *
 * @example
 * <LessonEditLink source={source} setId={setId} filename={filename} />
 */

import {Pencil} from "lucide-react";
import {Link} from "react-router";

import {Button} from "@/components/ui/button";
import {USER_GENERATED_SOURCE} from "../../../storage/types";
import {useI18n} from "../../../hooks/ui/useI18n";

export interface LessonEditLinkProps {
    /** Content source of the running lesson's set. */
    source: string;
    /** Set id of the running lesson. */
    setId: string;
    /** Lesson filename inside the set (e.g. ``01.json``). */
    filename: string;
}

/**
 * Render the "Edit this lesson in the editor" deep link, or nothing when
 * the running lesson is not the learner's own editable content.
 *
 * @param props - See {@link LessonEditLinkProps}.
 */
export default function LessonEditLink({
    source,
    setId,
    filename,
}: LessonEditLinkProps) {
    const {t} = useI18n();
    const editable =
        source === USER_GENERATED_SOURCE && !setId.startsWith("analysis-");
    if (!editable) return null;

    const href =
        `/create-lesson/edit/${encodeURIComponent(source)}/` +
        `${encodeURIComponent(setId)}?lesson=${encodeURIComponent(filename)}`;

    return (
        <Button asChild variant="outline" size="sm" className="justify-start">
            <Link to={href} data-testid="lesson-edit-in-editor">
                <Pencil aria-hidden="true" />
                {t("lesson.options.edit_in_editor", "Edit this lesson in the editor")}
            </Link>
        </Button>
    );
}
