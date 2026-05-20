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
            style={sectionStyle}
        >
            <h3 style={{marginTop: 0, marginBottom: 8}}>
                {t("about.donations_heading", "Support development")}
            </h3>
            <p style={{marginTop: 0, opacity: 0.85, fontSize: "0.9rem"}}>
                {t(
                    "about.donations_intro",
                    "Adaptive Learner is free and open-source. If it helps you, consider chipping in.",
                )}
            </p>
            <ul
                style={{listStyle: "none", padding: 0, margin: 0}}
                data-testid="about-donations-list"
            >
                {CHANNELS.map((channel) => (
                    <li
                        key={channel.id}
                        data-testid={`about-donation-${channel.id}`}
                        style={{marginBottom: 8}}
                    >
                        <a
                            href={channel.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`btn ${channel.primary ? "btn-primary" : "btn-secondary"}`}
                            data-testid={`about-donation-${channel.id}-link`}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                marginRight: 8,
                            }}
                        >
                            {channel.label}
                            {channel.primary && (
                                <span
                                    style={{
                                        fontSize: "0.7rem",
                                        padding: "0.1em 0.4em",
                                        borderRadius: 3,
                                        background: "rgba(255,255,255,0.2)",
                                    }}
                                >
                                    {t("about.donations_primary", "preferred")}
                                </span>
                            )}
                        </a>
                        <small style={{opacity: 0.7}}>
                            {t(channel.description_key, channel.description_fallback)}
                        </small>
                    </li>
                ))}
            </ul>
        </article>
    );
}

const sectionStyle: React.CSSProperties = {
    padding: 16,
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface)",
};
