/**
 * Lazy glossary loader hook (PERF-HELP-GLOSSARY-LAZY-01).
 *
 * The help glossary getters (``getGlossaryEntry`` / ``listGlossaryEntries``)
 * are synchronous but only ENGLISH is bundled eagerly — the other seven
 * languages are lazy per-language chunks. This hook triggers the load for
 * the active language and re-renders the consumer once the localized
 * entries land, so a non-English user sees English first (the eager
 * fallback) and then the localized text a tick later (progressive
 * enhancement). For English it is a no-op.
 *
 * Returns whether the language is loaded; consumers can ignore the value
 * and rely on the re-render alone.
 */

import {useEffect, useState} from "react";

import {
    isGlossaryLoaded,
    loadGlossaryLanguage,
    subscribeGlossary,
} from "../lib/help-glossary";

export function useGlossary(lang: string): boolean {
    const [loaded, setLoaded] = useState(() => isGlossaryLoaded(lang));

    useEffect(() => {
        let active = true;
        const sync = () => {
            if (active) setLoaded(isGlossaryLoaded(lang));
        };
        const unsubscribe = subscribeGlossary(sync);
        void loadGlossaryLanguage(lang).then(sync);
        // Reconcile immediately for the EN / already-loaded case.
        sync();
        return () => {
            active = false;
            unsubscribe();
        };
    }, [lang]);

    return loaded;
}
