/**
 * Remote image references (#3803).
 *
 * Two questions about an image reference that authors, content repositories
 * or an AI reply supply:
 *
 * - {@link isRemoteImageUrl}: is it a network URL at all, as opposed to
 *   embedded bytes (``data:``), an object URL (``blob:``) or a relative
 *   ``assets/`` path? Exercise payloads reject network URLs (offline-first).
 * - {@link isForeignImageUrl}: would rendering it make the browser fetch
 *   from a host other than the page's own? Markdown and the rich-text editor
 *   offer such an image as a link instead of loading it, so no third party
 *   learns the visitor's IP address from content they did not ask for.
 *
 * Pure functions, no DOM access: the caller passes the page URL.
 *
 * @example
 * isForeignImageUrl("https://example.com/a.png", document.baseURI); // true
 */

const NETWORK_URL = /^https?:\/\//i;

/** Whether an image reference is a remote ``http(s)://`` URL. Remote media
 *  breaks the offline-first guarantee, so exercises do not accept it. */
export function isRemoteImageUrl(value: string): boolean {
  return NETWORK_URL.test(value.trim());
}

/**
 * Whether rendering ``value`` as an image source on ``pageUrl`` would fetch
 * it from another origin.
 *
 * The reference is resolved the way the browser resolves an ``<img src>``,
 * so protocol-relative (``//host``) and scheme-relative (``https:host``)
 * forms count by where they land, not by how they are spelled. Same-origin
 * URLs, relative paths, ``data:`` and ``blob:`` are not foreign, and neither
 * is a reference the browser cannot parse (it cannot fetch it either).
 *
 * @param value - The image source as the content gives it.
 * @param pageUrl - The URL relative sources resolve against, usually
 *   ``document.baseURI``.
 * @returns ``true`` only for an ``http(s)`` URL on another origin.
 */
export function isForeignImageUrl(value: string, pageUrl: string): boolean {
  try {
    const resolved = new URL(value.trim(), pageUrl);
    return (
      isRemoteImageUrl(resolved.href) &&
      resolved.origin !== new URL(pageUrl).origin
    );
  } catch {
    return false;
  }
}
