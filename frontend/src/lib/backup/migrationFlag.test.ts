import { beforeEach, describe, expect, it } from "vitest";

import { isMigrationOffered, markMigrationOffered } from "./migrationFlag";

beforeEach(() => {
  localStorage.clear();
});

describe("migration offered flag", () => {
  it("is false on a fresh install", () => {
    expect(isMigrationOffered()).toBe(false);
  });

  it("is true once marked", () => {
    markMigrationOffered();
    expect(isMigrationOffered()).toBe(true);
  });

  it("persists under the namespaced key", () => {
    markMigrationOffered();
    expect(localStorage.getItem("adaptive-learner.migration_offered")).toBe("true");
  });

  it("treats any non-\"true\" value as not offered", () => {
    localStorage.setItem("adaptive-learner.migration_offered", "1");
    expect(isMigrationOffered()).toBe(false);
  });
});
