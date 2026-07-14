/**
 * Federated-registry data shapes — a dependency-free leaf.
 *
 * Extracted so the storage type layer + the browser-direct GitHub client can
 * reference {@link RegistryEntry} / {@link RepoValidation} without importing
 * ``registry-submission`` → ``recommended-repos`` → ``content-repos`` →
 * ``storage`` (which would close an import cycle; the circular-dependency gate
 * keeps the baseline at 0). This module imports NOTHING.
 */

/**
 * Validation block carried by every EXTERNAL registry entry (the federated
 * search only serves a snapshot whose ``status`` is ``"validated"``). The
 * official ``self`` entry is exempt — its own CI validates every push.
 */
export interface RepoValidation {
  /** ``pending`` = submitted, not yet green; ``validated`` = the pinned
   *  commit passed; ``rejected`` = failed, kept for the record. */
  status: "pending" | "validated" | "rejected";
  /** ISO-8601 timestamp of when the pinned commit was validated. */
  validated_at: string;
  /** ``learn-content-engine`` version the snapshot was validated against. */
  engine_version?: string;
  /** ``schema_version`` of the repo's ``search-index.json`` at the pin. */
  index_schema_version?: string;
  notes?: string;
}

/** A ready-to-commit registry entry (field order mirrors the schema doc). */
export interface RegistryEntry {
  url: string;
  branch: string;
  commit: string;
  title: string;
  description?: string;
  trust_level: number;
  languages: string[];
  validation: RepoValidation;
}
