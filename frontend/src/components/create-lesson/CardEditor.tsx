/**
 * Card editor — Step 2 of the Lesson Creator (Phase 65B / EXP-021).
 *
 * Add / edit / delete / reorder vocabulary cards plus a paste-friendly
 * CSV bulk import. Reorder uses @dnd-kit (the same pointer+keyboard
 * sortable pattern as Word Tiles, v1.47.0). The parent owns the card
 * array; this component is presentational + emits intent callbacks.
 */

import {useState} from "react";
import {GripVertical, Pencil, Plus, Trash2} from "lucide-react";

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

import {useI18n} from "../../hooks/useI18n";
import {parseCsvCards, type ParsedCsvRow} from "../../lib/content/csv-cards";
import type {LessonCardDraft} from "../../lib/content/lesson-draft";

export const MIN_CARDS = 4;

export interface CardEditorProps {
    cards: LessonCardDraft[];
    onAdd: (card: {front: string; back: string; notes: string; image: string}) => void;
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
    const [showCsv, setShowCsv] = useState(false);
    const [csvText, setCsvText] = useState("");
    const [confirmClear, setConfirmClear] = useState(false);

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
        });
        setFront("");
        setBack("");
        setNotes("");
        setImage("");
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
            className="create-lesson-step"
            data-testid="create-lesson-step-2"
            aria-label={t("create_lesson.cards.heading", "Add vocabulary cards")}
        >
            <h2>{t("create_lesson.cards.heading", "Add vocabulary cards")}</h2>

            {/* Entry form */}
            <div className="card-editor-form" data-testid="card-editor-form">
                <div className="form-row form-row-inline">
                    <label className="form-field">
                        <span className="form-label">
                            {t("create_lesson.cards.front_label", "Front (learned)")} *
                        </span>
                        <Input
                            type="text"
                            data-testid="card-front-input"
                            value={front}
                            placeholder="Bonjour"
                            onChange={(e) => setFront(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && canAdd) handleAdd();
                            }}
                        />
                    </label>
                    <label className="form-field">
                        <span className="form-label">
                            {t("create_lesson.cards.back_label", "Back (your language)")} *
                        </span>
                        <Input
                            type="text"
                            data-testid="card-back-input"
                            value={back}
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
                <label className="form-row">
                    <span className="form-label">
                        {t("create_lesson.cards.image_label", "Image reference (optional)")}
                    </span>
                    <Input
                        type="text"
                        data-testid="card-image-input"
                        value={image}
                        placeholder="img/bonjour.png"
                        onChange={(e) => setImage(e.target.value)}
                    />
                </label>
                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-primary"
                        data-testid="card-add-button"
                        onClick={handleAdd}
                        disabled={!canAdd}
                    >
                        <Plus size={14} aria-hidden="true" />
                        {t("create_lesson.cards.add", "Add card")}
                    </button>
                    <button
                        type="button"
                        className="btn"
                        data-testid="card-csv-toggle"
                        onClick={() => setShowCsv((v) => !v)}
                    >
                        {t("create_lesson.cards.import_csv", "Import CSV")}
                    </button>
                </div>
            </div>

            {/* CSV import */}
            {showCsv && (
                <div className="card-editor-csv" data-testid="card-csv-panel">
                    <p className="form-hint">
                        {t(
                            "create_lesson.cards.csv_hint",
                            "Paste rows as front, back, notes (comma- or tab-separated). Example: Bonjour, Guten Tag, Formal greeting",
                        )}
                    </p>
                    <textarea
                        data-testid="card-csv-textarea"
                        rows={5}
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
                            className="card-csv-preview"
                            data-testid="card-csv-preview"
                        >
                            <p className="form-hint">
                                {t(
                                    "create_lesson.cards.csv_preview",
                                    "{valid} of {total} rows ready",
                                )
                                    .replace("{valid}", String(validParsed.length))
                                    .replace("{total}", String(parsed.length))}
                            </p>
                            <ul className="card-csv-preview-list">
                                {parsed.map((r, i) => (
                                    <li
                                        key={i}
                                        className={
                                            r.valid
                                                ? "card-csv-row"
                                                : "card-csv-row is-invalid"
                                        }
                                        data-testid={`card-csv-row-${i}`}
                                        data-valid={r.valid ? "true" : "false"}
                                    >
                                        <span>{r.front || "—"}</span>
                                        <span>{r.back || "—"}</span>
                                        <span className="muted">{r.notes}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                type="button"
                                className="btn btn-primary"
                                data-testid="card-csv-import"
                                onClick={handleImport}
                                disabled={validParsed.length === 0}
                            >
                                {t(
                                    "create_lesson.cards.csv_add",
                                    "Add {n} cards",
                                ).replace("{n}", String(validParsed.length))}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Count + minimum */}
            <div className="card-editor-count">
                <span data-testid="card-count">
                    {t("create_lesson.cards.count", "{n} cards").replace(
                        "{n}",
                        String(cards.length),
                    )}
                </span>
                {cards.length < MIN_CARDS && (
                    <span
                        className="form-hint form-hint-warning"
                        data-testid="card-min-hint"
                    >
                        {t(
                            "create_lesson.cards.min_hint",
                            "{n} cards needed for exercises",
                        ).replace("{n}", String(MIN_CARDS))}
                    </span>
                )}
                {cards.length > 0 && (
                    <button
                        type="button"
                        className="lesson-summary-link"
                        data-testid="card-clear-all"
                        onClick={() => setConfirmClear(true)}
                    >
                        {t("create_lesson.cards.clear_all", "Clear all")}
                    </button>
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
                    <ul className="card-editor-list" data-testid="card-list">
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
                    <div className="modal-card" role="dialog" aria-modal="true">
                        <h2 className="modal-title">
                            {t(
                                "create_lesson.cards.clear_confirm_title",
                                "Remove all cards?",
                            )}
                        </h2>
                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                data-testid="card-clear-cancel"
                                onClick={() => setConfirmClear(false)}
                            >
                                {t("create_lesson.cancel", "Cancel")}
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
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
                            </button>
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

    function saveEdit() {
        onUpdate(card.id, {
            front: draft.front.trim(),
            back: draft.back.trim(),
            notes: draft.notes.trim(),
            image: draft.image.trim(),
        });
        setEditing(false);
    }

    if (editing) {
        return (
            <li
                ref={setNodeRef}
                style={style}
                className="card-row is-editing"
                data-testid={`card-row-${card.id}`}
            >
                <div className="form-row form-row-inline">
                    <Input
                        type="text"
                        data-testid={`card-edit-front-${card.id}`}
                        value={draft.front}
                        onChange={(e) =>
                            setDraft({...draft, front: e.target.value})
                        }
                    />
                    <Input
                        type="text"
                        data-testid={`card-edit-back-${card.id}`}
                        value={draft.back}
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
                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        data-testid={`card-edit-cancel-${card.id}`}
                        onClick={() => {
                            setDraft(card);
                            setEditing(false);
                        }}
                    >
                        {t("create_lesson.cancel", "Cancel")}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        data-testid={`card-edit-save-${card.id}`}
                        onClick={saveEdit}
                    >
                        {t("create_lesson.cards.save_edit", "Save")}
                    </button>
                </div>
            </li>
        );
    }

    return (
        <li
            ref={setNodeRef}
            style={style}
            className="card-row"
            data-testid={`card-row-${card.id}`}
        >
            <button
                type="button"
                className="card-row-handle"
                aria-label={t("create_lesson.cards.drag", "Drag to reorder")}
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} aria-hidden="true" />
            </button>
            <span className="card-row-front">{card.front}</span>
            <span className="card-row-back">{card.back}</span>
            <span className="card-row-notes muted">{card.notes}</span>
            <button
                type="button"
                className="card-row-action"
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
                className="card-row-action"
                data-testid={`card-delete-${card.id}`}
                aria-label={t("create_lesson.cards.delete", "Delete card")}
                onClick={() => onDelete(card.id)}
            >
                <Trash2 size={14} aria-hidden="true" />
            </button>
        </li>
    );
}
