/**
 * Image-only sharing (#2813).
 *
 * The result card is generated in the browser and attached to
 * ``navigator.share({text, files})`` - together with the text, which carries
 * the app link. WhatsApp accepts the attachment and shows the card; Facebook
 * takes the LINK instead, scrapes its page and shows the app's single, fixed
 * preview image. On a static deployment every URL serves the same meta tags,
 * so a per-result preview cannot exist that way.
 *
 * This path shares the file and NOTHING else: no text, no url. A link-only
 * target then has no link to prefer and creates a real photo post with the
 * card. Where files cannot be shared (desktop, older browsers) it degrades to
 * a download, so the user can attach the card by hand - never a dead button.
 *
 * @example
 * const outcome = await shareImageOnly(file);
 * // "shared" | "cancelled" | "downloaded" | "unavailable"
 */

/** What happened when the user triggered an image share. */
export type ImageShareOutcome =
  | "shared"
  | "cancelled"
  | "downloaded"
  | "unavailable";

/** Seams so the decision logic is testable without a browser share sheet. */
export interface ShareImageDeps {
  share?: (data: {files: File[]}) => Promise<void>;
  canShare: (data: {files: File[]}) => boolean;
  download: (file: File) => void;
}

/** Save a file through a temporary object URL (the browser's own download). */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Default seams: the real share sheet, the real download. */
function browserDeps(): ShareImageDeps {
  const nav =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & {
          canShare?: (data: {files: File[]}) => boolean;
          share?: (data: {files: File[]}) => Promise<void>;
        });
  return {
    share: nav?.share ? (data) => nav.share!(data) : undefined,
    canShare: (data) => Boolean(nav?.canShare?.(data)),
    download: downloadFile,
  };
}

/**
 * Share a single image file on its own, falling back to a download.
 *
 * @param file - The generated card, or ``null`` when it could not be rendered.
 * @param deps - Injected seams; defaults to the browser's.
 */
export async function shareImageOnly(
  file: File | null,
  deps: ShareImageDeps = browserDeps(),
): Promise<ImageShareOutcome> {
  if (!file) return "unavailable";
  const payload = {files: [file]};
  if (deps.share && deps.canShare(payload)) {
    try {
      await deps.share(payload);
      return "shared";
    } catch (err) {
      // A dismissed sheet is a choice, not a failure - and must not then
      // dump a file into the user's downloads behind their back.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  deps.download(file);
  return "downloaded";
}
