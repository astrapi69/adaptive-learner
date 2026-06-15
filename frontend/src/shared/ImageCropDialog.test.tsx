import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImageCropDialog from "./ImageCropDialog";
import * as cropImage from "../lib/avatar/crop-image";

const fakeImage = {
  naturalWidth: 400,
  naturalHeight: 300,
  src: "blob:fake-image",
} as unknown as HTMLImageElement;

function translateX(el: HTMLElement): number {
  const match = /translate\(([-\d.]+)px/.exec(el.style.transform);
  return match ? Number(match[1]) : NaN;
}

async function renderDialog(
  over: Partial<React.ComponentProps<typeof ImageCropDialog>> = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ImageCropDialog
      image={new Blob(["x"], { type: "image/png" })}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    />,
  );
  // Wait for the decoded image to be framed.
  await waitFor(() => expect(screen.getByTestId("crop-image")).toBeInTheDocument());
  return { onConfirm, onCancel };
}

describe("ImageCropDialog", () => {
  beforeEach(() => {
    vi.spyOn(cropImage, "loadImageFromBlob").mockResolvedValue(fakeImage);
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens and frames the image after decoding", async () => {
    await renderDialog();
    expect(screen.getByTestId("image-crop-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("crop-viewport")).toBeInTheDocument();
    expect(screen.getByTestId("crop-guide")).toBeInTheDocument();
    // Min-zoom centers the landscape image with a negative x offset.
    expect(translateX(screen.getByTestId("crop-image"))).toBeLessThan(0);
  });

  it("drag pans the image (pointer events)", async () => {
    await renderDialog();
    const viewport = screen.getByTestId("crop-viewport");
    const before = translateX(screen.getByTestId("crop-image"));
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 120, clientY: 100 });
    fireEvent.pointerUp(viewport, { pointerId: 1 });
    const after = translateX(screen.getByTestId("crop-image"));
    expect(after).toBeGreaterThan(before);
  });

  it("never pans past the edge (min-zoom prevents empty areas)", async () => {
    await renderDialog();
    const viewport = screen.getByTestId("crop-viewport");
    // Drag hard to the right; offset.x must never become positive.
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 9999, clientY: 0 });
    fireEvent.pointerUp(viewport, { pointerId: 1 });
    expect(translateX(screen.getByTestId("crop-image"))).toBeLessThanOrEqual(0);
  });

  it("wheel zoom scales the image up", async () => {
    await renderDialog();
    const viewport = screen.getByTestId("crop-viewport");
    const widthBefore = parseFloat(screen.getByTestId("crop-image").style.width);
    fireEvent.wheel(viewport, { deltaY: -200 });
    const widthAfter = parseFloat(screen.getByTestId("crop-image").style.width);
    expect(widthAfter).toBeGreaterThan(widthBefore);
  });

  it("Apply renders the crop and confirms a 256x256 JPEG blob", async () => {
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    const cropSpy = vi.spyOn(cropImage, "cropToBlob").mockResolvedValue(blob);
    const { onConfirm } = await renderDialog({ outputSize: 256 });
    fireEvent.click(screen.getByTestId("crop-confirm"));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(blob));
    // The framed region is rendered at the requested output size.
    expect(cropSpy).toHaveBeenCalled();
    expect(cropSpy.mock.calls[0][2]).toBe(256);
  });

  it("Cancel closes without confirming", async () => {
    const { onConfirm, onCancel } = await renderDialog();
    fireEvent.click(screen.getByTestId("crop-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape cancels", async () => {
    const { onCancel } = await renderDialog();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("the zoom slider scales the image", async () => {
    await renderDialog();
    const widthBefore = parseFloat(screen.getByTestId("crop-image").style.width);
    fireEvent.change(screen.getByTestId("crop-zoom"), { target: { value: "2.5" } });
    const widthAfter = parseFloat(screen.getByTestId("crop-image").style.width);
    expect(widthAfter).toBeGreaterThan(widthBefore);
  });
});
