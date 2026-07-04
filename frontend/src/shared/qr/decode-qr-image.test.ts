/**
 * Tests for decodeQrImage (#1317).
 *
 * Mocks ``html5-qrcode`` so the suite never runs the real codec. Pins that a
 * decodable image resolves to the payload, that a no-QR image rejects, and that
 * the throwaway off-screen mount div is always removed (success AND failure).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scanFileMock = vi.fn();
const constructed: string[] = [];

vi.mock("html5-qrcode", () => {
  class Html5Qrcode {
    constructor(id: string) {
      constructed.push(id);
    }
    async scanFile(file: File, _showImage: boolean): Promise<string> {
      return scanFileMock(file);
    }
  }
  return { Html5Qrcode };
});

import { decodeQrImage } from "./decode-qr-image";

const file = new File(["x"], "qr.png", { type: "image/png" });

beforeEach(() => {
  scanFileMock.mockReset();
  constructed.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decodeQrImage", () => {
  it("resolves to the decoded payload for a readable QR image", async () => {
    scanFileMock.mockResolvedValue("adaptive-learner://pair?x=1");
    await expect(decodeQrImage(file)).resolves.toBe("adaptive-learner://pair?x=1");
  });

  it("rejects when the image contains no QR code", async () => {
    scanFileMock.mockRejectedValue(new Error("No MultiFormat Readers"));
    await expect(decodeQrImage(file)).rejects.toThrow(/MultiFormat/);
  });

  it("removes the off-screen mount div on success", async () => {
    scanFileMock.mockResolvedValue("ok");
    await decodeQrImage(file);
    const [id] = constructed;
    expect(document.getElementById(id)).toBeNull();
  });

  it("removes the off-screen mount div on failure", async () => {
    scanFileMock.mockRejectedValue(new Error("boom"));
    await expect(decodeQrImage(file)).rejects.toThrow();
    const [id] = constructed;
    expect(document.getElementById(id)).toBeNull();
  });
});
