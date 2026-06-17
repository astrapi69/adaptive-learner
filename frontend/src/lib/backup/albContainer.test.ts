/**
 * EXP-031 / BAK-02..05 — the `.alb` ZIP backup container.
 */

import { describe, it, expect } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import {
  buildAlbBytes,
  isZipBytes,
  parseAlbBytes,
  type AlbManifest,
} from "./albContainer";
import type { BackupPayload } from "../../types/domain";

const TINY_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB";

function payload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    format: "adaptive-learner-backup",
    version: "1.3.0",
    app_version: "1.86.0",
    created_at: "2026-06-17T00:00:00.000Z",
    user_id: "user-1234",
    storage_mode: "dexie",
    data: {
      users: [{ id: "user-1234", name: "Aster", updated_at: "2026-06-17T00:00:00.000Z" }],
      user_settings: [{ id: "s1", user_id: "user-1234", language: "de" }],
    },
    content_sets: [],
    stats: { total_records: 2, tables: { users: 1, user_settings: 1 } },
    ...overrides,
  };
}

describe("buildAlbBytes / parseAlbBytes (BAK-02)", () => {
  it("produces a ZIP (PK magic) holding manifest.json + data.json", () => {
    const bytes = buildAlbBytes(payload());
    expect(isZipBytes(bytes)).toBe(true);
    const files = unzipSync(bytes);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(["manifest.json", "data.json"]),
    );
    const manifest = JSON.parse(strFromU8(files["manifest.json"])) as AlbManifest;
    expect(manifest.format).toBe("adaptive-learner-backup");
    expect(manifest.container).toBe("alb");
    expect(manifest.app_version).toBe("1.86.0");
    expect(manifest.schema_version).toBe("1.3.0");
    expect(manifest.backup_type).toBe("full");
  });

  it("round-trips a payload byte-for-byte", () => {
    const original = payload();
    const parsed = parseAlbBytes(buildAlbBytes(original));
    expect(parsed.payload).toEqual(original);
  });

  it("carries the backup_type into the manifest (BAK-06)", () => {
    const parsed = parseAlbBytes(buildAlbBytes(payload(), "selective"));
    expect(parsed.manifest.backup_type).toBe("selective");
  });
});

describe("avatar as an asset (BAK-04)", () => {
  const withAvatar = payload({
    data: {
      user_settings: [
        {
          id: "s1",
          user_id: "user-1234",
          avatar: `data:image/jpeg;base64,${TINY_JPEG_B64}`,
        },
      ],
    },
  });

  it("externalises the avatar into assets/ (not base64 in data.json)", () => {
    const files = unzipSync(buildAlbBytes(withAvatar));
    expect(Object.keys(files)).toContain("assets/avatar.jpg");
    const data = JSON.parse(strFromU8(files["data.json"])) as BackupPayload;
    // The data.json carries a reference, NOT the base64 blob.
    expect(data.data.user_settings[0].avatar).toBe("alb-asset:assets/avatar.jpg");
    const manifest = JSON.parse(strFromU8(files["manifest.json"])) as AlbManifest;
    expect(manifest.assets).toEqual(["assets/avatar.jpg"]);
  });

  it("re-inlines the avatar to the original data URL on parse", () => {
    const parsed = parseAlbBytes(buildAlbBytes(withAvatar));
    expect(parsed.payload.data.user_settings[0].avatar).toBe(
      `data:image/jpeg;base64,${TINY_JPEG_B64}`,
    );
  });

  it("does not mutate the caller's payload", () => {
    const original = payload({
      data: {
        user_settings: [
          { id: "s1", avatar: `data:image/png;base64,${TINY_JPEG_B64}` },
        ],
      },
    });
    buildAlbBytes(original);
    expect(original.data.user_settings[0].avatar).toBe(
      `data:image/png;base64,${TINY_JPEG_B64}`,
    );
  });
});

describe("isZipBytes", () => {
  it("recognises the ZIP signature", () => {
    expect(isZipBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x0]))).toBe(true);
  });
  it("rejects JSON / other bytes", () => {
    expect(isZipBytes(new Uint8Array([0x7b, 0x22]))).toBe(false); // {"
    expect(isZipBytes(new Uint8Array([]))).toBe(false);
  });
});

describe("parseAlbBytes errors", () => {
  it("throws on non-ZIP bytes", () => {
    expect(() => parseAlbBytes(new Uint8Array([1, 2, 3]))).toThrow();
  });

  it("throws when uncompressed size exceeds the cap (zip-bomb guard)", () => {
    const bytes = buildAlbBytes(payload());
    expect(() => parseAlbBytes(bytes, 1)).toThrow(/too large/i);
  });

  it("throws when manifest.json/data.json are missing", () => {
    const bytes = zipSync({ "other.txt": strToU8("hi") });
    expect(() => parseAlbBytes(bytes)).toThrow(/not a valid/i);
  });
});
