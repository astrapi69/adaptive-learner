/** Tests for the image-only share path (#2813). */

import {describe, expect, it, vi} from "vitest";

import {shareImageOnly, type ShareImageDeps} from "./share-image";

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

  // Three distinct setups, one identical outcome: the share sheet is not
  // usable, so the file must reach the user through a download instead of
  // silently disappearing. Parametrized per quality-checks.md "Parametrized
  // tests" (#2739) - same assertion logic over a value table.
  const unusableSheetCases: Array<
    [string, Pick<ShareImageDeps, "share" | "canShare">]
  > = [
    [
      "the platform cannot share files",
      {share: vi.fn(), canShare: () => false},
    ],
    [
      "there is no share sheet at all",
      {share: undefined, canShare: () => true},
    ],
    [
      "the share sheet errors for a reason other than a user dismissal",
      {
        share: vi.fn(async () => {
          throw new Error("boom");
        }),
        canShare: () => true,
      },
    ],
  ];

  it.each(unusableSheetCases)("falls back to a download when %s", async (_label, deps) => {
    const download = vi.fn();
    const outcome = await shareImageOnly(FILE, {...deps, download});
    expect(outcome).toBe("downloaded");
    expect(download).toHaveBeenCalledWith(FILE);
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
