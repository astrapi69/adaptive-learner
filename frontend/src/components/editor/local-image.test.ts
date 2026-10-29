/**
 * LocalImage (#3803): the rich-text editor's image node never makes the
 * browser fetch from another host, whether the image arrives as pasted
 * HTML, as a stored note or as typed Markdown.
 */

import {Editor, type Content} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {afterEach, describe, expect, it} from "vitest";

import LocalImage from "./local-image";

const FOREIGN = "https://probe-image.example/p.png";

let editor: Editor | null = null;

function makeEditor(content: Content): Editor {
    editor = new Editor({extensions: [StarterKit, LocalImage], content});
    return editor;
}

afterEach(() => {
    editor?.destroy();
    editor = null;
});

/** The ``src`` of every image node in the document. */
function storedSources(target: Editor): (string | null)[] {
    const sources: (string | null)[] = [];
    target.state.doc.descendants((node) => {
        if (node.type.name === "image") sources.push(node.attrs.src as string | null);
    });
    return sources;
}

/** The ``src`` attribute of every rendered ``<img>``. */
function renderedSources(target: Editor): (string | null)[] {
    return [...target.view.dom.querySelectorAll("img")].map((img) => img.getAttribute("src"));
}

/** Type ``text`` character by character, so input rules run. */
function type(target: Editor, text: string): void {
    for (const char of text) {
        const {from, to} = target.state.selection;
        const handled = target.view.someProp("handleTextInput", (handler) =>
            handler(target.view, from, to, char, () => target.state.tr.insertText(char, from, to)),
        );
        if (!handled) target.view.dispatch(target.state.tr.insertText(char, from, to));
    }
}

describe("LocalImage (#3803)", () => {
    it("drops the source of a pasted image from another host and keeps its alt text", () => {
        const target = makeEditor(`<p>Text</p><img src="${FOREIGN}" alt="Skizze">`);
        expect(storedSources(target)).toEqual([null]);
        expect(renderedSources(target)).toEqual([null]);
        expect(target.view.dom.querySelector("img")?.getAttribute("alt")).toBe("Skizze");
    });

    it.each([
        ["protocol-relative URL", "//probe-image.example/p.png"],
        ["upper-case scheme", "HTTPS://PROBE-IMAGE.EXAMPLE/p.png"],
    ])("treats a %s as another host", (_name, src) => {
        const target = makeEditor(`<img src="${src}" alt="x">`);
        expect(storedSources(target)).toEqual([null]);
        expect(renderedSources(target)).toEqual([null]);
    });

    it.each([
        ["root-relative path", "/adaptive-learner/skizze.png"],
        ["relative path", "assets/skizze.png"],
        ["same-origin absolute URL", `${window.location.origin}/skizze.png`],
    ])("keeps a %s, which the app serves itself", (_name, src) => {
        const target = makeEditor(`<img src="${src}" alt="x">`);
        expect(storedSources(target)).toEqual([src]);
        expect(renderedSources(target)).toEqual([src]);
    });

    it("renders a stored note's image from another host without a source", () => {
        const target = makeEditor({
            type: "doc",
            content: [{type: "image", attrs: {src: FOREIGN, alt: "Alt"}}],
        });
        expect(renderedSources(target)).toEqual([null]);
        expect(target.getHTML()).not.toContain("probe-image.example");
    });

    it("leaves typed Markdown for another host's image as text", () => {
        const target = makeEditor("<p></p>");
        type(target, `![x](${FOREIGN})`);
        expect(storedSources(target)).toEqual([]);
        expect(target.getText()).toBe(`![x](${FOREIGN})`);
    });

    it("still turns typed Markdown for a same-origin image into an image", () => {
        const target = makeEditor("<p></p>");
        type(target, "![x](/skizze.png)");
        expect(storedSources(target)).toEqual(["/skizze.png"]);
    });
});
