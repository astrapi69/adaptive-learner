/**
 * #1927 — tests for the client-side EPUB parser.
 *
 * Fixtures are REAL EPUB containers built in-test with jszip (the same
 * library the parser uses), per the lessons-learned rule "pin the real
 * shape, not a hand-wave mock": container.xml -> OPF -> spine + nav/ncx.
 */
import JSZip from "jszip";
import {describe, expect, it} from "vitest";

import {parseEpub} from "./epub-parser";

const CONTAINER_XML = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">',
    '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>',
    "</container>",
].join("");

function chapterXhtml(title: string, paragraphs: string[]): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>',
        `<h1>${title}</h1>`,
        ...paragraphs.map((p) => `<p>${p}</p>`),
        "</body></html>",
    ].join("");
}

function opf(options: {
    manifest: string[];
    spine: string[];
    spineToc?: string;
}): string {
    const tocAttr = options.spineToc ? ` toc="${options.spineToc}"` : "";
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">',
        "<metadata/>",
        `<manifest>${options.manifest.join("")}</manifest>`,
        `<spine${tocAttr}>${options.spine.join("")}</spine>`,
        "</package>",
    ].join("");
}

async function epub3Fixture(): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip");
    zip.file("META-INF/container.xml", CONTAINER_XML);
    zip.file(
        "OEBPS/content.opf",
        opf({
            manifest: [
                '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
                '<item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>',
                '<item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>',
            ],
            spine: ['<itemref idref="c1"/>', '<itemref idref="c2"/>'],
        }),
    );
    zip.file(
        "OEBPS/nav.xhtml",
        [
            '<?xml version="1.0"?>',
            '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">',
            '<body><nav epub:type="toc"><ol>',
            '<li><a href="text/ch1.xhtml">Die Einleitung</a></li>',
            '<li><a href="text/ch2.xhtml#start">Der Hauptteil</a></li>',
            "</ol></nav></body></html>",
        ].join(""),
    );
    zip.file(
        "OEBPS/text/ch1.xhtml",
        chapterXhtml("Einleitung H1", ["Erster Absatz.", "Zweiter Absatz."]),
    );
    zip.file(
        "OEBPS/text/ch2.xhtml",
        chapterXhtml("Hauptteil H1", ["Inhalt zwei."]),
    );
    return zip.generateAsync({type: "arraybuffer"});
}

async function epub2Fixture(): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file("META-INF/container.xml", CONTAINER_XML);
    zip.file(
        "OEBPS/content.opf",
        opf({
            manifest: [
                '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
                '<item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>',
            ],
            spine: ['<itemref idref="c1"/>'],
            spineToc: "ncx",
        }),
    );
    zip.file(
        "OEBPS/toc.ncx",
        [
            '<?xml version="1.0"?>',
            '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">',
            "<navMap><navPoint id=\"n1\" playOrder=\"1\">",
            "<navLabel><text>NCX Kapitel</text></navLabel>",
            '<content src="ch1.xhtml"/>',
            "</navPoint></navMap></ncx>",
        ].join(""),
    );
    zip.file("OEBPS/ch1.xhtml", chapterXhtml("Fallback H1", ["Text."]));
    return zip.generateAsync({type: "arraybuffer"});
}

describe("parseEpub", () => {
    it("parses an EPUB3: spine order, nav-doc titles, block text", async () => {
        const result = await parseEpub(await epub3Fixture());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(2);
        expect(result.book.sections[0].title).toBe("Die Einleitung");
        expect(result.book.sections[0].text).toContain("Einleitung H1");
        expect(result.book.sections[0].text).toContain("Erster Absatz.");
        expect(result.book.sections[0].text).toContain("Zweiter Absatz.");
        // Fragment (#start) must not break the TOC href match.
        expect(result.book.sections[1].title).toBe("Der Hauptteil");
    });

    it("keeps paragraphs separated by blank lines in the extracted text", async () => {
        const result = await parseEpub(await epub3Fixture());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections[0].text).toContain(
            "Erster Absatz.\n\nZweiter Absatz.",
        );
    });

    it("parses an EPUB2 with toc.ncx titles", async () => {
        const result = await parseEpub(await epub2Fixture());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(1);
        expect(result.book.sections[0].title).toBe("NCX Kapitel");
    });

    it("falls back to the chapter h1 when no TOC entry matches", async () => {
        const zip = new JSZip();
        zip.file("META-INF/container.xml", CONTAINER_XML);
        zip.file(
            "OEBPS/content.opf",
            opf({
                manifest: [
                    '<item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>',
                ],
                spine: ['<itemref idref="c1"/>'],
            }),
        );
        zip.file("OEBPS/ch1.xhtml", chapterXhtml("Nur H1 Titel", ["Text."]));
        const result = await parseEpub(
            await zip.generateAsync({type: "arraybuffer"}),
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections[0].title).toBe("Nur H1 Titel");
    });

    it("drops whitespace-only spine items (e.g. image-only cover pages)", async () => {
        const zip = new JSZip();
        zip.file("META-INF/container.xml", CONTAINER_XML);
        zip.file(
            "OEBPS/content.opf",
            opf({
                manifest: [
                    '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
                    '<item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>',
                ],
                spine: ['<itemref idref="cover"/>', '<itemref idref="c1"/>'],
            }),
        );
        zip.file(
            "OEBPS/cover.xhtml",
            '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><img src="cover.jpg" alt=""/></body></html>',
        );
        zip.file("OEBPS/ch1.xhtml", chapterXhtml("Echtes Kapitel", ["Text."]));
        const result = await parseEpub(
            await zip.generateAsync({type: "arraybuffer"}),
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(1);
        expect(result.book.sections[0].title).toBe("Echtes Kapitel");
    });

    it("rejects a zip without container.xml as invalid_epub", async () => {
        const zip = new JSZip();
        zip.file("whatever.txt", "not an epub");
        const result = await parseEpub(
            await zip.generateAsync({type: "arraybuffer"}),
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("invalid_epub");
    });

    it("rejects a non-zip payload as invalid_epub", async () => {
        const bytes = new TextEncoder().encode("definitely not a zip");
        const buffer = bytes.buffer.slice(0) as ArrayBuffer;
        const result = await parseEpub(buffer);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("invalid_epub");
    });

    it("reports no_sections when every spine item is empty", async () => {
        const zip = new JSZip();
        zip.file("META-INF/container.xml", CONTAINER_XML);
        zip.file(
            "OEBPS/content.opf",
            opf({
                manifest: [
                    '<item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>',
                ],
                spine: ['<itemref idref="c1"/>'],
            }),
        );
        zip.file(
            "OEBPS/ch1.xhtml",
            '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body> </body></html>',
        );
        const result = await parseEpub(
            await zip.generateAsync({type: "arraybuffer"}),
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("no_sections");
    });
});
