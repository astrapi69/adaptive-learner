/** Tests for the image-only share path (#2813). */

import {describe, expect, it, vi} from "vitest";

import {shareImageOnly} from "./share-image";

const FILE = new File(["x"], "result.png", {type: "image/png"});

describe("shareImageOnly", () => {
  it("hands the file to the share sheet WITHOUT text or url", async () => {
    const share = vi.fn(async (_data: {files: File[]}) => undefined);
    const outcome = await shareImageOnly(FILE, {
      share,
      canShare: () => true,
      download: vi.fn(),
    });
    expect(outcome).toBe("shared");
    // The whole point: a link-only target (Facebook) must not see a link,
    // or it posts the link and scrapes the app's default preview image.
    expect(share).toHaveBeenCalledWith({files: [FILE]});
    const payload = share.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("text");
    expect(payload).not.toHaveProperty("url");
  });

  it("falls back to a download when the platform cannot share files", async () => {
    const download = vi.fn();
    const outcome = await shareImageOnly(FILE, {
      share: vi.fn(),
      canShare: () => false,
      download,
    });
    expect(outcome).toBe("downloaded");
    expect(download).toHaveBeenCalledWith(FILE);
  });

  it("falls back to a download when there is no share sheet at all", async () => {
    const download = vi.fn();
    const outcome = await shareImageOnly(FILE, {
      share: undefined,
      canShare: () => true,
      download,
    });
    expect(outcome).toBe("downloaded");
    expect(download).toHaveBeenCalled();
  });

  it("reports a user-dismissed sheet as cancelled, not as a failure", async () => {
    const download = vi.fn();
    const outcome = await shareImageOnly(FILE, {
      share: vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
      canShare: () => true,
      download,
    });
    expect(outcome).toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
  });

  it("falls back to a download when the share sheet errors for another reason", async () => {
    const download = vi.fn();
    const outcome = await shareImageOnly(FILE, {
      share: vi.fn(async () => {
        throw new Error("boom");
      }),
      canShare: () => true,
      download,
    });
    expect(outcome).toBe("downloaded");
    expect(download).toHaveBeenCalled();
  });

  it("reports unavailable when there is no file to share", async () => {
    const download = vi.fn();
    const outcome = await shareImageOnly(null, {
      share: vi.fn(),
      canShare: () => true,
      download,
    });
    expect(outcome).toBe("unavailable");
    expect(download).not.toHaveBeenCalled();
  });
});
