/**
 * Share-intent URL builders (#1219).
 *
 * Pure, PII-free helpers that map a share text + app URL onto the web
 * share-intent endpoints of the platforms that actually expose one for a
 * link/text post: Facebook, LinkedIn, X (Twitter) and WhatsApp. They power
 * the desktop fallback of {@link ShareButton} (the popover shown when the
 * native `navigator.share` sheet is unavailable).
 *
 * Instagram is deliberately absent: it has NO public web-intent URL to
 * pre-fill a post with a link/text, so it can only be reached through the
 * native share sheet (`navigator.share`) when the app is installed — never
 * as a desktop link. A desktop "Instagram" button would simply not work.
 *
 * @example
 * const intents = buildShareIntentUrls(text, "https://example.com/");
 * // [{platform: "facebook", url: "https://www.facebook.com/sharer/..."}, ...]
 */

/** The platforms with a working web share-intent URL (no Instagram). */
export type SharePlatform = "facebook" | "linkedin" | "x" | "whatsapp";

/** A single platform's pre-filled share-intent URL. */
export interface ShareIntent {
    platform: SharePlatform;
    url: string;
}

/**
 * Build the ordered list of share-intent URLs for a result. Every parameter
 * is URL-encoded. The order (Facebook, LinkedIn, X, WhatsApp) is the order
 * the desktop popover renders them in.
 *
 * @param text - The PII-free share text (lesson title + aggregate score).
 * @param shareUrl - The app/set URL to link to.
 */
export function buildShareIntentUrls(
    text: string,
    shareUrl: string,
): ShareIntent[] {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(text);
    const textAndUrl = encodeURIComponent(`${text} ${shareUrl}`);
    return [
        {
            platform: "facebook",
            url: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
        },
        {
            platform: "linkedin",
            url: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
        },
        {
            platform: "x",
            url: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
        },
        {
            platform: "whatsapp",
            url: `https://wa.me/?text=${textAndUrl}`,
        },
    ];
}
