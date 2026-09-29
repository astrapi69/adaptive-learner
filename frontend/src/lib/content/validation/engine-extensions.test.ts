/**
 * The app's engine-side extension registry (#3222 PR 4): every extension
 * this app has adopted (``SUPPORTED_EXTENSIONS``) is registered with the
 * engine at the major the wizard pins, with the app's payload validator
 * as its ``validate``; the registry and the load-guard list stay one set.
 */
import { describe, expect, it } from "vitest";

import { APP_EXTENSION_REGISTRY, EXTENSION_MAJOR } from "./engine-extensions";
import { SUPPORTED_EXTENSIONS } from "./lesson-schema-validator";

describe("APP_EXTENSION_REGISTRY", () => {
  it("registers exactly the adopted extensions, each at the pinned major", () => {
    const registered = APP_EXTENSION_REGISTRY.map((ext) => ext.type).sort();
    expect(registered).toEqual([...SUPPORTED_EXTENSIONS].sort());
    for (const ext of APP_EXTENSION_REGISTRY) expect(ext.major).toBe(EXTENSION_MAJOR);
  });

  it("turns a payload validator's messages into engine issues at the exercise path", () => {
    const categorization = APP_EXTENSION_REGISTRY.find(
      (ext) => ext.type === "ext:al-categorization",
    );
    const issues = categorization!.validate({
      id: "ex-cat",
      type: "ext:al-categorization",
      prompt: "Sort",
      ext_payload: { categories: [{ name: "only", items: ["x"] }] },
    } as never);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: "E-APP-EXT-PAYLOAD",
      severity: "error",
      message: expect.stringContaining("at least 2 categories"),
    });
  });

  it("returns no issue for a valid payload", () => {
    const categorization = APP_EXTENSION_REGISTRY.find(
      (ext) => ext.type === "ext:al-categorization",
    );
    expect(
      categorization!.validate({
        id: "ex-cat",
        type: "ext:al-categorization",
        prompt: "Sort",
        ext_payload: {
          categories: [
            { name: "a", items: ["x"] },
            { name: "b", items: ["y"] },
          ],
        },
      } as never),
    ).toEqual([]);
  });
});
