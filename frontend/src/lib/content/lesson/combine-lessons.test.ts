import {describe, expect, it} from "vitest";

import {
    buildCombinedSetInput,
    dedupeLessonIds,
    deriveCombinedLanguages,
    gatherLessons,
    uniqueSetId,
    type CombineSource,
} from "./combine-lessons";
import {buildLessonFromDraft} from "./draft-to-lesson";
import {generateExercises} from "./exercise/exercise-generator";
import {buildContentSetZip} from "./lesson-export";
import {parseImportFile} from "./lesson-import";
import type {LessonMeta} from "./lesson-draft";
import type {ContentSetEntry} from "../../../storage/types";

function lesson(title: string, source = "de", target = "fr") {
    const meta: LessonMeta = {
        title,
        titleNative: title,
        sourceLanguage: source,
        targetLanguage: target,
        level: "A1",
        description: "topic",
        author: "Aster",
    };
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const cards = ["un", "deux", "trois", "quatre", "cinq"].map((w, i) => ({
        id: `${slug}-c${i}`,
        front: w,
        back: `n-${i}`,
        notes: "",
        image: "",
    }));
    const exercises = generateExercises(
        cards.map((c) => ({id: c.id, front: c.front, back: c.back})),
        {count: 10, types: ["matching", "free_text"], direction: "auto"},
    );
    return buildLessonFromDraft({meta, cards, exercises});
}

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
    return {
        source: "user-generated",
        branch: "",
        id: "created-a",
        title: "Set A",
        title_native: null,
        language: "fr",
        target_language: "fr",
        source_language: "de",
        level: "A1",
        domain: "imported",
        version: "1.0.0",
        lesson_count: 1,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
        ...over,
    } as ContentSetEntry;
}

function source(id: string, title: string, over: Partial<ContentSetEntry> = {}): CombineSource {
    return {
        entry: entry({id, title, ...over}),
        lessons: [lesson(title)],
    };
}

describe("combine-lessons (#1741)", () => {
    it("gathers all lessons in selection order", () => {
        const sources = [source("created-a", "A"), source("created-b", "B")];
        const all = gatherLessons(sources);
        expect(all).toHaveLength(2);
        expect(all[0].title).toBe("A");
        expect(all[1].title).toBe("B");
    });

    it("de-duplicates colliding lesson ids so no file is overwritten", () => {
        const l1 = lesson("Intro");
        const l2 = lesson("Intro"); // same slug -> same id
        expect(l1.id).toBe(l2.id);
        const deduped = dedupeLessonIds([l1, l2]);
        expect(deduped[0].id).toBe(l1.id);
        expect(deduped[1].id).not.toBe(l1.id);
        expect(new Set(deduped.map((l) => l.id)).size).toBe(2);
    });

    it("derives languages/level and flags a consistent selection", () => {
        const langs = deriveCombinedLanguages([
            source("a", "A"),
            source("b", "B"),
        ]);
        expect(langs.targetLanguage).toBe("fr");
        expect(langs.sourceLanguage).toBe("de");
        expect(langs.level).toBe("A1");
        expect(langs.consistent).toBe(true);
    });

    it("flags an inconsistent selection (mixed languages)", () => {
        const langs = deriveCombinedLanguages([
            source("a", "A"),
            source("b", "B", {target_language: "es", level: "A2"}),
        ]);
        expect(langs.consistent).toBe(false);
    });

    it("uniqueSetId avoids collisions", () => {
        expect(uniqueSetId("created-x", new Set())).toBe("created-x");
        expect(uniqueSetId("created-x", new Set(["created-x"]))).toBe(
            "created-x-2",
        );
        expect(
            uniqueSetId("created-x", new Set(["created-x", "created-x-2"])),
        ).toBe("created-x-3");
    });

    it("builds a NEW combined set from several sources", () => {
        const sources = [source("created-a", "A"), source("created-b", "B")];
        const input = buildCombinedSetInput(
            sources,
            {mode: "new", title: "My Bundle", description: "grouped"},
            new Set(["created-a", "created-b"]),
        );
        expect(input.set_id).toBe("created-my-bundle");
        expect(input.title).toBe("My Bundle");
        expect(input.description).toBe("grouped");
        expect(input.origin).toBe("imported");
        expect(input.target_language).toBe("fr");
        expect(input.lessons).toHaveLength(2);
    });

    it("appends to an EXISTING set, keeping its metadata + own lessons", () => {
        const existing = entry({id: "created-target", title: "Target"});
        const targetLessons = [lesson("Existing one")];
        const sources = [source("created-a", "A")];
        const input = buildCombinedSetInput(sources, {
            mode: "existing",
            entry: existing,
            lessons: targetLessons,
        });
        expect(input.set_id).toBe("created-target");
        expect(input.title).toBe("Target");
        // Existing lesson first, then the appended one.
        expect(input.lessons).toHaveLength(2);
        expect(input.lessons[0].title).toBe("Existing one");
        expect(input.lessons[1].title).toBe("A");
    });

    // Point 5 — the combined set must round-trip through the EXISTING set
    // export (manifest.yaml + lessons/), no parallel format.
    it("round-trips through the set export/import (identical lessons)", async () => {
        const sources = [source("created-a", "A"), source("created-b", "B")];
        const input = buildCombinedSetInput(sources, {
            mode: "new",
            title: "Bundle",
        });
        const blob = await buildContentSetZip(
            {
                set_id: input.set_id,
                title: input.title,
                language: input.language,
                level: input.level,
                description: input.description,
            },
            input.lessons,
        );
        const file = new File([blob], "bundle-set.zip", {
            type: "application/zip",
        });
        const parsed = await parseImportFile(file);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok || !parsed.set) return;
        expect(parsed.set.lessons).toHaveLength(input.lessons.length);
        expect(parsed.set.lessons.map((l) => l.id).sort()).toEqual(
            input.lessons.map((l) => l.id).sort(),
        );
        // A card survives the round-trip byte-for-byte.
        const original = input.lessons.find((l) => l.title === "A");
        const back = parsed.set.lessons.find((l) => l.title === "A");
        expect(back?.cards[0].front).toBe(original?.cards[0].front);
    });
});
