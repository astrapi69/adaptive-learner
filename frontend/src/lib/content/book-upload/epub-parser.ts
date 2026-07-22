/**
 * #1927 — client-side EPUB parser for the Create-Lesson upload.
 *
 * Zero new dependencies: an EPUB is a ZIP (jszip, already shipped) of
 * XML/XHTML (native ``DOMParser``). The chapter list comes from the
 * container's own structure — ``META-INF/container.xml`` names the OPF,
 * the OPF's spine orders the chapters, and titles resolve from the
 * EPUB3 nav document (``properties="nav"``) or the EPUB2 ``toc.ncx``,
 * falling back to the chapter's first ``h1``/``h2``/``h3``, then to a
 * numbered label.
 *
 * Library-grade: no app imports; never throws — every failure returns a
 * machine-readable {@link ParseBookResult} error code.
 */

import JSZip from "jszip";

import {
    fallbackLabel,
    type BookParseOptions,
    type BookSection,
    type ParseBookResult,
} from "./types";

/** Tags whose boundaries become paragraph breaks in the extracted text. */
const BLOCK_TAGS = new Set([
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "blockquote",
    "pre",
    "tr",
    "div",
    "section",
    "article",
    "figcaption",
]);

const SKIP_TAGS = new Set(["script", "style", "head", "svg"]);

/** Resolve ``href`` against the directory of ``basePath`` (zip-relative). */
function resolveHref(basePath: string, href: string): string {
    const cleanHref = href.split("#")[0];
    const baseDir = basePath.includes("/")
        ? basePath.slice(0, basePath.lastIndexOf("/") + 1)
        : "";
    const stack = baseDir.split("/").filter((part) => part !== "");
    for (const part of cleanHref.split("/")) {
        if (part === "" || part === ".") continue;
        if (part === "..") {
            stack.pop();
        } else {
            stack.push(part);
        }
    }
    return stack.join("/");
}

function parseXml(source: string): Document {
    return new DOMParser().parseFromString(source, "text/xml");
}

/** Walk an element tree collecting text, blank-line-separating blocks. */
function extractBlockText(root: Element): string {
    const parts: string[] = [];
    const walk = (node: Node): void => {
        if (node.nodeType === 3) {
            parts.push(node.textContent ?? "");
            return;
        }
        if (node.nodeType !== 1) return;
        const tag = (node as Element).tagName.toLowerCase();
        if (SKIP_TAGS.has(tag)) return;
        if (tag === "br") {
            parts.push("\n");
            return;
        }
        for (const child of Array.from(node.childNodes)) walk(child);
        if (BLOCK_TAGS.has(tag)) parts.push("\n\n");
    };
    walk(root);
    return parts
        .join("")
        .replace(/[ \t\r]+/g, (run) => (run.includes(" ") || run.includes("\t") ? " " : ""))
        .replace(/ ?\n ?/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Map zip-resolved chapter path -> TOC title, from nav doc or ncx. */
function tocTitlesFromNav(navDoc: Document, navPath: string): Map<string, string> {
    const titles = new Map<string, string>();
    const navs = Array.from(navDoc.getElementsByTagName("nav"));
    const toc =
        navs.find((nav) => nav.getAttribute("epub:type") === "toc") ?? navs[0];
    const anchors = toc ? Array.from(toc.getElementsByTagName("a")) : [];
    for (const anchor of anchors) {
        const href = anchor.getAttribute("href");
        const label = anchor.textContent?.trim();
        if (href && label && !titles.has(resolveHref(navPath, href))) {
            titles.set(resolveHref(navPath, href), label);
        }
    }
    return titles;
}

function tocTitlesFromNcx(ncxDoc: Document, ncxPath: string): Map<string, string> {
    const titles = new Map<string, string>();
    for (const navPoint of Array.from(ncxDoc.getElementsByTagName("navPoint"))) {
        const src = navPoint
            .getElementsByTagName("content")[0]
            ?.getAttribute("src");
        const label = navPoint
            .getElementsByTagName("text")[0]
            ?.textContent?.trim();
        if (src && label) {
            const path = resolveHref(ncxPath, src);
            if (!titles.has(path)) titles.set(path, label);
        }
    }
    return titles;
}

interface ManifestItem {
    href: string;
    mediaType: string;
    properties: string;
}

/**
 * Parse an EPUB file's bytes into selectable chapter sections.
 *
 * @param data - The raw ``.epub`` bytes.
 * @param options - Translated fallback-label template.
 * @returns Spine-ordered, non-empty sections; ``invalid_epub`` when the
 *          container structure is broken, ``no_sections`` when every
 *          spine item is empty. Never throws.
 */
export async function parseEpub(
    data: ArrayBuffer,
    options?: BookParseOptions,
): Promise<ParseBookResult> {
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(data);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {ok: false, error: "invalid_epub", detail};
    }
    try {
        const containerXml = await zip
            .file("META-INF/container.xml")
            ?.async("string");
        if (!containerXml) {
            return {
                ok: false,
                error: "invalid_epub",
                detail: "META-INF/container.xml missing",
            };
        }
        const opfPath = parseXml(containerXml)
            .getElementsByTagName("rootfile")[0]
            ?.getAttribute("full-path");
        const opfXml = opfPath ? await zip.file(opfPath)?.async("string") : null;
        if (!opfPath || !opfXml) {
            return {
                ok: false,
                error: "invalid_epub",
                detail: "OPF package document missing",
            };
        }
        const opfDoc = parseXml(opfXml);

        const manifest = new Map<string, ManifestItem>();
        for (const item of Array.from(opfDoc.getElementsByTagName("item"))) {
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            if (!id || !href) continue;
            manifest.set(id, {
                href,
                mediaType: item.getAttribute("media-type") ?? "",
                properties: item.getAttribute("properties") ?? "",
            });
        }

        const titles = await loadTocTitles(zip, opfDoc, opfPath, manifest);

        const sections: BookSection[] = [];
        const spineRefs = Array.from(
            opfDoc.getElementsByTagName("itemref"),
        ).map((ref) => ref.getAttribute("idref"));
        for (const idref of spineRefs) {
            const item = idref ? manifest.get(idref) : undefined;
            if (!item) continue;
            const path = resolveHref(opfPath, item.href);
            const xhtml = await zip.file(path)?.async("string");
            if (!xhtml) continue;
            const doc = parseXml(xhtml);
            const body = doc.getElementsByTagName("body")[0];
            if (!body) continue;
            const text = extractBlockText(body);
            if (text === "") continue;
            const heading = ["h1", "h2", "h3"]
                .map((tag) => doc.getElementsByTagName(tag)[0]?.textContent?.trim())
                .find((value) => value);
            sections.push({
                id: `section-${sections.length + 1}`,
                title:
                    titles.get(path) ??
                    heading ??
                    fallbackLabel(options, sections.length + 1),
                text,
                charCount: text.length,
            });
        }

        if (sections.length === 0) {
            return {ok: false, error: "no_sections"};
        }
        return {ok: true, book: {format: "epub", sections}};
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {ok: false, error: "parse_failed", detail};
    }
}

/** Load chapter titles from the EPUB3 nav doc, else the EPUB2 ncx. */
async function loadTocTitles(
    zip: JSZip,
    opfDoc: Document,
    opfPath: string,
    manifest: Map<string, ManifestItem>,
): Promise<Map<string, string>> {
    for (const [, item] of manifest) {
        if (item.properties.split(/\s+/).includes("nav")) {
            const navPath = resolveHref(opfPath, item.href);
            const navXml = await zip.file(navPath)?.async("string");
            if (navXml) return tocTitlesFromNav(parseXml(navXml), navPath);
        }
    }
    const spine = opfDoc.getElementsByTagName("spine")[0];
    const ncxItem =
        (spine?.getAttribute("toc") && manifest.get(spine.getAttribute("toc")!)) ||
        Array.from(manifest.values()).find(
            (item) => item.mediaType === "application/x-dtbncx+xml",
        );
    if (ncxItem) {
        const ncxPath = resolveHref(opfPath, ncxItem.href);
        const ncxXml = await zip.file(ncxPath)?.async("string");
        if (ncxXml) return tocTitlesFromNcx(parseXml(ncxXml), ncxPath);
    }
    return new Map();
}
