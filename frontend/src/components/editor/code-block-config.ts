/**
 * Phase 27D code-block configuration: lowlight registry +
 * configured ``CodeBlockLowlight`` extension.
 *
 * The lowlight registry is module-level: every editor mounted
 * during the app's lifetime shares the same configured
 * grammars. Grammars are imported individually (per
 * highlight.js's tree-shaking-friendly path) rather than via
 * ``common`` so the bundle only carries the languages the MVP
 * picker exposes.
 */

import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {ReactNodeViewRenderer} from "@tiptap/react";
import {createLowlight} from "lowlight";

import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

import CodeBlockView from "./CodeBlockView";

/** Module-level lowlight registry. Languages register once. */
const lowlight = createLowlight();
lowlight.register("bash", bash);
lowlight.register("css", css);
lowlight.register("html", xml); // highlight.js ships HTML under the xml grammar.
lowlight.register("java", java);
lowlight.register("javascript", javascript);
lowlight.register("json", json);
lowlight.register("markdown", markdown);
lowlight.register("python", python);
lowlight.register("sql", sql);
lowlight.register("typescript", typescript);
lowlight.register("yaml", yaml);

/** The configured CodeBlockLowlight extension. Replaces
 *  StarterKit's plain ``codeBlock`` (StarterKit must be
 *  configured with ``codeBlock: false`` when adding this). */
export const codeBlockExtension = CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: null,
    HTMLAttributes: {class: "code-block-lowlight"},
}).extend({
    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView);
    },
});

/** Exposed for tests + consumers that want to read which
 *  languages are registered. Mirrors the picker in
 *  ``CodeBlockView``. */
export const SUPPORTED_LANGUAGES = [
    "bash",
    "css",
    "html",
    "java",
    "javascript",
    "json",
    "markdown",
    "python",
    "sql",
    "typescript",
    "yaml",
] as const;
