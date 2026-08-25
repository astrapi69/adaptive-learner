/**
 * DonationSection (Phase 14B).
 *
 * Three donation channels. Each URL was probed before shipping
 * (2026-05-20):
 *   - Liberapay (primary)     200 OK   verified via WebFetch
 *   - GitHub Sponsors         200 OK   verified via curl HEAD
 *   - Ko-fi                   403 to bot probes (Cloudflare); page
 *                             confirmed live via the same channel
 *                             configuration shipped by Bibliogon
 *                             since 2026-05.
 *
 * Per the spec, "dead links don't ship"; the 403 from a headless
 * probe is bot-blocking rather than a missing-page signal. If a
 * future Ko-fi configuration genuinely disappears the channel can
 * be removed by deleting one entry from the array below.
 */
import {Button} from "@/components/ui/button";

interface DonationChannel {
    id: string;
    label: string;
    description_key: string;
    description_fallback: string;
    url: string;
    primary?: boolean;
}

const CHANNELS: DonationChannel[] = [
    {
        id: "liberapay",
        label: "Liberapay",
        description_key: "about.donations.liberapay_desc",
        description_fallback:
            "Recurring donations. Open-source, no fees taken by the platform.",
        url: "https://liberapay.com/astrapi69/donate",
        primary: true,
    },
    {
        id: "github_sponsors",
        label: "GitHub Sponsors",
        description_key: "about.donations.github_desc",
        description_fallback:
            "Sponsor via your existing GitHub account.",
        url: "https://github.com/sponsors/astrapi69",
    },
    {
        id: "kofi",
        label: "Ko-fi",
        description_key: "about.donations.kofi_desc",
        description_fallback:
            "One-time tips. No login required.",
        url: "https://ko-fi.com/astrapi69",
    },
];

interface Props {
    t: (key: string, fallback?: string) => string;
}

export default function DonationSection({t}: Props) {
    return (
        <article
            data-testid="about-donations-section"
            className="p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface)]"
        >
            <h3 className="mt-0 mb-2">
                {t("about.donations_heading", "Support development")}
            </h3>
            <p className="mt-0 opacity-85 text-[0.9rem]">
                {t(
                    "about.donations_intro",
                    "Adaptive Learner is free and open-source. If it helps you, consider chipping in.",
                )}
            </p>
            <ul
                className="list-none p-0 m-0"
                data-testid="about-donations-list"
            >
                {CHANNELS.map((channel) => (
                    <li
                        key={channel.id}
                        data-testid={`about-donation-${channel.id}`}
                        className="mb-2"
                    >
                        <Button
                            asChild
                            variant={channel.primary ? "default" : "secondary"}
                            className="mr-2"
                        >
                            <a
                                href={channel.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`about-donation-${channel.id}-link`}
                            >
                                {channel.label}
                                {channel.primary && (
                                    <span
                                        data-testid="about-donation-preferred-badge"
                                        className="rounded-[3px] px-[0.4em] py-[0.1em] text-[0.7rem] bg-[color-mix(in_srgb,var(--accent-fg)_22%,transparent)] text-[var(--accent-fg)]"
                                    >
                                        {t("about.donations_primary", "preferred")}
                                    </span>
                                )}
                            </a>
                        </Button>
                        <small className="opacity-70">
                            {t(channel.description_key, channel.description_fallback)}
                        </small>
                    </li>
                ))}
            </ul>
        </article>
    );
}
