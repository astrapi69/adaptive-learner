/**
 * Pure YouTube URL helpers (EXP-029 / MED-04, hardened in MED-07).
 *
 * We never embed a YouTube player (privacy: no third-party iframe, no
 * tracking cookies). Instead a resource card shows the static thumbnail
 * image served from ``img.youtube.com`` and links out to the video. These
 * helpers extract the video id from the various YouTube URL shapes and build
 * the thumbnail URL.
 *
 * All functions are pure and side-effect-free.
 */

/** Thumbnail quality. ``mqdefault`` (320x180) is the default — small, always
 *  present; ``hqdefault`` (480x360) for a larger preview. */
export type YouTubeThumbnailQuality = "mqdefault" | "hqdefault";

/** A YouTube video id is 11 chars of ``[A-Za-z0-9_-]``. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && VIDEO_ID_RE.test(value);
}

/**
 * Extract the 11-char video id from a YouTube URL, or ``null`` when the URL
 * is not a single-video YouTube link (playlist, channel, malformed, …).
 *
 * Handles: ``youtube.com/watch?v=ID``, ``youtu.be/ID``,
 * ``youtube.com/embed/ID``, ``youtube.com/shorts/ID``,
 * ``youtube.com/v/ID``, ``youtube.com/live/ID``, and the
 * ``music.``/``m.``/``www.`` host variants. Extra query params (``&t=30s``,
 * ``?si=…``) are ignored.
 */
export function extractVideoId(url: string | null | undefined): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return isVideoId(id) ? id : null;
  }

  const isYouTubeHost =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com";
  if (!isYouTubeHost) return null;

  // /watch?v=ID
  const vParam = parsed.searchParams.get("v");
  if (isVideoId(vParam)) return vParam;

  // /embed/ID, /shorts/ID, /v/ID, /live/ID
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const [prefix, candidate] = segments;
    if (
      ["embed", "shorts", "v", "live"].includes(prefix) &&
      isVideoId(candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

/** Whether a URL points at a single YouTube video (a thumbnail is
 *  derivable). Playlists / channels return ``false``. */
export function isYouTubeUrl(url: string | null | undefined): boolean {
  return extractVideoId(url) !== null;
}

/** Build the static thumbnail image URL for a video id. */
export function getThumbnailUrl(
  videoId: string,
  quality: YouTubeThumbnailQuality = "mqdefault",
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
