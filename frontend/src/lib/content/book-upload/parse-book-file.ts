/**
 * #1927 — entry point: dispatch an uploaded book file to its parser.
 *
 * Guards the size cap BEFORE reading the file, then routes by extension:
 * ``.epub`` -> {@link parseEpub}, ``.docx`` -> {@link parseDocx},
 * ``.txt``/``.md``/``.markdown`` -> {@link parseTextOrMarkdown}.
 */

import {parseDocx} from "./docx-parser";
import {parseEpub} from "./epub-parser";
import {MAX_BOOK_FILE_SIZE} from "./limits";
import {parseTextOrMarkdown} from "./text-parser";
import type {BookParseOptions, ParseBookResult} from "./types";

/** File extensions accepted by the upload input. */
export const ACCEPTED_BOOK_EXTENSIONS = [
    ".epub",
    ".docx",
    ".txt",
    ".md",
    ".markdown",
];

function extensionOf(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Parse an uploaded book file into selectable sections.
 *
 * @param file - The picked ``File``.
 * @param options - Translated fallback-label template.
 * @returns The parsed sections or a machine-readable error code
 *          (``file_too_large`` / ``unsupported_format`` / parser codes).
 *          Never throws.
 */
export async function parseBookFile(
    file: File,
    options?: BookParseOptions,
): Promise<ParseBookResult> {
    if (file.size > MAX_BOOK_FILE_SIZE) {
        return {ok: false, error: "file_too_large"};
    }
    const extension = extensionOf(file.name);
    try {
        if (extension === ".epub") {
            return await parseEpub(await file.arrayBuffer(), options);
        }
        if (extension === ".docx") {
            return await parseDocx(await file.arrayBuffer(), options);
        }
        if ([".txt", ".md", ".markdown"].includes(extension)) {
            return parseTextOrMarkdown(await file.text(), options);
        }
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {ok: false, error: "parse_failed", detail};
    }
    return {ok: false, error: "unsupported_format", detail: extension};
}
