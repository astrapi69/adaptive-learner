/**
 * Learning-Repository + plugin-settings namespaces.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

export interface ILearningRepoNamespace {
  render(
    projectId: string,
    language?: string,
  ): Promise<{
    project_id: string;
    language: string;
    rendered_at: string;
    files: Record<string, string>;
  }>;
  exportZip(projectId: string, language?: string): Promise<Blob>;
}

/**
 * Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
 * per-plugin settings round-trip. Mirrors the backend's
 * generic ``GET / PATCH /api/plugin-settings/{plugin_name}``
 * endpoints (v1.26.0 / Phase 42) so that every plugin's
 * user-visible settings UI can run in BOTH storage modes
 * without branching.
 *
 * Return shape is the API response 1:1: ``{plugin, settings}``.
 *
 * In Dexie mode, the ``pluginSettings`` IndexedDB table holds
 * one row per plugin name; the first ``get`` for a plugin that
 * has no row yet returns the bundled YAML defaults from
 * ``frontend/src/data/plugin-config/{name}.json`` (regenerated
 * from ``backend/config/plugins/*.yaml`` via
 * ``scripts/sync_plugin_config_to_frontend.py``). ``update``
 * upserts the merged settings into the table.
 */
export interface IPluginSettingsNamespace {
  get(pluginName: string): Promise<{
    plugin: string;
    settings: Record<string, unknown>;
  }>;
  update(
    pluginName: string,
    body: { settings: Record<string, unknown> },
  ): Promise<{ plugin: string; settings: Record<string, unknown> }>;
}

// --- Imports (v0.9.0 / Phase 12C) --------------------------------------
