/**
 * Listen-first audio control (#1600 Option A): plays a card's authored
 * pronunciation (``card.audio`` — one file per card, resolved from the
 * set's ``assets/``) before the learner answers a free_text or matching
 * exercise.
 *
 * Resolution reuses the ``useAsset`` chain picture_choice images use:
 * cached blob from the storage layer, keyed by (source, setId, path).
 * When no blob URL can be produced (review/adaptive routes pass no
 * source, cache miss, missing file) the control renders NOTHING — the
 * exercise looks and behaves exactly as it did before #1600. Authored
 * audio is an enhancement, never a gate.
 *
 * Playback is user-initiated (no autoplay — a11y + surprise-audio), via
 * a single toggle button with an i18n'd label.
 */

import {Volume2} from "lucide-react";
import {useEffect, useRef} from "react";

import {useAsset} from "../../../hooks/ui/useAsset";
import {useI18n} from "../../../hooks/ui/useI18n";

export interface ListenFirstAudioProps {
    /** Content source slug ("owner/name"); empty on routes without one. */
    source: string;
    setId: string;
    /** The card's ``audio`` path inside the set's assets, or null/absent. */
    audioPath: string | null | undefined;
}

export default function ListenFirstAudio({
    source,
    setId,
    audioPath,
}: ListenFirstAudioProps) {
    const {t} = useI18n();
    const {url} = useAsset(source, setId, audioPath ?? null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Release the element (and stop playback) when the URL changes or the
    // exercise unmounts, so navigating mid-playback never leaks sound.
    useEffect(() => {
        return () => {
            audioRef.current?.pause();
            audioRef.current = null;
        };
    }, [url]);

    if (!audioPath || audioPath.trim() === "" || !url) return null;

    const play = () => {
        if (!audioRef.current) audioRef.current = new Audio(url);
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
    };

    return (
        <button
            type="button"
            className="mb-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium"
            data-testid="listen-first"
            onClick={play}
            aria-label={t("exercise.listen_first.aria", "Play pronunciation")}
        >
            <Volume2 aria-hidden="true" size={18} />
            {t("exercise.listen_first.label", "Listen first")}
        </button>
    );
}
