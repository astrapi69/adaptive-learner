/**
 * #1927 phase 2b — tests for the client-side DOCX parser.
 *
 * Fixtures are REAL OOXML containers built in-test with jszip (the same
 * library the parser uses): word/document.xml + word/styles.xml. The
 * heading signal under test is the locale-independent ``w:outlineLvl``
 * (styles.xml or direct on the paragraph) plus the styleId-regex
 * fallback for localized ids like ``berschrift1`` (German Word).
 */
import JSZip from "jszip";
import {describe, expect, it} from "vitest";

import {parseDocx} from "./docx-parser";

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function stylesXml(
    styles: Array<{id: string; outlineLvl?: number}>,
): string {
    const body = styles
        .map((style) => {
            const outline =
                style.outlineLvl === undefined
                    ? ""
                    : `<w:pPr><w:outlineLvl w:val="${style.outlineLvl}"/></w:pPr>`;
            return `<w:style w:type="paragraph" w:styleId="${style.id}">${outline}</w:style>`;
        })
        .join("");
    return `<?xml version="1.0"?><w:styles ${W_NS}>${body}</w:styles>`;
}

function paragraph(options: {
    text: string;
    styleId?: string;
    outlineLvl?: number;
}): string {
    const props: string[] = [];
    if (options.styleId) {
        props.push(`<w:pStyle w:val="${options.styleId}"/>`);
    }
    if (options.outlineLvl !== undefined) {
        props.push(`<w:outlineLvl w:val="${options.outlineLvl}"/>`);
    }
    const pPr = props.length > 0 ? `<w:pPr>${props.join("")}</w:pPr>` : "";
    return `<w:p>${pPr}<w:r><w:t>${options.text}</w:t></w:r></w:p>`;
}

async function docxFixture(options: {
    paragraphs: string[];
    styles?: string;
    omitDocument?: boolean;
}): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file(
        "[Content_Types].xml",
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    );
    if (!options.omitDocument) {
        zip.file(
            "word/document.xml",
            `<?xml version="1.0"?><w:document ${W_NS}><w:body>${options.paragraphs.join("")}</w:body></w:document>`,
        );
    }
    if (options.styles) {
        zip.file("word/styles.xml", options.styles);
    }
    return zip.generateAsync({type: "arraybuffer"});
}

describe("parseDocx", () => {
    it("splits at styles.xml-declared outlineLvl-0 headings (English styleIds)", async () => {
        const data = await docxFixture({
            styles: stylesXml([
                {id: "Heading1", outlineLvl: 0},
                {id: "Heading2", outlineLvl: 1},
            ]),
            paragraphs: [
                paragraph({text: "Kapitel Eins", styleId: "Heading1"}),
                paragraph({text: "Erster Absatz."}),
                paragraph({text: "Unterthema", styleId: "Heading2"}),
                paragraph({text: "Mehr Text."}),
                paragraph({text: "Kapitel Zwei", styleId: "Heading1"}),
                paragraph({text: "Zweiter Teil."}),
            ],
        });
        const result = await parseDocx(data);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.format).toBe("docx");
        expect(result.book.sections).toHaveLength(2);
        expect(result.book.sections[0].title).toBe("Kapitel Eins");
        expect(result.book.sections[0].text).toContain("Erster Absatz.");
        expect(result.book.sections[0].text).toContain("Unterthema");
        expect(result.book.sections[1].title).toBe("Kapitel Zwei");
        expect(result.book.sections[1].text).toContain("Zweiter Teil.");
    });

    it("detects German localized styleIds (berschrift1) via the regex fallback", async () => {
        const data = await docxFixture({
            styles: stylesXml([{id: "berschrift1"}]),
            paragraphs: [
                paragraph({text: "Einleitung", styleId: "berschrift1"}),
                paragraph({text: "Text eins."}),
                paragraph({text: "Hauptteil", styleId: "berschrift1"}),
                paragraph({text: "Text zwei."}),
            ],
        });
        const result = await parseDocx(data);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections.map((s) => s.title)).toEqual([
            "Einleitung",
            "Hauptteil",
        ]);
    });

    it("honors a direct w:outlineLvl on the paragraph without styles.xml", async () => {
        const data = await docxFixture({
            paragraphs: [
                paragraph({text: "Teil A", outlineLvl: 0}),
                paragraph({text: "Inhalt A."}),
                paragraph({text: "Teil B", outlineLvl: 0}),
                paragraph({text: "Inhalt B."}),
            ],
        });
        const result = await parseDocx(data);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(2);
        expect(result.book.sections[1].title).toBe("Teil B");
    });

    it("splits adaptively at level 2 when only Heading2 yields 2+ sections", async () => {
        const data = await docxFixture({
            styles: stylesXml([
                {id: "Heading1", outlineLvl: 0},
                {id: "Heading2", outlineLvl: 1},
            ]),
            paragraphs: [
                paragraph({text: "Buchtitel", styleId: "Heading1"}),
                paragraph({text: "Abschnitt A", styleId: "Heading2"}),
                paragraph({text: "Text A."}),
                paragraph({text: "Abschnitt B", styleId: "Heading2"}),
                paragraph({text: "Text B."}),
            ],
        });
        const result = await parseDocx(data);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const titles = result.book.sections.map((s) => s.title);
        expect(titles).toContain("Abschnitt A");
        expect(titles).toContain("Abschnitt B");
    });

    it("degrades an unstyled document to one whole-document section", async () => {
        const data = await docxFixture({
            paragraphs: [
                paragraph({text: "Nur Fliesstext."}),
                paragraph({text: "Ohne jede Formatvorlage."}),
            ],
        });
        const result = await parseDocx(data, {
            fallbackSectionLabel: "Ganzes Dokument",
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(1);
        expect(result.book.sections[0].title).toBe("Ganzes Dokument");
        expect(result.book.sections[0].text).toBe(
            "Nur Fliesstext.\n\nOhne jede Formatvorlage.",
        );
    });

    it("keeps a non-empty preamble before the first heading as its own section", async () => {
        const data = await docxFixture({
            paragraphs: [
                paragraph({text: "Vorwort ohne Heading."}),
                paragraph({text: "Eins", outlineLvl: 0}),
                paragraph({text: "A."}),
                paragraph({text: "Zwei", outlineLvl: 0}),
                paragraph({text: "B."}),
            ],
        });
        const result = await parseDocx(data, {
            fallbackSectionLabel: "Abschnitt {n}",
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(3);
        expect(result.book.sections[0].title).toBe("Abschnitt 1");
        expect(result.book.sections[0].text).toBe("Vorwort ohne Heading.");
    });

    it("converts w:br and w:tab inside a run to newline / space", async () => {
        const data = await docxFixture({
            paragraphs: [
                `<w:p><w:r><w:t>Zeile eins</w:t><w:br/><w:t>Zeile zwei</w:t><w:tab/><w:t>nach Tab</w:t></w:r></w:p>`,
            ],
        });
        const result = await parseDocx(data);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections[0].text).toBe(
            "Zeile eins\nZeile zwei nach Tab",
        );
    });

    it("rejects a non-zip payload as invalid_docx", async () => {
        const bytes = new TextEncoder().encode("not a zip at all");
        const result = await parseDocx(bytes.buffer.slice(0) as ArrayBuffer);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("invalid_docx");
    });

    it("rejects a zip without word/document.xml as invalid_docx", async () => {
        const data = await docxFixture({paragraphs: [], omitDocument: true});
        const result = await parseDocx(data);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("invalid_docx");
    });

    it("reports no_sections for a document with only empty paragraphs", async () => {
        const data = await docxFixture({
            paragraphs: ["<w:p/>", `<w:p><w:r><w:t> </w:t></w:r></w:p>`],
        });
        const result = await parseDocx(data);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("no_sections");
    });
});
