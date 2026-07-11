/**
 * Invitation-code persistence (#1093) — the I/O layer over {@link
 * ./invite-codes}'s pure core.
 *
 * Two sides:
 *
 *   - **Coach (authenticated):** writes / lists / deactivates ``codes/*.json``
 *     in their own content repo via the browser-direct {@link GitHubApi} with
 *     the per-repo token. Works in both storage modes (the GitHub call never
 *     touches the backend).
 *   - **Learner (unauthenticated):** reads a single ``codes/<CODE>.json`` from
 *     the (unlisted-public) repo with a plain fetch — no GitHub account needed.
 *     A coach who shared a genuinely-private repo can embed a read-only token
 *     in the code file; it is applied as the per-repo token after redeem.
 *
 * Learner-local redemption records live in the ``content-loader`` plugin
 * settings (Dexie ``pluginSettings`` / API ``plugin-settings``) under
 * ``invite_redemptions`` — merged read-modify-write so the repo list is never
 * clobbered.
 */

import { getStorage } from "../../../storage";
import { GitHubApi } from "../../github/github-api";
import { CONTENT_LOADER_PLUGIN } from "../repos/content-repos";
import { buildFileRequest } from "../repos/github-fetch";
import {
  INVITE_CODES_DIR,
  inviteCodeFilePath,
  normalizeInviteCode,
  type InviteCodeFile,
  type InviteRedemption,
} from "./invite-codes";

/** Plugin-settings key holding the learner's local redemption records. */
const REDEMPTIONS_KEY = "invite_redemptions";

/** Narrow an unknown JSON value to an {@link InviteCodeFile} (best-effort). */
function asCodeFile(raw: unknown): InviteCodeFile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<InviteCodeFile>;
  if (typeof r.code !== "string" || typeof r.repo !== "string") return null;
  return {
    code: normalizeInviteCode(r.code),
    repo: r.repo,
    branch: typeof r.branch === "string" ? r.branch : "main",
    max_uses: typeof r.max_uses === "number" ? r.max_uses : 0,
    expires: typeof r.expires === "string" ? r.expires : null,
    note: typeof r.note === "string" ? r.note : "",
    created: typeof r.created === "string" ? r.created : "",
    deactivated: r.deactivated === true,
    token: typeof r.token === "string" ? r.token : undefined,
  };
}

/** Pretty-print a code file for committing (stable 2-space JSON). */
function serializeCodeFile(file: InviteCodeFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * Coach: create (or overwrite) a code file in ``source`` (``owner/repo``) on
 * ``branch`` using the coach ``token``. Returns the persisted file.
 */
export async function writeInviteCode(
  source: string,
  branch: string,
  token: string,
  file: InviteCodeFile,
): Promise<InviteCodeFile> {
  const api = new GitHubApi(token);
  const path = inviteCodeFilePath(file.code);
  const existing = await api.getFile(source, path, branch);
  await api.putFile(
    source,
    branch,
    path,
    serializeCodeFile(file),
    `invite: ${existing ? "update" : "create"} code ${file.code}`,
    existing?.sha,
  );
  return file;
}

/**
 * Coach: list every code file under ``codes/`` in ``source``. Authenticated so
 * a private repo is readable. Files that fail to parse are skipped.
 */
export async function listInviteCodes(
  source: string,
  branch: string,
  token: string,
): Promise<InviteCodeFile[]> {
  const api = new GitHubApi(token);
  const entries = await api.listDir(source, INVITE_CODES_DIR, branch);
  const jsonFiles = entries.filter(
    (e) => e.type === "file" && e.name.toLowerCase().endsWith(".json"),
  );
  const files = await Promise.all(
    jsonFiles.map(async (entry) => {
      const got = await api.getFile(source, entry.path, branch);
      if (!got) return null;
      try {
        return asCodeFile(JSON.parse(got.content));
      } catch {
        return null;
      }
    }),
  );
  return files.filter((f): f is InviteCodeFile => f !== null);
}

/**
 * Coach: deactivate a code — re-read it, set ``deactivated``, and rewrite it.
 * Blocks NEW redemptions; learners who already redeemed keep their access.
 * Returns the updated file, or null when the code does not exist.
 */
export async function deactivateInviteCode(
  source: string,
  branch: string,
  token: string,
  code: string,
): Promise<InviteCodeFile | null> {
  const api = new GitHubApi(token);
  const path = inviteCodeFilePath(code);
  const existing = await api.getFile(source, path, branch);
  if (!existing) return null;
  let parsed: InviteCodeFile | null;
  try {
    parsed = asCodeFile(JSON.parse(existing.content));
  } catch {
    parsed = null;
  }
  if (!parsed) return null;
  const updated: InviteCodeFile = { ...parsed, deactivated: true };
  await api.putFile(
    source,
    branch,
    path,
    serializeCodeFile(updated),
    `invite: deactivate code ${updated.code}`,
    existing.sha,
  );
  return updated;
}

/**
 * Learner: fetch a single ``codes/<CODE>.json`` from ``repo`` (``owner/repo``)
 * on ``branch``. Routed through the CORS-safe host weiche (#1439, same class
 * as #1429/#1438): a PUBLIC unlisted repo reads from
 * ``raw.githubusercontent.com`` with no custom headers (a "simple" request -
 * no CORS preflight, no unauthenticated ``api.github.com`` 60/h/IP limit);
 * with a per-repo ``token`` the authenticated contents API serves the file
 * bytes verbatim via ``application/vnd.github.raw`` (no base64). Returns null
 * when the code file does not exist (a wrong / unknown code).
 *
 * @param fetchImpl Injectable fetch (tests pass a scripted fake).
 */
export async function fetchInviteCode(
  repo: string,
  branch: string,
  code: string,
  token = "",
  // Bind to globalThis: a bare ``fetch`` reference invoked as ``fetchImpl(...)``
  // throws "Illegal invocation" because native fetch requires the global object
  // as its receiver.
  fetchImpl: typeof fetch = fetch.bind(globalThis),
): Promise<InviteCodeFile | null> {
  const path = inviteCodeFilePath(code);
  const { url, init } = buildFileRequest(repo, branch, path, token);
  const resp = await fetchImpl(url, init);
  if (resp.status === 404) return null;
  if (!resp.ok) {
    throw new Error(`GitHub returned ${resp.status} for the invitation code.`);
  }
  try {
    return asCodeFile(JSON.parse(await resp.text()));
  } catch {
    return null;
  }
}

/** Read the learner's local redemption records. Never throws → ``[]``. */
export async function readRedemptions(): Promise<InviteRedemption[]> {
  try {
    const { settings } = await getStorage().pluginSettings.get(
      CONTENT_LOADER_PLUGIN,
    );
    const list = (settings as Record<string, unknown>)?.[REDEMPTIONS_KEY];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (r): r is InviteRedemption =>
        !!r &&
        typeof r === "object" &&
        typeof (r as InviteRedemption).code === "string" &&
        typeof (r as InviteRedemption).repo === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Record a redemption locally (merged read-modify-write so the repo list and
 * other content-loader settings survive). De-duplicates by code.
 */
export async function recordRedemption(
  redemption: InviteRedemption,
): Promise<void> {
  const storage = getStorage();
  const { settings } = await storage.pluginSettings.get(CONTENT_LOADER_PLUGIN);
  const next: Record<string, unknown> = { ...(settings ?? {}) };
  const existing = Array.isArray(next[REDEMPTIONS_KEY])
    ? (next[REDEMPTIONS_KEY] as InviteRedemption[])
    : [];
  const deduped = existing.filter(
    (r) => normalizeInviteCode(r.code) !== normalizeInviteCode(redemption.code),
  );
  deduped.push({ ...redemption, code: normalizeInviteCode(redemption.code) });
  next[REDEMPTIONS_KEY] = deduped;
  await storage.pluginSettings.update(CONTENT_LOADER_PLUGIN, { settings: next });
}
