/**
 * Dexie-mode system-info namespace (#1786).
 *
 * Pins the SystemInfo shape the About tab renders in Dexie mode -
 * the synthesised fields the browser cannot know must come through
 * as null / placeholder so the UI hides the matching rows (the
 * i18n + reset namespaces in this module are covered by
 * dexie-storage.test.ts).
 */

import {describe, expect, it} from "vitest";

import {dexieSystem} from "./dexie-system";

describe("dexieSystem.info", () => {
    it("synthesises the SystemInfo shape with browser-safe fields", async () => {
        const info = await dexieSystem.info();
        expect(info.app.name).toBe("Adaptive Learner");
        expect(info.app.version).toBeTruthy();
        expect(info.app.license).toBe("MIT");
        expect(info.runtime.python_version).toBeNull();
        expect(info.dependencies.fastapi).toBeNull();
        expect(info.dependencies.pluginforge).toBeNull();
        expect(info.paths.database_path).toBe(
            "Local Browser Storage (IndexedDB)",
        );
        expect(info.paths.data_directory).toBe(
            "Local Browser Storage (IndexedDB)",
        );
    });
});
