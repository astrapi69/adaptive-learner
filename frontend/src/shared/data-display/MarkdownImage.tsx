/**
 * MarkdownImage - the ``img`` renderer of every react-markdown surface
 * (#3803).
 *
 * Lesson theory, reading passages, explanations, AI replies and
 * learning-repo documents can come from a third-party content repository or
 * a model. A Markdown image from another host would make the visitor's
 * browser fetch it on render and hand that host their IP address, without
 * the visitor asking for it. So an image on another origin is offered as a
 * link instead: an image icon plus the alt text (or the address when there
 * is none), opening in a new tab only on a click. Same-origin images,
 * relative paths, ``data:`` and ``blob:`` sources (the object URLs
 * downloaded set assets resolve to) render as an ``<img>`` as before.
 *
 * "Another origin" is decided by resolving the source the way the browser
 * would ({@link isForeignImageUrl}), so a protocol-relative ``//host``
 * cannot slip through. The Pages build's Content-Security-Policy blocks
 * such images as well; this renderer is what keeps the content readable
 * and the request from being attempted at all.
 *
 * @example
 * <Markdown components={{ img: MarkdownImage }}>{body}</Markdown>
 */

import { ImageIcon } from "lucide-react";
import type { ComponentProps } from "react";
import type { ExtraProps } from "react-markdown";

import { isForeignImageUrl } from "../../lib/media/remote-image";

type MarkdownImageProps = ComponentProps<"img"> & ExtraProps;

/** Render one Markdown image: an ``<img>``, or a link for another host. */
export default function MarkdownImage({
  node: _node,
  src,
  alt,
  title,
  ...rest
}: MarkdownImageProps) {
  const source = typeof src === "string" ? src : "";
  if (!isForeignImageUrl(source, document.baseURI)) {
    return <img {...rest} src={src} alt={alt} title={title} />;
  }
  return (
    <a
      href={source}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? source}
      className="inline-flex items-center gap-1 [overflow-wrap:anywhere]"
      data-testid="markdown-remote-image"
    >
      <ImageIcon aria-hidden="true" className="size-4 shrink-0" />
      {alt?.trim() || source}
    </a>
  );
}
