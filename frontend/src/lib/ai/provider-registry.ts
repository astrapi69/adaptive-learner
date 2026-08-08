/**
 * provider-registry — the app-level AI provider descriptor set (#2512).
 *
 * The kit's ``BUILTIN_PROVIDERS`` is deliberately only the browser-direct
 * trio (anthropic/openai/gemini — its exhaustive browser clients depend on
 * that), so Perplexity is appended separately from the kit's standalone
 * ``PERPLEXITY_PROVIDER`` descriptor (OpenAI-compatible, ``corsBlocked``:
 * in Dexie mode the settings UI shows it desktop-only; API mode routes it
 * through the ai-perplexity backend plugin).
 *
 * Order mirrors ``AI_PROVIDERS`` (preference order, pinned in
 * ``constants.test.ts``); the registry preserves it for the settings UI.
 * ``AiKeyVaultProvider`` localizes the labels on top of these descriptors;
 * consumers that need no localization (ModelPicker) read this registry
 * directly — ``registry.get`` throws on unknown ids, so the one registry
 * that knows every app provider must be the one they consult.
 */

import {
    BUILTIN_PROVIDERS,
    PERPLEXITY_PROVIDER,
    createProviderRegistry,
    type AiProviderDescriptor,
    type ProviderRegistry,
} from "@astrapi69/ai-key-vault";

import { AI_PROVIDERS, type AIProvider } from "../constants";

/** Every provider descriptor this app offers, in UI order. */
export const APP_PROVIDER_DESCRIPTORS: readonly AiProviderDescriptor<AIProvider>[] = [
    ...(BUILTIN_PROVIDERS.filter((d) =>
        AI_PROVIDERS.includes(d.id as AIProvider),
    ) as readonly AiProviderDescriptor<AIProvider>[]),
    PERPLEXITY_PROVIDER,
];

/** Unlocalized registry over {@link APP_PROVIDER_DESCRIPTORS}. */
export const APP_PROVIDER_REGISTRY: ProviderRegistry<AIProvider> =
    createProviderRegistry(APP_PROVIDER_DESCRIPTORS);
