/**
 * Register-a-repo submission builder (federated content-repo search).
 *
 * The consumer half of the content-repo's registry governance: a learner who
 * owns a content repo proposes it for the cross-repo search by opening a PR
 * that adds an entry to ``recommended-repos.json`` in the official content
 * repo. This module turns the repo's coordinates + a resolved commit into the
 * exact JSON entry the registry schema expects, plus the PR title/body and the
 * "edit the file" link so the user can propose it manually — and an
 * {@link upsertRegistryEntry} helper the programmatic (tokened) PR path uses to
 * splice the entry into the existing registry array.
 *
 * Pure + app-agnostic (only ``source-identity`` for the official repo constant)
 * so it is fully unit-testable and safe to import from the browser-direct
 * GitHub client without pulling in storage.
 */

import type { RepoValidation } from "./recommended-repos";
import { OFFICIAL_SOURCE } from "./source-identity";

/** The registry file at the official content repo's root. */
export const REGISTRY_FILE = "recommended-repos.json";

/** ``owner/repo`` of the official content repo that hosts the registry. */
export const OFFICIAL_CONTENT_REPO = OFFICIAL_SOURCE;

/** Inputs describing the repo a learner wants registered. */
export interface RegistrySubmissionInput {
  owner: string;
  repo: string;
  /** Branch the pinned commit lives on. */
  branch: string;
  /** Full 40-char SHA of the snapshot being proposed. */
  commit: string;
  title: string;
  description?: string;
  /** Curation trust; external repos start at 1. */
  trustLevel?: number;
  /** Advertised language pairs, e.g. ``["de-fr"]``. */
  languages: string[];
  /** ``validated`` when the app's local technical check passed, else
   *  ``pending`` (the content-repo CI re-checks regardless). */
  validationStatus: "validated" | "pending";
  /** ISO-8601 timestamp of the local validation. */
  validatedAt: string;
  /** ``schema_version`` of the repo's ``search-index.json`` at the commit. */
  indexSchemaVersion?: string;
  engineVersion?: string;
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

/** Canonical ``https://github.com/owner/repo`` URL (no trailing slash). */
export function canonicalRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Distinct, sorted ``"{source}-{target}"`` language pairs advertised by a
 * repo's search-index sets (the registry ``languages`` array). Sets without a
 * complete pair are ignored.
 */
export function languagePairs(
  sets: ReadonlyArray<{ source_language: string; target_language: string }>,
): string[] {
  const pairs = new Set<string>();
  for (const set of sets) {
    if (set.source_language && set.target_language) {
      pairs.add(`${set.source_language}-${set.target_language}`);
    }
  }
  return [...pairs].sort();
}

/** Build the registry entry object from the submission inputs. */
export function buildRegistryEntry(input: RegistrySubmissionInput): RegistryEntry {
  const validation: RepoValidation = {
    status: input.validationStatus,
    validated_at: input.validatedAt,
  };
  if (input.engineVersion) validation.engine_version = input.engineVersion;
  if (input.indexSchemaVersion) {
    validation.index_schema_version = input.indexSchemaVersion;
  }
  if (input.notes?.trim()) validation.notes = input.notes.trim();

  const entry: RegistryEntry = {
    url: canonicalRepoUrl(input.owner, input.repo),
    branch: input.branch || "main",
    commit: input.commit,
    title: input.title.trim(),
    trust_level: input.trustLevel ?? 1,
    languages: input.languages,
    validation,
  };
  // Keep the description positioned after the title (schema-doc order) by
  // rebuilding the object when present.
  if (input.description?.trim()) {
    return {
      url: entry.url,
      branch: entry.branch,
      commit: entry.commit,
      title: entry.title,
      description: input.description.trim(),
      trust_level: entry.trust_level,
      languages: entry.languages,
      validation: entry.validation,
    };
  }
  return entry;
}

/** Pretty-printed single-entry JSON (what the user pastes into the array). */
export function registryEntryJson(entry: RegistryEntry): string {
  return JSON.stringify(entry, null, 2);
}

/** The repo slug (``owner/repo``) a registry entry points at. */
export function registryEntrySlug(entry: RegistryEntry): string {
  return entry.url.replace(/^https:\/\/github\.com\//, "");
}

/** PR title: ``registry: add owner/repo``. */
export function buildRegistryPrTitle(entry: RegistryEntry): string {
  return `registry: add ${registryEntrySlug(entry)}`;
}

/** Markdown PR body — the maintainer-facing summary of the submission. */
export function buildRegistryPrBody(entry: RegistryEntry): string {
  const lines: string[] = [
    "## Register a content repo",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Repository | ${entry.url} |`,
    `| Branch | ${entry.branch} |`,
    `| Commit | \`${entry.commit}\` |`,
    `| Title | ${entry.title} |`,
    `| Trust level | ${entry.trust_level} |`,
    `| Languages | ${entry.languages.length > 0 ? entry.languages.join(", ") : "—"} |`,
    `| Validation | ${entry.validation.status} |`,
  ];
  if (entry.description) {
    lines.push("", `**Description:** ${entry.description}`);
  }
  lines.push(
    "",
    "_Proposed from Adaptive Learner — Settings › Integrations › Register your repo._",
    "_The **Validate registered repos** workflow re-checks the pinned commit on this PR._",
  );
  return lines.join("\n");
}

/**
 * GitHub Web "edit file" URL for the registry, so a user without a token can
 * propose the change: open the editor, paste the entry into the ``repos``
 * array, and "Propose changes" (GitHub auto-forks for non-collaborators).
 */
export function registryEditUrl(
  repo: string = OFFICIAL_CONTENT_REPO,
  branch = "main",
): string {
  return `https://github.com/${repo}/edit/${branch}/${REGISTRY_FILE}`;
}

/** A short, unique-ish branch name for a registry-submission PR. */
export function registryBranchName(
  owner: string,
  repo: string,
  date: string,
): string {
  const slug = `${owner}-${repo}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `register-${slug || "repo"}-${date}`;
}

/**
 * Splice ``entry`` into an existing ``recommended-repos.json`` document,
 * REPLACING any entry with the same ``url`` (a re-submission updates the pin)
 * and otherwise appending. Returns pretty JSON with a trailing newline. A
 * malformed/empty current document degrades to a fresh ``{ "repos": [entry] }``.
 * Pure — the programmatic PR path calls this after reading the live file.
 */
export function upsertRegistryEntry(
  currentJson: string,
  entry: RegistryEntry,
): string {
  let doc: { repos?: unknown } & Record<string, unknown>;
  try {
    const parsed = JSON.parse(currentJson) as unknown;
    doc =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    doc = {};
  }
  const repos = Array.isArray(doc.repos)
    ? (doc.repos as RegistryEntry[]).slice()
    : [];
  const index = repos.findIndex(
    (r) => r && typeof r === "object" && r.url === entry.url,
  );
  if (index >= 0) repos[index] = entry;
  else repos.push(entry);
  doc.repos = repos;
  return JSON.stringify(doc, null, 2) + "\n";
}
