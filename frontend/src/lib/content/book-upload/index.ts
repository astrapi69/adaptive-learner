/**
 * #1927 — barrel for the Create-Lesson book file upload parsers.
 */
export {parseDocx} from "./docx-parser";
export {parseEpub} from "./epub-parser";
export {
    MAX_BOOK_FILE_SIZE,
    MAX_SECTION_CHARS,
    SOFT_SECTION_CHARS,
} from "./limits";
export {ACCEPTED_BOOK_EXTENSIONS, parseBookFile} from "./parse-book-file";
export {parseTextOrMarkdown} from "./text-parser";
export {
    isLikelyNonContentSection,
    defaultSelectedSectionIds,
} from "./section-heuristics";
export type {
    BookFormat,
    BookParseErrorCode,
    BookParseOptions,
    BookSection,
    ParseBookResult,
    ParsedBook,
} from "./types";
