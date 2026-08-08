/**
 * Pins the app provider registry (#2512): Perplexity joins as the
 * fourth provider via the kit's ready descriptor — OpenAI-compatible,
 * corsBlocked, therefore desktop-only in a browser runtime.
 */

import { describe, expect, it } from "vitest";

import { providerKeyStatus } from "@astrapi69/ai-key-vault";

import { AI_PROVIDERS } from "../constants";
import { APP_PROVIDER_REGISTRY } from "./provider-registry";

describe("APP_PROVIDER_REGISTRY", () => {
    it("contains every AI_PROVIDERS id, in the pinned preference order", () => {
        expect(APP_PROVIDER_REGISTRY.all().map((d) => d.id)).toEqual([...AI_PROVIDERS]);
    });

    it("includes Perplexity as an OpenAI-compatible, CORS-blocked provider", () => {
        const perplexity = APP_PROVIDER_REGISTRY.get("perplexity");
        expect(perplexity.baseUrl).toBe("https://api.perplexity.ai");
        expect(perplexity.corsBlocked).toBe(true);
        expect(perplexity.keyFormat?.prefix).toBe("pplx-");
        expect(perplexity.recommendedModels).toContain("sonar-pro");
    });

    it("classifies Perplexity desktop_only in a browser runtime (no dead menu item)", () => {
        const status = providerKeyStatus({
            hasKey: true,
            source: "settings",
            browser: true,
            corsBlocked: APP_PROVIDER_REGISTRY.get("perplexity").corsBlocked ?? false,
        });
        expect(status).toBe("desktop_only");
    });

    it("keeps the browser-direct trio callable in a browser runtime", () => {
        for (const id of ["anthropic", "openai", "gemini"] as const) {
            const status = providerKeyStatus({
                hasKey: true,
                source: "settings",
                browser: true,
                corsBlocked: APP_PROVIDER_REGISTRY.get(id).corsBlocked ?? false,
            });
            expect(status).toBe("active");
        }
    });
});
