/**
 * Tests for the reusable QrImageUpload control (#1317).
 *
 * Mocks the ``decodeQrImage`` helper so the component logic is tested in
 * isolation: a decodable image calls ``onResult`` with the raw payload; an
 * undecodable image shows the ``decodeError`` message and does NOT call
 * ``onResult``.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decodeMock = vi.fn();
vi.mock("./decode-qr-image", () => ({
  decodeQrImage: (file: File) => decodeMock(file),
}));

import QrImageUpload from "./QrImageUpload";

const labels = {
  upload: "Upload QR image",
  decoding: "Reading QR…",
  decodeError: "No QR code found in the image.",
};

function pickFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  decodeMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QrImageUpload", () => {
  it("calls onResult with the decoded payload for a readable QR image", async () => {
    decodeMock.mockResolvedValue("https://example.com/add-repo?url=o/r&branch=main");
    const onResult = vi.fn();
    render(<QrImageUpload onResult={onResult} labels={labels} />);

    pickFile(
      screen.getByTestId("qr-image-upload-input") as HTMLInputElement,
      new File(["x"], "qr.png", { type: "image/png" }),
    );

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(
        "https://example.com/add-repo?url=o/r&branch=main",
      ),
    );
    expect(screen.queryByTestId("qr-image-upload-error")).toBeNull();
  });

  it("shows the decode-error message and skips onResult when no QR is found", async () => {
    decodeMock.mockRejectedValue(new Error("no QR"));
    const onResult = vi.fn();
    render(<QrImageUpload onResult={onResult} labels={labels} />);

    pickFile(
      screen.getByTestId("qr-image-upload-input") as HTMLInputElement,
      new File(["x"], "blank.png", { type: "image/png" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("qr-image-upload-error")).toHaveTextContent(
        labels.decodeError,
      ),
    );
    expect(onResult).not.toHaveBeenCalled();
  });
});
