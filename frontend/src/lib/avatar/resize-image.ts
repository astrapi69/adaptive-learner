/**
 * Client-side avatar image processing (#508).
 *
 * Takes a user-selected image file and produces a small, square,
 * base64 data URL suitable for storing in user settings (and riding the
 * backup/sync surface). Everything runs in the browser — no upload, no
 * server. Center-crops to a square, downscales to at most
 * {@link AVATAR_MAX_DIMENSION}px, and encodes as JPEG; if the result
 * still exceeds {@link AVATAR_MAX_BYTES} it re-encodes at a lower
 * quality until it fits (or rejects when it cannot).
 */

export const AVATAR_MAX_DIMENSION = 256;
export const AVATAR_MAX_BYTES = 100 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Approximate byte length of a base64 data URL's payload. */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** The center square crop box for an image of the given dimensions. */
export function squareCropBox(width: number, height: number): {
  sx: number;
  sy: number;
  size: number;
} {
  const size = Math.min(width, height);
  return { sx: (width - size) / 2, sy: (height - size) / 2, size };
}

/**
 * Draw the center-cropped, downscaled image onto a canvas and return
 * the JPEG data URL, shrinking quality until it fits the size cap.
 *
 * Exported (and seam-friendly) so it can be unit-tested with a fake
 * canvas; the higher-level {@link processAvatarFile} wires it to a real
 * decoded image.
 */
export function encodeSquare(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  makeCanvas: (size: number) => HTMLCanvasElement = defaultCanvas,
): string | null {
  const { sx, sy, size } = squareCropBox(sourceWidth, sourceHeight);
  const target = Math.min(size, AVATAR_MAX_DIMENSION);
  const canvas = makeCanvas(target);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, sx, sy, size, size, 0, 0, target, target);
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlByteLength(dataUrl) <= AVATAR_MAX_BYTES) return dataUrl;
  }
  return null;
}

function defaultCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/**
 * Process a user-selected file into a stored-ready avatar data URL.
 *
 * @throws Error with a stable, translatable reason key on an
 *   unsupported type or an image that won't shrink under the cap.
 */
export async function processAvatarFile(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("avatar.error.unsupported_type");
  }
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(bitmapUrl);
    const dataUrl = encodeSquare(img, img.naturalWidth, img.naturalHeight);
    if (!dataUrl) throw new Error("avatar.error.too_large");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("avatar.error.decode_failed"));
    img.src = url;
  });
}
