import {describe, it, expect} from "vitest";

import {
    isLikelyNonContentSection,
    defaultSelectedSectionIds,
} from "./section-heuristics";
import type {BookSection} from "./types";

function section(id: string, title: string): BookSection {
    return {id, title, text: "x", charCount: 1};
}

describe("isLikelyNonContentSection", () => {
    it("flags German front/back-matter titles (case-insensitive)", () => {
        for (const title of [
            "Vorwort",
            "vorwort zur zweiten Auflage",
            "Geleitwort",
            "Danksagung",
            "Inhaltsverzeichnis",
            "Inhalt",
            "Glossar",
            "Impressum",
            "Über den Autor",
            "Uber den Autor",
            "Anhang",
            "Anhang A: Tabellen",
            "Literaturverzeichnis",
            "Stichwortverzeichnis",
            "Index",
        ]) {
            expect(isLikelyNonContentSection(title)).toBe(true);
        }
    });

    it("flags English front/back-matter titles", () => {
        for (const title of [
            "Foreword",
            "Preface",
            "Acknowledgments",
            "Acknowledgements",
            "Table of Contents",
            "Contents",
            "Glossary",
            "Imprint",
            "Colophon",
            "About the Author",
            "Appendix",
            "Appendix B",
            "Index",
            "Bibliography",
            "References",
        ]) {
            expect(isLikelyNonContentSection(title)).toBe(true);
        }
    });

    it("flags French front/back-matter titles", () => {
        for (const title of [
            "Préface",
            "Avant-propos",
            "Remerciements",
            "Table des matières",
            "Glossaire",
            "Annexe",
            "Bibliographie",
        ]) {
            expect(isLikelyNonContentSection(title)).toBe(true);
        }
    });

    it("treats real chapter titles as learning content", () => {
        for (const title of [
            "Kapitel 1: Klassische Konditionierung",
            "Einleitung",
            "Introduction to Psychology",
            "Chapter 3 — Operante Konditionierung",
            "Lernen am Modell",
            "The Nervous System",
            "Section 5",
        ]) {
            expect(isLikelyNonContentSection(title)).toBe(false);
        }
    });

    it("ignores leading numbering and separators before the keyword", () => {
        expect(isLikelyNonContentSection("1. Vorwort")).toBe(true);
        expect(isLikelyNonContentSection("I. Preface")).toBe(true);
        expect(isLikelyNonContentSection("  — Glossary")).toBe(true);
    });

    it("does not flag empty or whitespace titles", () => {
        expect(isLikelyNonContentSection("")).toBe(false);
        expect(isLikelyNonContentSection("   ")).toBe(false);
    });
});

describe("defaultSelectedSectionIds", () => {
    it("selects content sections and deselects heuristic matches", () => {
        const sections = [
            section("s1", "Vorwort"),
            section("s2", "Kapitel 1: Reize"),
            section("s3", "Kapitel 2: Verstärkung"),
            section("s4", "Glossar"),
            section("s5", "Index"),
        ];
        expect(defaultSelectedSectionIds(sections)).toEqual(["s2", "s3"]);
    });

    it("returns every id when nothing looks like front/back matter", () => {
        const sections = [section("a", "Chapter 1"), section("b", "Chapter 2")];
        expect(defaultSelectedSectionIds(sections)).toEqual(["a", "b"]);
    });

    it("returns an empty list when every section is excluded", () => {
        const sections = [section("a", "Vorwort"), section("b", "Impressum")];
        expect(defaultSelectedSectionIds(sections)).toEqual([]);
    });
});
