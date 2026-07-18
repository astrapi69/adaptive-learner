/**
 * Dexie-mode plugin-settings namespace (#1786 — extracted from
 * dexie-storage.ts).
 *
 * Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
 * per-plugin settings round-trip in Dexie mode. The
 * pluginSettings table is empty on a fresh install; the
 * first ``get(name)`` falls back to the bundled YAML
 * defaults at ``frontend/src/data/plugin-config/{name}.json``
 * (regenerated from ``backend/config/plugins/*.yaml`` via
 * ``scripts/sync_plugin_config_to_frontend.py``). ``update``
 * upserts a row keyed by plugin name. Response shape
 * mirrors the API's ``{plugin, settings}`` payload so
 * consumers don't branch on storage mode.
 */

import { getDb, nowIso } from "./db";
import type { IStorageService } from "../types";

export const dexiePluginSettings: IStorageService["pluginSettings"] = {
  get: async (pluginName: string) => {
    const db = getDb();
    const row = await db.pluginSettings.get(pluginName);
    if (row) {
      return { plugin: pluginName, settings: row.settings };
    }
    // Lazy defaults: pull from the bundled YAML.
    // ``import.meta.glob`` resolves the JSON files at
    // build time so the chunk is available without a
    // dynamic fetch — matches the i18n namespace's
    // pattern.
    const bundles = import.meta.glob<Record<string, unknown>>(
      "../../data/plugin-config/*.json",
      { eager: true, import: "default" },
    );
    const path = `../../data/plugin-config/${pluginName}.json`;
    const defaults = bundles[path] ?? {};
    return { plugin: pluginName, settings: defaults };
  },
  update: async (
    pluginName: string,
    body: { settings: Record<string, unknown> },
  ) => {
    const db = getDb();
    const ts = nowIso();
    await db.pluginSettings.put({
      name: pluginName,
      settings: body.settings,
      updated_at: ts,
    });
    return { plugin: pluginName, settings: body.settings };
  },
};
