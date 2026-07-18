/**
 * Card editor — Step 2 of the Lesson Creator (Phase 65B / EXP-021).
 *
 * Add / edit / delete / reorder vocabulary cards plus a paste-friendly
 * CSV bulk import. Reorder uses @dnd-kit (the same pointer+keyboard
 * sortable pattern as Word Tiles, v1.47.0). The parent owns the card
 * array; this component is presentational + emits intent callbacks.
 */

import {useRef, useState} from "react";
import {GripVertical, Pencil, Plus, Trash2} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";

import {useDialogFocus} from "../../hooks/ui/useDialogFocus";
import {CARD_SIDE_MAX_LENGTH} from "../../lib/content/lesson/draft-to-lesson";
import {useI18n} from "../../hooks/ui/useI18n";
import FormHint from "../../shared/forms/FormHint";
import StringListEditor from "../../shared/forms/StringListEditor";
import CardImageField from "./CardImageField";
import {parseCsvCards, type ParsedCsvRow} from "../../lib/content/lesson/csv-cards";
import type {LessonCardDraft} from "../../lib/content/lesson/lesson-draft";

export const MIN_CARDS = 4;

export interface CardEditorProps {
    cards: LessonCardDraft[];
    onAdd: (card: {
        front: string;
        back: string;
        notes: string;
        image: string;
        altAnswers: string[];
    }) => void;
    onUpdate: (id: string, patch: Partial<LessonCardDraft>) => void;
    onDelete: (id: string) => void;
    onReorder: (cards: LessonCardDraft[]) => void;
    onClearAll: () => void;
    onImport: (rows: {front: string; back: string; notes: string}[]) => void;
}

export default function CardEditor({
    cards,
    onAdd,
    onUpdate,
    onDelete,
    onReorder,
    onClearAll,
    onImport,
}: CardEditorProps) {
    const {t} = useI18n();
    const [front, setFront] = useState("");
    const [back, setBack] = useState("");
    const [notes, setNotes] = useState("");
    const [image, setImage] = useState("");
    const [altAnswers, setAltAnswers] = useState<string[]>([]);
    const [showCsv, setShowCsv] = useState(false);
    const [csvText, setCsvText] = useState("");
    const [confirmClear, setConfirmClear] = useState(false);
    const confirmClearRef = useRef<HTMLDivElement>(null);

    // WCAG 2.1.2 / 2.4.3: initial focus, focus trap, focus return for
    // the "remove all cards" confirm dialog.
    useDialogFocus(confirmClearRef, {open: confirmClear});

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const canAdd = front.trim().length > 0 && back.trim().length > 0;

    function handleAdd() {
        if (!canAdd) return;
        onAdd({
            front: front.trim(),
            back: back.trim(),
            notes: notes.trim(),
            image: image.trim(),
            altAnswers,
        });
        setFront("");
        setBack("");
        setNotes("");
        setImage("");
        setAltAnswers([]);
    }

    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = cards.findIndex((c) => c.id === active.id);
        const newIndex = cards.findIndex((c) => c.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onReorder(arrayMove(cards, oldIndex, newIndex));
    }

    const parsed: ParsedCsvRow[] = csvText.trim() ? parseCsvCards(csvText) : [];
    const validParsed = parsed.filter((r) => r.valid);

    function handleCsvFile(file: File) {
        const reader = new FileReader();
        reader.onload = () => setCsvText(String(reader.result ?? ""));
        reader.readAsText(file);
    }

    function handleImport() {
        if (validParsed.length === 0) return;
        onImport(
            validParsed.map((r) => ({
                front: r.front,
                back: r.back,
                notes: r.notes,
            })),
        );
        setCsvText("");
        setShowCsv(false);
    }

    return (
        <section
            className="create-lesson-step flex flex-col gap-6"
            data-testid="create-lesson-step-2"
            aria-label={t("create_lesson.cards.heading", "Add vocabulary cards")}
        >
            <h2 className="text-xl font-semibold text-fg-primary">
                {t("create_lesson.cards.heading", "Add vocabulary cards")}
            </h2>

            {/* Entry form */}
            <div
                className="card-editor-form flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
                data-testid="card-editor-form"
            >
                <div className="form-row form-row-inline grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t("create_lesson.cards.front_label", "Front (learned)")} *
                        </span>
                        <Input
                            type="text"
                            data-testid="card-front-input"
                            value={front}
                            maxLength={CARD_SIDE_MAX_LENGTH}
                            placeholder="Bonjour"
                            onChange={(e) => setFront(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && canAdd) handleAdd();
                            }}
                        />
                    </label>
                    <label className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t("create_lesson.cards.back_label", "Back (your language)")} *
                        </span>
                        <Input
                            type="text"
                            data-testid="card-back-input"
                            value={back}
                            maxLength={CARD_SIDE_MAX_LENGTH}
                            placeholder="Guten Tag"
                            onChange={(e) => setBack(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && canAdd) handleAdd();
                            }}
                        />
                    </label>
                </div>
                <label className="form-row">
                    <span className="form-label">
                        {t("create_lesson.cards.notes_label", "Notes (optional)")}
                    </span>
                    <Input
                        type="text"
                        data-testid="card-notes-input"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </label>
                <div className="form-row">
                    <StringListEditor
                        values={altAnswers}
                        onChange={setAltAnswers}
                        label={t(
                            "create_lesson.cards.alt_answers_label",
                            "Other accepted answers (optional)",
                        )}
                        addButtonLabel={t("create_lesson.cards.alt_answers_add", "Add")}
                        removeItemLabel={t(
                            "create_lesson.cards.alt_answers_remove",
                            "Remove accepted answer",
                        )}
                        placeholder={t(
                            "create_lesson.cards.alt_answers_placeholder",
                            "Another accepted answer",
                        )}
                        maxLength={CARD_SIDE_MAX_LENGTH}
                        testIdPrefix="card-alt-answers"
                    />
                    <FormHint>
                        {t(
                            "create_lesson.cards.alt_answers_hint",
                            "Extra answers the learner may type for the free-text exercise. The Back field stays the main answer.",
                        )}
                    </FormHint>
                </div>
                <div className="form-row">
                    <CardImageField
                        value={image}
                        onChange={setImage}
                        previewAlt={front.trim() || undefined}
                        idPrefix="card"
                    />
                </div>
                <div className="form-actions">
                    <Button
                        type="button"
                        data-testid="card-add-button"
                        onClick={handleAdd}
                        disabled={!canAdd}
                    >
                        <Plus size={14} aria-hidden="true" />
                        {t("create_lesson.cards.add", "Add card")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        data-testid="card-csv-toggle"
                        onClick={() => setShowCsv((v) => !v)}
                    >
                        {t("create_lesson.cards.import_csv", "Import CSV")}
                    </Button>
                </div>
            </div>

            {/* CSV import */}
            {showCsv && (
                <div
                    className="card-editor-csv flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
                    data-testid="card-csv-panel"
                >
                    <FormHint>
                        {t(
                            "create_lesson.cards.csv_hint",
                            "Paste rows as front, back, notes (comma- or tab-separated). Example: Bonjour, Guten Tag, Formal greeting",
                        )}
                    </FormHint>
                    <textarea
                        data-testid="card-csv-textarea"
                        rows={5}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                    />
                    <input
                        type="file"
                        accept=".csv,.tsv,.txt"
                        data-testid="card-csv-file"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleCsvFile(f);
                        }}
                    />
                    {parsed.length > 0 && (
                        <div
                            className="card-csv-preview flex flex-col gap-2"
                            data-testid="card-csv-preview"
                        >
                            <FormHint>
                                {t(
                                    "create_lesson.cards.csv_preview",
                                    "{valid} of {total} rows ready",
                                )
                                    .replace("{valid}", String(validParsed.length))
                                    .replace("{total}", String(parsed.length))}
                            </FormHint>
                            <ul className="card-csv-preview-list flex list-none flex-col gap-1 p-0">
                                {parsed.map((r, i) => (
                                    <li
                                        key={i}
                                        className={
                                            "card-csv-row grid grid-cols-3 items-center gap-2 rounded-md border border-border bg-bg-elevated px-2 py-1 text-sm" +
                                            (r.valid
                                                ? ""
                                                : " is-invalid border-[var(--error)]")
                                        }
                                        data-testid={`card-csv-row-${i}`}
                                        data-valid={r.valid ? "true" : "false"}
                                    >
                                        <span className="truncate">{r.front || "—"}</span>
                                        <span className="truncate">{r.back || "—"}</span>
                                        <span className="muted truncate text-fg-muted">{r.notes}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button
                                type="button"
                                data-testid="card-csv-import"
                                onClick={handleImport}
                                disabled={validParsed.length === 0}
                            >
                                {t(
                                    "create_lesson.cards.csv_add",
                                    "Add {n} cards",
                                ).replace("{n}", String(validParsed.length))}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Count + minimum */}
            <div className="card-editor-count flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-fg-primary" data-testid="card-count">
                    {t("create_lesson.cards.count", "{n} cards").replace(
                        "{n}",
                        String(cards.length),
                    )}
                </span>
                {cards.length < MIN_CARDS && (
                    <FormHint
                        as="span"
                        variant="warning"
                        data-testid="card-min-hint"
                    >
                        {t(
                            "create_lesson.cards.min_hint",
                            "{n} cards needed for exercises",
                        ).replace("{n}", String(MIN_CARDS))}
                    </FormHint>
                )}
                {cards.length > 0 && (
                    <Button
                        type="button"
                        variant="link"
                        data-testid="card-clear-all"
                        onClick={() => setConfirmClear(true)}
                    >
                        {t("create_lesson.cards.clear_all", "Clear all")}
                    </Button>
                )}
            </div>

            {/* Card list (sortable) */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={cards.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ul className="card-editor-list flex list-none flex-col gap-2 p-0" data-testid="card-list">
                        {cards.map((card) => (
                            <SortableCardRow
                                key={card.id}
                                card={card}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>

            {confirmClear && (
                <div
                    className="modal-overlay"
                    data-testid="card-clear-confirm"
                >
                    <div
                        ref={confirmClearRef}
                        className="modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="card-clear-confirm-title"
                    >
                        <h2 id="card-clear-confirm-title" className="modal-title">
                            {t(
                                "create_lesson.cards.clear_confirm_title",
                                "Remove all cards?",
                            )}
                        </h2>
                        <div className="form-actions">
                            <Button
                                type="button"
                                variant="secondary"
                                data-testid="card-clear-cancel"
                                onClick={() => setConfirmClear(false)}
                            >
                                {t("create_lesson.cancel", "Cancel")}
                            </Button>
                            <Button
                                type="button"
                                data-testid="card-clear-confirm-ok"
                                onClick={() => {
                                    onClearAll();
                                    setConfirmClear(false);
                                }}
                            >
                                {t(
                                    "create_lesson.cards.clear_all",
                                    "Clear all",
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

interface SortableCardRowProps {
    card: LessonCardDraft;
    onUpdate: (id: string, patch: Partial<LessonCardDraft>) => void;
    onDelete: (id: string) => void;
}

function SortableCardRow({card, onUpdate, onDelete}: SortableCardRowProps) {
    const {t} = useI18n();
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
        useSortable({id: card.id});
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(card);

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };

    // #1722 — gate Save exactly like Add: an empty front/back would pass
    // the Step-4 count checks but fail the ajv structure check
    // (minLength: 1) with no visible reason.
    const canSaveEdit =
        draft.front.trim().length > 0 && draft.back.trim().length > 0;

    function saveEdit() {
        if (!canSaveEdit) return;
        onUpdate(card.id, {
            front: draft.front.trim(),
            back: draft.back.trim(),
            notes: draft.notes.trim(),
            image: draft.image.trim(),
            altAnswers: draft.altAnswers ?? [],
        });
        setEditing(false);
    }

    if (editing) {
        return (
            <li
                ref={setNodeRef}
                style={style}
                className="card-row is-editing flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
                data-testid={`card-row-${card.id}`}
            >
                <div className="form-row form-row-inline grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        type="text"
                        data-testid={`card-edit-front-${card.id}`}
                        value={draft.front}
                        maxLength={CARD_SIDE_MAX_LENGTH}
                        onChange={(e) =>
                            setDraft({...draft, front: e.target.value})
                        }
                    />
                    <Input
                        type="text"
                        data-testid={`card-edit-back-${card.id}`}
                        value={draft.back}
                        maxLength={CARD_SIDE_MAX_LENGTH}
                        onChange={(e) =>
                            setDraft({...draft, back: e.target.value})
                        }
                    />
                </div>
                <Input
                    type="text"
                    data-testid={`card-edit-notes-${card.id}`}
                    value={draft.notes}
                    onChange={(e) =>
                        setDraft({...draft, notes: e.target.value})
                    }
                />
                <StringListEditor
                    values={draft.altAnswers ?? []}
                    onChange={(next) => setDraft({...draft, altAnswers: next})}
                    label={t(
                        "create_lesson.cards.alt_answers_label",
                        "Other accepted answers (optional)",
                    )}
                    addButtonLabel={t("create_lesson.cards.alt_answers_add", "Add")}
                    removeItemLabel={t(
                        "create_lesson.cards.alt_answers_remove",
                        "Remove accepted answer",
                    )}
                    placeholder={t(
                        "create_lesson.cards.alt_answers_placeholder",
                        "Another accepted answer",
                    )}
                    maxLength={CARD_SIDE_MAX_LENGTH}
                    testIdPrefix={`card-edit-alt-answers-${card.id}`}
                />
                <CardImageField
                    value={draft.image}
                    onChange={(v) => setDraft({...draft, image: v})}
                    previewAlt={draft.front.trim() || undefined}
                    idPrefix={`card-edit-${card.id}`}
                />
                <div className="form-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        data-testid={`card-edit-cancel-${card.id}`}
                        onClick={() => {
                            setDraft(card);
                            setEditing(false);
                        }}
                    >
                        {t("create_lesson.cancel", "Cancel")}
                    </Button>
                    <Button
                        type="button"
                        data-testid={`card-edit-save-${card.id}`}
                        disabled={!canSaveEdit}
                        onClick={saveEdit}
                    >
                        {t("create_lesson.cards.save_edit", "Save")}
                    </Button>
                </div>
            </li>
        );
    }

    return (
        <li
            ref={setNodeRef}
            style={style}
            className="card-row flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            data-testid={`card-row-${card.id}`}
        >
            <button
                type="button"
                className="card-row-handle flex shrink-0 cursor-grab items-center text-fg-muted"
                aria-label={t("create_lesson.cards.drag", "Drag to reorder")}
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} aria-hidden="true" />
            </button>
            <span className="card-row-front min-w-0 flex-1 truncate font-medium text-fg-primary">{card.front}</span>
            <span className="card-row-back min-w-0 flex-1 truncate text-fg-secondary">
                {card.back}
                {(card.altAnswers?.length ?? 0) > 0 && (
                    <span
                        className="ml-1.5 rounded-sm bg-bg-elevated px-1 text-xs text-fg-muted"
                        data-testid={`card-alt-count-${card.id}`}
                        title={t(
                            "create_lesson.cards.alt_answers_label",
                            "Other accepted answers (optional)",
                        )}
                    >
                        +{card.altAnswers?.length}
                    </span>
                )}
            </span>
            <span className="card-row-notes muted hidden min-w-0 flex-1 truncate text-sm text-fg-muted md:block">{card.notes}</span>
            <button
                type="button"
                className="card-row-action flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                data-testid={`card-edit-${card.id}`}
                aria-label={t("create_lesson.cards.edit", "Edit card")}
                onClick={() => {
                    setDraft(card);
                    setEditing(true);
                }}
            >
                <Pencil size={14} aria-hidden="true" />
            </button>
            <button
                type="button"
                className="card-row-action flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                data-testid={`card-delete-${card.id}`}
                aria-label={t("create_lesson.cards.delete", "Delete card")}
                onClick={() => onDelete(card.id)}
            >
                <Trash2 size={14} aria-hidden="true" />
            </button>
        </li>
    );
}
