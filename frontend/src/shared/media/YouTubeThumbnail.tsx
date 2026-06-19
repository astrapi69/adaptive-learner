/**
 * YouTubeThumbnail (EXP-029 / MED-04, hardened in MED-07).
 *
 * Shows the static thumbnail image for a YouTube video — NO iframe, NO
 * embedded player (privacy: no third-party scripts / cookies). When the
 * video id can't be derived, or the image fails to load, it falls back to a
 * neutral video-icon placeholder.
 *
 * The image is lazy-loaded (``loading="lazy"``) so off-screen cards don't
 * fetch until scrolled into view. When the device is offline we render the
 * placeholder immediately — no image request is attempted — and recover the
 * thumbnail automatically once connectivity returns.
 *
 * @example
 * <YouTubeThumbnail url="https://youtu.be/aircAruvnKk" title="Neural nets" />
 */

import { Video } from "lucide-react";
import { useState } from "react";

import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";
import { extractVideoId, getThumbnailUrl } from "../../lib/media/youtube";

interface YouTubeThumbnailProps {
  /** The YouTube video URL (any supported shape). */
  url: string;
  /** Accessible alt text (usually the resource title). */
  title: string;
  /** Extra classes for the wrapper (sizing lives with the caller). */
  className?: string;
}

/** Neutral placeholder shown when there is no derivable thumbnail. */
function Placeholder({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}
      aria-hidden="true"
      data-testid="youtube-thumbnail-placeholder"
    >
      <Video className="size-6" />
    </div>
  );
}

export default function YouTubeThumbnail({
  url,
  title,
  className,
}: YouTubeThumbnailProps) {
  const videoId = extractVideoId(url);
  const [failed, setFailed] = useState(false);
  const online = useOnlineStatus();

  // No id, a prior load error, or offline -> the neutral placeholder
  // (offline skips the network request entirely; it recovers when the
  // ``online`` event flips ``useOnlineStatus`` back to true).
  if (!videoId || failed || !online) return <Placeholder className={className} />;

  return (
    <img
      src={getThumbnailUrl(videoId)}
      alt={title}
      loading="lazy"
      className={`object-cover ${className ?? ""}`}
      onError={() => setFailed(true)}
      data-testid="youtube-thumbnail-img"
    />
  );
}
