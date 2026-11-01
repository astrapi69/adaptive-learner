/**
 * Choose the share link for a set (#3819): the short ``/content/set/<id>``
 * when the recipient's app can resolve the id, the ``/add-repo`` link
 * otherwise.
 *
 * A recipient resolves an official set from its own listing, and a set of a
 * registry repo through the registry ({@link findSetInRegistry}). The
 * sharer runs the same registry lookup, so the short link is given only
 * when the registry names this set's own repo for the id.
 */

import { parseGitHubRepoUrl, userRepoSource } from "../repos/content-repos";
import {
  findSetInRegistry,
  type RegistrySetLookup,
} from "../repos/shared-link/registry-set-lookup";
import { isOfficialSource } from "../repos/source-identity";
import { buildSetShareLink, type ShareableSet } from "./share-link";

/** The chosen link and whether it is the short form. */
export interface SetShareLink {
  url: string;
  short: boolean;
}

/** Injection seams; production uses the registry and the running app. */
export interface ResolveSetShareLinkOptions {
  lookup?: (setId: string) => Promise<RegistrySetLookup>;
  origin?: string;
  basePath?: string;
}

/** ``owner/repo`` of a registry repo URL, or null. */
function sourceOf(url: string): string | null {
  const parsed = parseGitHubRepoUrl(url);
  return parsed ? userRepoSource(parsed.owner, parsed.repo) : null;
}

/** True when the recipient's registry lookup lands on this set's repo. */
async function registryResolves(
  set: ShareableSet,
  lookup: (setId: string) => Promise<RegistrySetLookup>,
): Promise<boolean> {
  try {
    const result = await lookup(set.id);
    return result.status === "found" && sourceOf(result.repo.url) === set.source;
  } catch {
    return false;
  }
}

/**
 * Resolve the share link for ``set``. Never throws: a failed lookup gives
 * the add-repo link, which always opens.
 *
 * @example
 * const { url, short } = await resolveSetShareLink(entry);
 */
export async function resolveSetShareLink(
  set: ShareableSet,
  { lookup = findSetInRegistry, origin, basePath }: ResolveSetShareLinkOptions = {},
): Promise<SetShareLink> {
  const short = isOfficialSource(set.source) || (await registryResolves(set, lookup));
  return { url: buildSetShareLink(set, { short }, origin, basePath), short };
}
