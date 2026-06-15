/**
 * Interactive-crop geometry + canvas rendering (#558).
 *
 * Pure, framework-free helpers that drive {@link ImageCropDialog}. The
 * geometry functions describe a square crop *viewport* of side
 * ``viewport`` px in which an image is shown at a uniform ``scale``
 * (display px per image px) and a top-left ``offset`` (the image's
 * top-left corner in viewport coordinates). Keeping the math here — out
 * of the component and out of the canvas — makes the min-zoom / pan
 * clamping / source-rect logic unit-testable without a DOM.
 *
 * The render helpers ({@link renderCrop}, {@link cropToBlob}) take a
 * decoded image plus a {@link SourceRect} and paint the framed region
 * onto an ``outputSize`` square canvas; the canvas factory is injectable
 * so they can be exercised with a fake canvas in tests.
 */

export interface Offset {
  x: number;
  y: number;
}

/** A rectangle in the original image's pixel space. */
export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * The smallest scale at which the image fully covers the square
 * viewport (no empty area inside the crop). This is the min-zoom.
 */
export function coverScale(
  imageWidth: number,
  imageHeight: number,
  viewport: number,
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  return Math.max(viewport / imageWidth, viewport / imageHeight);
}

/** Clamp a scale into ``[minScale, minScale * maxZoom]``. */
export function clampScale(
  scale: number,
  minScale: number,
  maxZoom: number,
): number {
  return Math.min(Math.max(scale, minScale), minScale * maxZoom);
}

/** The offset that centers the scaled image in the viewport. */
export function centeredOffset(
  imageWidth: number,
  imageHeight: number,
  scale: number,
  viewport: number,
): Offset {
  return {
    x: (viewport - imageWidth * scale) / 2,
    y: (viewport - imageHeight * scale) / 2,
  };
}

/**
 * Clamp a pan offset so the scaled image always covers the viewport —
 * the image's left/top stays ``<= 0`` and its right/bottom stays
 * ``>= viewport``. This is what guarantees "min-zoom prevents empty
 * areas": at any scale ``>= coverScale`` no gap can be panned in.
 */
export function clampOffset(
  offset: Offset,
  imageWidth: number,
  imageHeight: number,
  scale: number,
  viewport: number,
): Offset {
  const displayedWidth = imageWidth * scale;
  const displayedHeight = imageHeight * scale;
  const minX = Math.min(0, viewport - displayedWidth);
  const minY = Math.min(0, viewport - displayedHeight);
  return {
    x: Math.min(0, Math.max(minX, offset.x)),
    y: Math.min(0, Math.max(minY, offset.y)),
  };
}

/**
 * The region of the original image currently framed by the viewport,
 * in image pixels. Drawn onto the output canvas on confirm.
 */
export function sourceRect(
  offset: Offset,
  scale: number,
  viewport: number,
): SourceRect {
  return {
    sx: -offset.x / scale,
    sy: -offset.y / scale,
    sw: viewport / scale,
    sh: viewport / scale,
  };
}

export type CanvasFactory = (size: number) => HTMLCanvasElement;

function defaultCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/**
 * Paint the framed ``rect`` of ``image`` onto a fresh
 * ``outputSize`` x ``outputSize`` canvas and return it.
 *
 * @throws Error("avatar.error.decode_failed") when a 2D context is
 *   unavailable.
 */
export function renderCrop(
  image: CanvasImageSource,
  rect: SourceRect,
  outputSize: number,
  makeCanvas: CanvasFactory = defaultCanvas,
): HTMLCanvasElement {
  const canvas = makeCanvas(outputSize);
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("avatar.error.decode_failed");
  ctx.drawImage(
    image,
    rect.sx,
    rect.sy,
    rect.sw,
    rect.sh,
    0,
    0,
    outputSize,
    outputSize,
  );
  return canvas;
}

/** Encode a canvas to a Blob, falling back to a data-URL decode when
 *  ``toBlob`` is unavailable (older / test canvases). */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.9,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("avatar.error.too_large")),
        type,
        quality,
      );
      return;
    }
    try {
      const dataUrl = canvas.toDataURL(type, quality);
      const comma = dataUrl.indexOf(",");
      const binary = atob(dataUrl.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      resolve(new Blob([bytes], { type }));
    } catch {
      reject(new Error("avatar.error.too_large"));
    }
  });
}

/** Render + encode in one step: the framed region as a JPEG Blob. */
export async function cropToBlob(
  image: CanvasImageSource,
  rect: SourceRect,
  outputSize: number,
  makeCanvas: CanvasFactory = defaultCanvas,
  quality = 0.9,
): Promise<Blob> {
  const canvas = renderCrop(image, rect, outputSize, makeCanvas);
  return canvasToBlob(canvas, "image/jpeg", quality);
}

/** Decode a Blob/File into an HTMLImageElement (object-URL backed). */
export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("avatar.error.decode_failed"));
    };
    image.src = url;
  });
}

/** Read a Blob into a base64 data URL (used to persist the crop). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("avatar.error.decode_failed"));
    reader.readAsDataURL(blob);
  });
}
