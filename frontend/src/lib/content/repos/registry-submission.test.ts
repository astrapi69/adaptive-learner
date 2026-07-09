/**
 * Tests for the register-a-repo submission builder (federated search).
 */

import { describe, expect, it } from "vitest";

import {
  buildRegistryEntry,
  buildRegistryPrBody,
  buildRegistryPrTitle,
  canonicalRepoUrl,
  languagePairs,
  registryBranchName,
  registryEditUrl,
  registryEntryJson,
  upsertRegistryEntry,
  type RegistrySubmissionInput,
} from "./registry-submission";
import type { RegistryEntry } from "./registry-types";

const BASE: RegistrySubmissionInput = {
  owner: "jane",
  repo: "content",
  branch: "main",
  commit: "a".repeat(40),
  title: "  Jane's sets  ",
  languages: ["de-fr"],
  validationStatus: "validated",
  validatedAt: "2026-07-09T00:00:00Z",
  indexSchemaVersion: "1.0",
};

describe("canonicalRepoUrl", () => {
  it("builds the https URL with no trailing slash", () => {
    expect(canonicalRepoUrl("jane", "content")).toBe(
      "https://github.com/jane/content",
    );
  });
});

describe("languagePairs", () => {
  it("derives distinct sorted source-target pairs, dropping incomplete ones", () => {
    expect(
      languagePairs([
        { source_language: "de", target_language: "fr" },
        { source_language: "de", target_language: "es" },
        { source_language: "de", target_language: "fr" },
        { source_language: "de", target_language: "" },
      ]),
    ).toEqual(["de-es", "de-fr"]);
  });
});

describe("buildRegistryEntry", () => {
  it("builds a schema-shaped entry, trimming the title and defaulting trust to 1", () => {
    const entry = buildRegistryEntry(BASE);
    expect(entry).toEqual({
      url: "https://github.com/jane/content",
      branch: "main",
      commit: "a".repeat(40),
      title: "Jane's sets",
      trust_level: 1,
      languages: ["de-fr"],
      validation: {
        status: "validated",
        validated_at: "2026-07-09T00:00:00Z",
        index_schema_version: "1.0",
      },
    });
  });

  it("includes a trimmed description and optional validation notes", () => {
    const entry = buildRegistryEntry({
      ...BASE,
      description: "  grammar drills  ",
      notes: " checked ",
      engineVersion: "0.4.0",
      validationStatus: "pending",
    });
    expect(entry.description).toBe("grammar drills");
    expect(entry.validation).toMatchObject({
      status: "pending",
      engine_version: "0.4.0",
      notes: "checked",
    });
    // description sits after title in JSON order (schema-doc order).
    const keys = Object.keys(entry);
    expect(keys.indexOf("description")).toBeGreaterThan(keys.indexOf("title"));
    expect(keys.indexOf("description")).toBeLessThan(keys.indexOf("trust_level"));
  });

  it("omits an empty index schema version + description", () => {
    const entry = buildRegistryEntry({
      ...BASE,
      indexSchemaVersion: undefined,
      description: "   ",
    });
    expect(entry).not.toHaveProperty("description");
    expect(entry.validation).not.toHaveProperty("index_schema_version");
  });
});

describe("PR title / body", () => {
  const entry = buildRegistryEntry(BASE);
  it("titles the PR with the repo slug", () => {
    expect(buildRegistryPrTitle(entry)).toBe("registry: add jane/content");
  });
  it("renders the commit + trust + validation in the body", () => {
    const body = buildRegistryPrBody(entry);
    expect(body).toContain(`\`${"a".repeat(40)}\``);
    expect(body).toContain("| Trust level | 1 |");
    expect(body).toContain("| Validation | validated |");
  });
});

describe("registryEditUrl / registryBranchName", () => {
  it("points at the official registry file's edit page", () => {
    expect(registryEditUrl()).toBe(
      "https://github.com/astrapi69/adaptive-learner-content/edit/main/recommended-repos.json",
    );
  });
  it("builds a slugged, dated branch name", () => {
    expect(registryBranchName("Jane", "My.Content", "2026-07-09")).toBe(
      "register-jane-my-content-2026-07-09",
    );
  });
});

describe("upsertRegistryEntry", () => {
  const entry = buildRegistryEntry(BASE);

  it("appends a new entry to an existing array", () => {
    const current = JSON.stringify({
      repos: [{ url: "https://github.com/astrapi69/adaptive-learner-content", self: true }],
    });
    const out = JSON.parse(upsertRegistryEntry(current, entry));
    expect(out.repos).toHaveLength(2);
    expect(out.repos[1].url).toBe("https://github.com/jane/content");
  });

  it("REPLACES an existing entry with the same url (a re-submission)", () => {
    const older: RegistryEntry = { ...entry, commit: "0".repeat(40) };
    const current = JSON.stringify({ repos: [older] });
    const out = JSON.parse(upsertRegistryEntry(current, entry));
    expect(out.repos).toHaveLength(1);
    expect(out.repos[0].commit).toBe("a".repeat(40));
  });

  it("degrades a malformed document to a fresh single-entry registry", () => {
    const out = JSON.parse(upsertRegistryEntry("not json", entry));
    expect(out.repos).toEqual([JSON.parse(registryEntryJson(entry))]);
  });

  it("emits pretty JSON with a trailing newline", () => {
    const text = upsertRegistryEntry('{"repos":[]}', entry);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain("\n  ");
  });
});
