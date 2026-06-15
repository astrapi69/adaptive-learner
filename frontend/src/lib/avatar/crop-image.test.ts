import { describe, expect, it, vi } from "vitest";

import {
  canvasToBlob,
  centeredOffset,
  clampOffset,
  clampScale,
  coverScale,
  cropToBlob,
  renderCrop,
  sourceRect,
} from "./crop-image";

const VIEWPORT = 224;

describe("crop-image geometry", () => {
  it("coverScale fills the viewport on the limiting axis (min-zoom)", () => {
    // Landscape 400x300: height is the tight axis.
    expect(coverScale(400, 300, VIEWPORT)).toBeCloseTo(VIEWPORT / 300, 6);
    // Portrait 300x400: width is the tight axis.
    expect(coverScale(300, 400, VIEWPORT)).toBeCloseTo(VIEWPORT / 300, 6);
    // A square image: either axis.
    expect(coverScale(500, 500, VIEWPORT)).toBeCloseTo(VIEWPORT / 500, 6);
  });

  it("coverScale guards against zero dimensions", () => {
    expect(coverScale(0, 100, VIEWPORT)).toBe(1);
  });

  it("clampScale bounds scale into [min, min*maxZoom]", () => {
    const min = 0.5;
    expect(clampScale(0.1, min, 3)).toBe(min);
    expect(clampScale(99, min, 3)).toBe(min * 3);
    expect(clampScale(1, min, 3)).toBe(1);
  });

  it("centeredOffset centers the scaled image", () => {
    const scale = coverScale(400, 300, VIEWPORT);
    const off = centeredOffset(400, 300, scale, VIEWPORT);
    // Vertically tight axis -> y offset 0; horizontally overflows -> x < 0.
    expect(off.y).toBeCloseTo(0, 6);
    expect(off.x).toBeLessThan(0);
  });

  it("clampOffset prevents empty areas at min-zoom (image always covers)", () => {
    const scale = coverScale(400, 300, VIEWPORT); // min-zoom
    const dw = 400 * scale;
    const dh = 300 * scale;
    // Try to drag far past the edges in every direction.
    for (const raw of [
      { x: 9999, y: 9999 },
      { x: -9999, y: -9999 },
      { x: 500, y: -500 },
    ]) {
      const off = clampOffset(raw, 400, 300, scale, VIEWPORT);
      // Image left/top must stay <= 0 and right/bottom >= viewport.
      expect(off.x).toBeLessThanOrEqual(0);
      expect(off.y).toBeLessThanOrEqual(0);
      expect(off.x + dw).toBeGreaterThanOrEqual(VIEWPORT - 1e-6);
      expect(off.y + dh).toBeGreaterThanOrEqual(VIEWPORT - 1e-6);
    }
  });

  it("sourceRect stays inside the image bounds at min-zoom (no gap framed)", () => {
    const scale = coverScale(400, 300, VIEWPORT);
    const off = clampOffset({ x: -9999, y: 0 }, 400, 300, scale, VIEWPORT);
    const rect = sourceRect(off, scale, VIEWPORT);
    expect(rect.sx).toBeGreaterThanOrEqual(-1e-6);
    expect(rect.sy).toBeGreaterThanOrEqual(-1e-6);
    expect(rect.sx + rect.sw).toBeLessThanOrEqual(400 + 1e-6);
    expect(rect.sy + rect.sh).toBeLessThanOrEqual(300 + 1e-6);
  });

  it("sourceRect maps viewport corners back to image space", () => {
    const rect = sourceRect({ x: -50, y: -20 }, 2, VIEWPORT);
    expect(rect.sx).toBeCloseTo(25, 6); // 50 / 2
    expect(rect.sy).toBeCloseTo(10, 6); // 20 / 2
    expect(rect.sw).toBeCloseTo(VIEWPORT / 2, 6);
  });
});

interface FakeCanvas {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  toBlob?: ReturnType<typeof vi.fn>;
}

function fakeCanvas(withToBlob: boolean): {
  canvas: FakeCanvas;
  drawImage: ReturnType<typeof vi.fn>;
} {
  const drawImage = vi.fn();
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
  };
  if (withToBlob) {
    canvas.toBlob = vi.fn(
      (cb: (b: Blob | null) => void, type: string) =>
        cb(new Blob(["jpeg-bytes"], { type })),
    );
  }
  return { canvas, drawImage };
}

describe("crop-image rendering", () => {
  it("renderCrop draws the framed region onto an outputSize square", () => {
    const { canvas, drawImage } = fakeCanvas(false);
    const image = {} as CanvasImageSource;
    const rect = { sx: 10, sy: 20, sw: 100, sh: 100 };
    const result = renderCrop(
      image,
      rect,
      256,
      () => canvas as unknown as HTMLCanvasElement,
    );
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
    expect(drawImage).toHaveBeenCalledWith(image, 10, 20, 100, 100, 0, 0, 256, 256);
  });

  it("cropToBlob produces a JPEG blob at the output size", async () => {
    const { canvas } = fakeCanvas(true);
    const blob = await cropToBlob(
      {} as CanvasImageSource,
      { sx: 0, sy: 0, sw: 50, sh: 50 },
      256,
      () => canvas as unknown as HTMLCanvasElement,
    );
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/jpeg");
    expect(canvas.width).toBe(256);
  });

  it("canvasToBlob rejects when toBlob yields null", async () => {
    const canvas = {
      width: 256,
      height: 256,
      toBlob: (cb: (b: Blob | null) => void) => cb(null),
    } as unknown as HTMLCanvasElement;
    await expect(canvasToBlob(canvas)).rejects.toThrow("avatar.error.too_large");
  });
});
