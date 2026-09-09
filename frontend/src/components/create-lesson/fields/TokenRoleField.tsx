/**
 * TokenRoleField (#3072, EXP-021) - annotate individual tokens of a card's
 * ``front`` with their grammatical role.
 *
 * ``Card.token_roles`` shipped in v1.35.0 (Phase 52I / P-130) as schema
 * plus readers; nothing ever wrote it, so the cloze generator's
 * highest-fidelity path never fired. This is the authoring surface.
 *
 * Two schema constraints shape the UI rather than merely being documented
 * in it:
 *
 *  - ``token`` is a VERBATIM slice of ``front``. A row whose token is not
 *    a literal substring is marked invalid and cannot be added, because
 *    the generator matches on that substring at read time - storing it
 *    would create a silently inert annotation.
 *  - ``role`` is a CLOSED enum of seven values, so the control is a select
 *    over exactly those, never free text. The schema calls the closedness
 *    deliberate: an open enum would let a typo pass as a role and the
 *    generator would skip it without warning.
 *
 * The suggestion button proposes only closed word classes (article,
 * preposition) and says so in its hint - see ``token-role-suggest``. It
 * fills the list; it never saves on its own.
 *
 * Presentational + props-driven: the parent owns the card draft.
 *
 * @example
 * <TokenRoleField
 *     front={draft.front}
 *     lang={sourceLanguage}
 *     value={draft.token_roles ?? []}
 *     onChange={(token_roles) => patch({token_roles})}
 *     idPrefix={`card-${draft.id}`}
 * />
 */

import {useState} from "react";
import {Plus, Trash2, Wand2} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useI18n} from "../../../hooks/ui/useI18n";
import FormHint from "../../../shared/forms/FormHint";
import {
    isVerbatimSlice,
    MAX_TOKEN_ROLES,
    suggestTokenRoles,
} from "../../../lib/ai/suggest/token-role-suggest";
import type {
    ContentLessonCardTokenRole,
    ContentLessonCardTokenRoleName,
} from "../../../storage/types";

/** The schema's closed TokenRole enum, in authoring order. */
const ROLES: readonly ContentLessonCardTokenRoleName[] = [
    "article",
    "noun",
    "verb",
    "adjective",
    "preposition",
    "gender_marker",
    "tense_marker",
];

const ROLE_FALLBACK: Record<ContentLessonCardTokenRoleName, string> = {
    article: "Article",
    noun: "Noun",
    verb: "Verb",
    adjective: "Adjective",
    preposition: "Preposition",
    gender_marker: "Gender marker",
    tense_marker: "Tense marker",
};

export interface TokenRoleFieldProps {
    /** The card's front; tokens must be verbatim slices of it. */
    front: string;
    /** Language of the front, for the suggestion lookup. */
    lang: string;
    value: readonly ContentLessonCardTokenRole[];
    onChange: (next: ContentLessonCardTokenRole[]) => void;
    /** Testid prefix of the owning row; the field appends ``-token-role*``. */
    idPrefix: string;
}

export default function TokenRoleField({
    front,
    lang,
    value,
    onChange,
    idPrefix,
}: TokenRoleFieldProps) {
    const {t} = useI18n();
    const [token, setToken] = useState("");
    const [role, setRole] = useState<ContentLessonCardTokenRoleName>("article");
    const [suggestedNothing, setSuggestedNothing] = useState(false);

    const full = value.length >= MAX_TOKEN_ROLES;
    const trimmed = token.trim();
    const duplicate = value.some((r) => r.token === trimmed);
    const notInFront = trimmed.length > 0 && !isVerbatimSlice(trimmed, front);
    const canAdd = trimmed.length > 0 && !duplicate && !notInFront && !full;

    const error = notInFront
        ? t(
              "create_lesson.cards.token_roles.error.not_in_front",
              '"{token}" does not appear in the front exactly like that.',
          ).replace("{token}", trimmed)
        : duplicate
          ? t(
                "create_lesson.cards.token_roles.error.duplicate",
                '"{token}" is already annotated.',
            ).replace("{token}", trimmed)
          : full
            ? t(
                  "create_lesson.cards.token_roles.error.max_reached",
                  "A card cannot carry more than {max} roles.",
              ).replace("{max}", String(MAX_TOKEN_ROLES))
            : null;

    function add() {
        if (!canAdd) return;
        onChange([...value, {token: trimmed, role}]);
        setToken("");
    }

    function removeAt(index: number) {
        onChange(value.filter((_, i) => i !== index));
    }

    function suggest() {
        const proposals = suggestTokenRoles(front, lang).filter(
            (s) => !value.some((r) => r.token === s.token),
        );
        setSuggestedNothing(proposals.length === 0);
        if (proposals.length === 0) return;
        onChange([...value, ...proposals].slice(0, MAX_TOKEN_ROLES));
    }

    return (
        <div className="flex flex-col gap-2" data-testid={`${idPrefix}-token-roles`}>
            <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-fg-primary">
                    {t("create_lesson.cards.token_roles.label", "Token roles (optional)")}
                </label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={suggest}
                    disabled={!front.trim() || full}
                    data-testid={`${idPrefix}-token-roles-suggest`}
                >
                    <Wand2 aria-hidden="true" className="mr-1 h-4 w-4" />
                    {t("create_lesson.cards.token_roles.suggest", "Suggest roles")}
                </Button>
            </div>

            <FormHint>
                {t(
                    "create_lesson.cards.token_roles.hint",
                    "Mark individual words of the front with their grammatical role.",
                )}
            </FormHint>

            {value.length > 0 && (
                <ul className="flex flex-col gap-1">
                    {value.map((entry, index) => (
                        <li
                            key={`${entry.token}-${entry.role}`}
                            className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1"
                            data-testid={`${idPrefix}-token-role-row`}
                        >
                            <code className="text-sm text-fg-primary">{entry.token}</code>
                            <span className="text-sm text-fg-muted">
                                {t(
                                    `create_lesson.cards.token_roles.role.${entry.role}`,
                                    ROLE_FALLBACK[entry.role],
                                )}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="ml-auto"
                                onClick={() => removeAt(index)}
                                aria-label={t(
                                    "create_lesson.cards.token_roles.remove",
                                    "Remove role",
                                )}
                                data-testid={`${idPrefix}-token-role-remove`}
                            >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex items-start gap-2">
                <Input
                    value={token}
                    onChange={(e) => {
                        setToken(e.target.value);
                        setSuggestedNothing(false);
                    }}
                    placeholder={t(
                        "create_lesson.cards.token_roles.token_placeholder",
                        "Word from the front",
                    )}
                    disabled={full}
                    aria-invalid={notInFront || duplicate}
                    data-testid={`${idPrefix}-token-role-token`}
                />
                <select
                    className="h-9 rounded-md border border-border bg-card px-2 text-sm text-fg-primary"
                    value={role}
                    onChange={(e) =>
                        setRole(e.target.value as ContentLessonCardTokenRoleName)
                    }
                    disabled={full}
                    aria-label={t("create_lesson.cards.token_roles.role_label", "Role")}
                    data-testid={`${idPrefix}-token-role-select`}
                >
                    {ROLES.map((r) => (
                        <option key={r} value={r}>
                            {t(
                                `create_lesson.cards.token_roles.role.${r}`,
                                ROLE_FALLBACK[r],
                            )}
                        </option>
                    ))}
                </select>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={add}
                    disabled={!canAdd}
                    data-testid={`${idPrefix}-token-role-add`}
                >
                    <Plus aria-hidden="true" className="mr-1 h-4 w-4" />
                    {t("create_lesson.cards.token_roles.add", "Add role")}
                </Button>
            </div>

            {error && (
                <p
                    className="text-sm text-danger"
                    role="alert"
                    data-testid={`${idPrefix}-token-role-error`}
                >
                    {error}
                </p>
            )}

            {suggestedNothing && (
                <p
                    className="text-sm text-fg-muted"
                    data-testid={`${idPrefix}-token-role-suggest-none`}
                >
                    {t(
                        "create_lesson.cards.token_roles.suggest_none",
                        "No word recognised. Enter the roles by hand.",
                    )}
                </p>
            )}

            {value.length > 0 && (
                <p className="text-xs text-fg-muted">
                    {t("create_lesson.cards.token_roles.count", "{n} of {max} roles")
                        .replace("{n}", String(value.length))
                        .replace("{max}", String(MAX_TOKEN_ROLES))}
                    {" · "}
                    {t(
                        "create_lesson.cards.token_roles.suggest_hint",
                        "Suggestions are guesses. Check every row before you save.",
                    )}
                </p>
            )}
        </div>
    );
}
