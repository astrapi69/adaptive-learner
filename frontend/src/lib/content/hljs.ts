/**
 * Curated highlight.js instance for the lesson content viewer.
 *
 * Importing ``highlight.js`` (the default entry) pulls in ALL ~190
 * language grammars — ~296 KB gzip, dominated by languages no
 * learning-content domain uses (mathematica, 1c, x86asm, sqf, …).
 * See docs/audits/performance-audit-2026-06-03.md F-2.
 *
 * Instead we import ``highlight.js/lib/core`` and register only the
 * grammars the content actually uses, mirroring the curated set in
 * ``src/components/editor/code-block-config.ts``. ``highlightAuto``
 * still works across exactly these registered languages. This module
 * is itself dynamically imported by ``CodeBlock`` so non-code lessons
 * never pay for it.
 */

import hljs from "highlight.js/lib/core";

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

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml); // highlight.js ships HTML under the xml grammar.
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

export default hljs;
