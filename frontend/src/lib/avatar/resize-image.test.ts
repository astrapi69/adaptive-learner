import {describe, expect, it, vi} from "vitest";

import {
  AVATAR_MAX_BYTES,
  dataUrlByteLength,
  encodeSquare,
  processAvatarFile,
  squareCropBox,
} from "./resize-image";

describe("dataUrlByteLength", () => {
  it("computes the decoded byte length of a data URL payload", () => {
    // "data:...," prefix is ignored; "AAAA" is 4 base64 chars => 3 bytes.
    expect(dataUrlByteLength("data:image/jpeg;base64,AAAA")).toBe(3);
    expect(dataUrlByteLength("data:image/jpeg;base64,AAA=")).toBe(2);
  });
});

describe("squareCropBox", () => {
  it("centers the crop on the shorter side", () => {
    expect(squareCropBox(200, 100)).toEqual({sx: 50, sy: 0, size: 100});
    expect(squareCropBox(100, 240)).toEqual({sx: 0, sy: 70, size: 100});
  });
});

describe("encodeSquare", () => {
  function fakeCanvas(payload: string): HTMLCanvasElement {
    return {
      getContext: () => ({drawImage: vi.fn()}),
      toDataURL: () => `data:image/jpeg;base64,${payload}`,
    } as unknown as HTMLCanvasElement;
  }

  it("returns the JPEG data URL when it fits the size cap", () => {
    const url = encodeSquare(
      {} as CanvasImageSource,
      400,
      300,
      () => fakeCanvas("AAAA"),
    );
    expect(url).toBe("data:image/jpeg;base64,AAAA");
  });

  it("returns null when even the lowest quality exceeds the cap", () => {
    const big = "A".repeat(AVATAR_MAX_BYTES * 2);
    const url = encodeSquare(
      {} as CanvasImageSource,
      400,
      300,
      () => fakeCanvas(big),
    );
    expect(url).toBeNull();
  });
});

describe("processAvatarFile", () => {
  it("rejects an unsupported file type", async () => {
    const file = new File(["x"], "a.gif", {type: "image/gif"});
    await expect(processAvatarFile(file)).rejects.toThrow(
      "avatar.error.unsupported_type",
    );
  });
});
