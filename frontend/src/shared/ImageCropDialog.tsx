/**
 * ImageCropDialog — interactive, dependency-free image crop (#558).
 *
 * A self-contained modal that lets the user position and zoom an image
 * inside a fixed square viewport, then renders the framed region to a
 * square ``outputSize`` JPEG Blob on confirm. Built on plain Canvas +
 * Pointer Events (drag/pan + pinch) + wheel (desktop zoom) — no
 * cropper library. The minimum zoom always covers the crop area, so no
 * empty border can ever be framed; the maximum is ``maxZoom`` x that.
 *
 * Presentational + props-driven (reusability policy): every label is a
 * prop with an English default, so it is app-agnostic and i18n-friendly.
 * The crop runs entirely client-side; there is no storage impact, so it
 * works identically in both storage modes.
 *
 * @example
 * const [file, setFile] = useState<File | null>(null);
 * // ...after the user picks `picked`:
 * setFile(picked);
 * return file ? (
 *   <ImageCropDialog
 *     image={file}
 *     outputSize={256}
 *     shape="circle"
 *     title={t("settings.avatar_crop_title", "Adjust your picture")}
 *     confirmLabel={t("settings.avatar_crop_apply", "Apply")}
 *     cancelLabel={t("settings.avatar_crop_cancel", "Cancel")}
 *     onConfirm={(blob) => { setFile(null); save(blob); }}
 *     onCancel={() => setFile(null)}
 *   />
 * ) : null;
 */

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { useDialogFocus } from "../hooks/useDialogFocus";
import {
  centeredOffset,
  clampOffset,
  clampScale,
  coverScale,
  cropToBlob,
  loadImageFromBlob,
  sourceRect,
  type Offset,
} from "../lib/avatar/crop-image";

/** Display size of the square crop viewport, in CSS px. Kept small
 *  enough to fit a 320px phone inside the dialog padding. */
const VIEWPORT = 224;

export interface ImageCropDialogProps {
  /** The image to crop. */
  image: Blob;
  /** Receives the cropped square JPEG Blob on confirm. */
  onConfirm: (croppedBlob: Blob) => void;
  /** Called on cancel / Escape — nothing is changed. */
  onCancel: () => void;
  /** Output square edge in px. Defaults to 256. */
  outputSize?: number;
  /** Crop guide shape. ``"circle"`` dims the corners; output is always
   *  a square Blob (a circular avatar is rounded by the consumer). */
  shape?: "circle" | "square";
  /** Maximum zoom as a multiple of the cover (min) zoom. Defaults to 3. */
  maxZoom?: number;
  title?: string;
  instructions?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  zoomLabel?: string;
  testId?: string;
}

interface View {
  scale: number;
  offset: Offset;
}

interface Natural {
  width: number;
  height: number;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function ImageCropDialog({
  image,
  onConfirm,
  onCancel,
  outputSize = 256,
  shape = "circle",
  maxZoom = 3,
  title = "Adjust your picture",
  instructions = "Drag to reposition, scroll or pinch to zoom.",
  confirmLabel = "Apply",
  cancelLabel = "Cancel",
  zoomLabel = "Zoom",
  testId = "image-crop-dialog",
}: ImageCropDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ startDistance: number; startScale: number } | null>(null);

  const [natural, setNatural] = useState<Natural | null>(null);
  const [view, setView] = useState<View>({ scale: 1, offset: { x: 0, y: 0 } });
  const [busy, setBusy] = useState(false);

  useDialogFocus(dialogRef, { open: true });

  // Decode the blob, then frame it at the cover (min) zoom, centered.
  useEffect(() => {
    let cancelled = false;
    void loadImageFromBlob(image)
      .then((img) => {
        if (cancelled) return;
        imageRef.current = img;
        const width = img.naturalWidth || 1;
        const height = img.naturalHeight || 1;
        const scale = coverScale(width, height, VIEWPORT);
        setNatural({ width, height });
        setView({
          scale,
          offset: centeredOffset(width, height, scale, VIEWPORT),
        });
      })
      .catch(() => {
        if (!cancelled) onCancel();
      });
    return () => {
      cancelled = true;
    };
  }, [image, onCancel]);

  // Escape closes (cancel).
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const minScale = natural ? coverScale(natural.width, natural.height, VIEWPORT) : 1;

  function panBy(dx: number, dy: number): void {
    if (!natural) return;
    setView((prev) => ({
      scale: prev.scale,
      offset: clampOffset(
        { x: prev.offset.x + dx, y: prev.offset.y + dy },
        natural.width,
        natural.height,
        prev.scale,
        VIEWPORT,
      ),
    }));
  }

  /** Zoom to a target scale (or `prev * factor`), keeping the viewport
   *  centre fixed, then re-clamp the offset so no gap appears. */
  function zoom(next: number | ((prevScale: number) => number)): void {
    if (!natural) return;
    setView((prev) => {
      const raw = typeof next === "function" ? next(prev.scale) : next;
      const scale = clampScale(raw, minScale, maxZoom);
      if (scale === prev.scale) return prev;
      const centre = VIEWPORT / 2;
      const imageX = (centre - prev.offset.x) / prev.scale;
      const imageY = (centre - prev.offset.y) / prev.scale;
      const offset = clampOffset(
        { x: centre - imageX * scale, y: centre - imageY * scale },
        natural.width,
        natural.height,
        scale,
        VIEWPORT,
      );
      return { scale, offset };
    });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    viewportRef.current?.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { startDistance: distance(a, b), startScale: view.scale };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const prev = pointers.current.get(event.pointerId);
    if (!prev) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const ratio = distance(a, b) / (pinch.current.startDistance || 1);
      zoom(pinch.current.startScale * ratio);
      return;
    }
    panBy(current.x - prev.x, current.y - prev.y);
  }

  function endPointer(event: React.PointerEvent<HTMLDivElement>): void {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>): void {
    zoom((prevScale) => prevScale * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
  }

  function onZoomSlider(event: React.ChangeEvent<HTMLInputElement>): void {
    zoom(minScale * Number(event.target.value));
  }

  async function handleConfirm(): Promise<void> {
    const img = imageRef.current;
    if (!img || !natural) return;
    setBusy(true);
    try {
      const rect = sourceRect(view.offset, view.scale, VIEWPORT);
      const blob = await cropToBlob(img, rect, outputSize);
      onConfirm(blob);
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  const displayWidth = natural ? natural.width * view.scale : 0;
  const displayHeight = natural ? natural.height * view.scale : 0;
  const zoomRatio = minScale > 0 ? view.scale / minScale : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4"
      data-testid={testId}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        className="flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-4 rounded-app border border-border bg-background p-6 shadow-lg"
      >
        <h2
          id={`${testId}-title`}
          className="text-lg font-semibold leading-none tracking-tight text-fg-primary"
        >
          {title}
        </h2>
        <p className="text-sm text-fg-secondary">{instructions}</p>

        <div className="flex justify-center">
          <div
            ref={viewportRef}
            className="relative touch-none select-none overflow-hidden rounded-app bg-[var(--bg-elevated)]"
            style={{ width: VIEWPORT, height: VIEWPORT }}
            data-testid="crop-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onWheel={onWheel}
          >
            {natural ? (
              <img
                src={imageRef.current?.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute left-0 top-0 max-w-none"
                style={{
                  width: displayWidth,
                  height: displayHeight,
                  transform: `translate(${view.offset.x}px, ${view.offset.y}px)`,
                  transformOrigin: "top left",
                }}
                data-testid="crop-image"
              />
            ) : null}
            {/* Crop guide: a centred shape that dims everything outside it
                via a large box-shadow in the overlay token, plus an accent
                ring. For "circle" the dim falls outside the inscribed
                circle (the avatar is rounded by the consumer). */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 border-2 border-[var(--accent)]"
              data-testid="crop-guide"
              style={{
                borderRadius: shape === "circle" ? "50%" : "var(--radius-md)",
                boxShadow: "0 0 0 9999px var(--bg-overlay)",
              }}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          <span className="shrink-0">{zoomLabel}</span>
          <input
            type="range"
            min={1}
            max={maxZoom}
            step={0.01}
            value={Number.isFinite(zoomRatio) ? Math.min(zoomRatio, maxZoom) : 1}
            onChange={onZoomSlider}
            disabled={!natural}
            className="w-full"
            aria-label={zoomLabel}
            data-testid="crop-zoom"
          />
        </label>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onCancel}
            disabled={busy}
            data-testid="crop-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => void handleConfirm()}
            disabled={busy || !natural}
            data-autofocus
            data-testid="crop-confirm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
