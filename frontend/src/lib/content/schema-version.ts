/**
 * Manifest `schema_version` stamped on app-authored content exports
 * (`lesson-export.ts`'s content-set ZIP, `repo-export.ts`'s GitHub repo
 * export). Sourced from the schema mirror's declared default so both
 * writers agree with each other and with the pinned engine release.
 *
 * `schema-version.test.ts` asserts this equals `schema/content-manifest.schema.json`'s
 * `properties.schema_version.default` — a `scripts/sync_schema_mirror_from_engine.py`
 * re-mirror that bumps the default now fails that test loudly instead of the
 * two writers silently drifting behind the mirror (as `"1.4"` did for two
 * months across six schema bumps, up to `x-schema-version` 1.11).
 */
export const CURRENT_MANIFEST_SCHEMA_VERSION = "1.6";
