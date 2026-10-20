/**
 * LocalImage - the rich-text editor's image node (#3803).
 *
 * The official ``@tiptap/extension-image`` keeps any ``src``, so an
 * ``<img>`` pasted from a web page, or a note stored with one, made the
 * browser fetch the picture from its host on render and hand that host the
 * learner's IP address. This extension keeps the official node (the node
 * type stays ``image``, see architecture.md "TipTap editor") and only
 * guards its source:
 *
 * - pasted or parsed HTML: an image from another origin is kept without its
 *   ``src`` (the alt text stays);
 * - rendering: a stored or programmatically set source from another origin
 *   is never written to the DOM, so no request can start;
 * - typed Markdown (``![alt](url)``): a URL on another origin stays text
 *   instead of becoming an image.
 *
 * Same-origin URLs, relative paths, ``data:`` and ``blob:`` sources behave
 * exactly as before. "Another origin" is {@link isForeignImageUrl}, the
 * rule every Markdown surface uses too.
 *
 * @example
 * useEditor({ extensions: [StarterKit, LocalImage] });
 */

import {InputRule} from "@tiptap/core";
import Image from "@tiptap/extension-image";

import {isForeignImageUrl} from "../../lib/media/remote-image";

/** Capture group of the image input rule's regex that holds the URL. */
const INPUT_RULE_SRC_GROUP = 3;

/**
 * The source when the browser may load it on this page, else ``null``.
 *
 * @param value - An image ``src`` as pasted, stored or typed.
 * @returns ``value`` for a same-origin, relative, ``data:`` or ``blob:``
 *   source; ``null`` for an empty one or one on another origin.
 */
function localImageSource(value: unknown): string | null {
    if (typeof value !== "string" || value === "") return null;
    return isForeignImageUrl(value, document.baseURI) ? null : value;
}

const LocalImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            src: {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    localImageSource(element.getAttribute("src")),
                renderHTML: (attributes: Record<string, unknown>) => {
                    const src = localImageSource(attributes.src);
                    return src ? {src} : {};
                },
            },
        };
    },

    addInputRules() {
        return (this.parent?.() ?? []).map(
            (rule) =>
                new InputRule({
                    find: rule.find,
                    handler: (props) =>
                        localImageSource(props.match[INPUT_RULE_SRC_GROUP])
                            ? rule.handler(props)
                            : null,
                }),
        );
    },
});

export default LocalImage;
