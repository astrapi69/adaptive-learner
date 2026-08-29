/** Tests for the i18next engine that replaced the hand-rolled lookup (#2797). */

import {beforeEach, describe, expect, it} from "vitest";

import {_resetEngineForTests, addCatalog, getI18n} from "./engine";

describe("i18n engine (#2797)", () => {
  beforeEach(() => _resetEngineForTests());

  it("resolves keys at any depth - the #2796 class is now the library's job", () => {
    const i18n = getI18n();
    // Three levels: unreachable by construction in the hand-rolled lookup.
    expect(i18n.t("update.banner.message")).not.toBe("update.banner.message");
    expect(i18n.t("install.ios.title")).not.toBe("install.ios.title");
  });

  it("falls back to English when the active language lacks a key", async () => {
    const i18n = getI18n();
    await i18n.changeLanguage("el");
    i18n.addResourceBundle("en", "translation", {probe: {only_en: "English"}}, true, true);
    expect(i18n.t("probe.only_en")).toBe("English");
  });

  it("merges an arriving catalog over the preloaded first-paint strings", async () => {
    const i18n = getI18n();
    await i18n.changeLanguage("de");
    const before = i18n.t("update.banner.later");
    addCatalog("de", {update: {banner: {later: "Später (aus dem Katalog)"}}});
    expect(i18n.t("update.banner.later")).toBe("Später (aus dem Katalog)");
    expect(before).not.toBe(i18n.t("update.banner.later"));
  });

  it("keeps sibling keys when a partial catalog is merged in", () => {
    const i18n = getI18n();
    addCatalog("de", {update: {banner: {later: "X"}}});
    // A shallow overwrite would drop the siblings; the merge must be deep.
    expect(i18n.t("update.banner.whats_new")).not.toBe("update.banner.whats_new");
  });

  it("single-brace placeholders survive untouched (call sites substitute them)", () => {
    const i18n = getI18n();
    i18n.addResourceBundle("de", "translation", {probe: {ph: "Version {version} da"}}, true, true);
    expect(i18n.t("probe.ph")).toBe("Version {version} da");
  });
});
