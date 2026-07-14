/**
 * AboutTab integration + per-section tests (Phase 14B).
 *
 * Mocks the storage layer's ``system.info()`` so the parent's
 * fetch-and-render path is exercised without a backend, and each
 * sub-section is rendered against representative payloads.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import AboutTab from "./AboutTab";
import CreditsSection from "./CreditsSection";
import DonationSection from "./DonationSection";
import LicenseResourcesSection from "./LicenseResourcesSection";
import SystemInfoSection from "./SystemInfoSection";
import VersionSection from "./VersionSection";
import {I18nProvider} from "../../hooks/ui/useI18n";
import {_resetStorageCacheForTests} from "../../storage";
import type {SystemInfo} from "../../types/domain";

vi.mock("../../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

const apiInfo: SystemInfo = {
    app: {
        name: "Adaptive Learner",
        version: "1.1.0",
        license: "MIT",
        authors: ["Asterios Raptis"],
        repository_url: "https://github.com/astrapi69/adaptive-learner",
        issues_url: "https://github.com/astrapi69/adaptive-learner/issues",
        docs_url: "https://astrapi69.github.io/adaptive-learner/docs/",
        build_hash: "abcdef0",
        build_date: "2026-05-20T10:00:00+00:00",
    },
    runtime: {
        python_version: "3.12.3",
        platform_system: "Linux",
        platform_release: "6.8.0",
        platform_machine: "x86_64",
    },
    dependencies: {
        fastapi: "0.136.0",
        sqlalchemy: "2.0.36",
        pydantic: "2.13.4",
        pluginforge: "0.7.0",
    },
    paths: {
        database_path: "/home/u/.local/share/adaptive_learner/adaptive_learner.db",
        data_directory: "/home/u/.local/share/adaptive_learner",
    },
};

const dexieInfo: SystemInfo = {
    ...apiInfo,
    app: {...apiInfo.app, build_hash: "unknown", build_date: "unknown"},
    runtime: {
        python_version: null,
        platform_system: "browser",
        platform_release: "Mozilla/5.0",
        platform_machine: "",
    },
    dependencies: {
        fastapi: null,
        sqlalchemy: null,
        pydantic: null,
        pluginforge: null,
    },
    paths: {
        database_path: "Local Browser Storage (IndexedDB)",
        data_directory: "Local Browser Storage (IndexedDB)",
    },
};

beforeEach(() => {
    localStorage.clear();
    _resetStorageCacheForTests();
});

afterEach(() => {
    vi.restoreAllMocks();
});

function tFn(_key: string, fallback?: string): string {
    return fallback ?? _key;
}

// ---- VersionSection -------------------------------------------------

describe("VersionSection", () => {
    it("renders version, build hash link, build date", () => {
        render(<VersionSection info={apiInfo} t={tFn} />);
        expect(screen.getByTestId("about-app-version").textContent).toContain(
            "1.1.0",
        );
        const link = screen.getByTestId("about-build-hash-link");
        expect(link.getAttribute("href")).toBe(
            "https://github.com/astrapi69/adaptive-learner/commit/abcdef0",
        );
        expect(link.textContent).toBe("abcdef0");
        const date = screen.getByTestId("about-build-date");
        // Locale-formatted; just check it's not the raw ISO.
        expect(date.textContent).not.toBe("2026-05-20T10:00:00+00:00");
    });

    it("renders the 'unknown' sentinel without a commit link", () => {
        render(<VersionSection info={dexieInfo} t={tFn} />);
        expect(screen.queryByTestId("about-build-hash-link")).toBeNull();
        expect(screen.getByTestId("about-build-hash").textContent).toBe(
            "unknown",
        );
        expect(screen.getByTestId("about-build-date").textContent).toBe(
            "unknown",
        );
    });
});

// ---- SystemInfoSection ----------------------------------------------

describe("SystemInfoSection", () => {
    it("renders Python + backend deps in API mode", () => {
        render(<SystemInfoSection info={apiInfo} storageMode="api" t={tFn} />);
        expect(screen.getByTestId("about-storage-mode").textContent).toContain(
            "Server",
        );
        expect(screen.getByTestId("about-python-version").textContent).toBe(
            "3.12.3",
        );
        expect(screen.getByTestId("about-dep-fastapi").textContent).toBe(
            "0.136.0",
        );
        expect(screen.getByTestId("about-db-path")).toBeTruthy();
    });

    it("hides Python + null backend deps in Dexie mode", () => {
        render(
            <SystemInfoSection info={dexieInfo} storageMode="dexie" t={tFn} />,
        );
        expect(screen.getByTestId("about-storage-mode").textContent).toContain(
            "Local Browser Storage",
        );
        expect(screen.queryByTestId("about-python-version")).toBeNull();
        expect(screen.queryByTestId("about-dep-fastapi")).toBeNull();
        expect(screen.queryByTestId("about-db-path")).toBeNull();
    });

    it("renders 'unknown' for a null dep in API mode", () => {
        const partial: SystemInfo = {
            ...apiInfo,
            dependencies: {...apiInfo.dependencies, sqlalchemy: null},
        };
        render(<SystemInfoSection info={partial} storageMode="api" t={tFn} />);
        expect(screen.getByTestId("about-dep-sqlalchemy").textContent).toBe(
            "unknown",
        );
    });
});

// ---- CreditsSection -------------------------------------------------

describe("CreditsSection", () => {
    it("renders author + GitHub link + tagline", () => {
        render(<CreditsSection t={tFn} />);
        expect(screen.getByTestId("about-author").textContent).toContain(
            "Asterios Raptis",
        );
        expect(
            screen.getByTestId("about-author-github").getAttribute("href"),
        ).toBe("https://github.com/astrapi69");
        expect(screen.getByTestId("about-tagline").textContent).toContain(
            "self-directed",
        );
    });

    it("lists the canonical dependency acknowledgements", () => {
        render(<CreditsSection t={tFn} />);
        const deps = screen.getByTestId("about-deps-list").textContent ?? "";
        for (const name of ["React", "FastAPI", "PluginForge", "Dexie"]) {
            expect(deps).toContain(name);
        }
    });

    it("credits the AI assistance (Claude / Anthropic)", () => {
        render(<CreditsSection t={tFn} />);
        expect(
            screen.getByTestId("about-ai-assistance").textContent,
        ).toContain("Claude (Anthropic)");
    });
});

// ---- DonationSection ------------------------------------------------

describe("DonationSection", () => {
    it("renders all three verified channels", () => {
        render(<DonationSection t={tFn} />);
        expect(
            screen.getByTestId("about-donation-liberapay-link").getAttribute("href"),
        ).toBe("https://liberapay.com/astrapi69/donate");
        expect(
            screen.getByTestId("about-donation-github_sponsors-link").getAttribute("href"),
        ).toBe("https://github.com/sponsors/astrapi69");
        expect(
            screen.getByTestId("about-donation-kofi-link").getAttribute("href"),
        ).toBe("https://ko-fi.com/astrapi69");
    });

    it("flags the primary (Liberapay) channel", () => {
        render(<DonationSection t={tFn} />);
        const liberapay = screen.getByTestId("about-donation-liberapay-link");
        expect(liberapay.textContent).toContain("preferred");
    });

    it("each donation link is target=_blank with rel=noopener noreferrer", () => {
        render(<DonationSection t={tFn} />);
        const list = screen.getByTestId("about-donations-list");
        const anchors = list.querySelectorAll("a");
        expect(anchors.length).toBe(3);
        anchors.forEach((a) => {
            expect(a.getAttribute("target")).toBe("_blank");
            expect(a.getAttribute("rel")).toBe("noopener noreferrer");
        });
    });
});

// ---- LicenseResourcesSection ----------------------------------------

describe("LicenseResourcesSection", () => {
    it("renders license + repo + docs + issues links", () => {
        render(
            <MemoryRouter>
                <LicenseResourcesSection info={apiInfo} t={tFn} lang="de" />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("about-license").textContent).toContain(
            "MIT",
        );
        expect(
            screen.getByTestId("about-license-link").getAttribute("href"),
        ).toBe(
            "https://github.com/astrapi69/adaptive-learner/blob/main/LICENSE",
        );
        expect(
            screen.getByTestId("about-repo-link").getAttribute("href"),
        ).toBe("https://github.com/astrapi69/adaptive-learner");
        expect(
            screen.getByTestId("about-docs-link").getAttribute("href"),
        ).toBe("https://astrapi69.github.io/adaptive-learner/docs/");
        expect(
            screen.getByTestId("about-issues-link").getAttribute("href"),
        ).toBe("https://github.com/astrapi69/adaptive-learner/issues");
    });

    it("links to the App-Tutorial set deep link (#1572)", () => {
        render(
            <MemoryRouter>
                <LicenseResourcesSection info={apiInfo} t={tFn} lang="de" />
            </MemoryRouter>,
        );
        expect(
            screen.getByTestId("about-tutorial-link").getAttribute("href"),
        ).toBe("/content/set/adaptive-learner-app-from-de");
    });

    it("points the docs link at the active UI language (#866)", () => {
        render(
            <MemoryRouter>
                <LicenseResourcesSection info={apiInfo} t={tFn} lang="el" />
            </MemoryRouter>,
        );
        expect(
            screen.getByTestId("about-docs-link").getAttribute("href"),
        ).toBe("https://astrapi69.github.io/adaptive-learner/docs/el/");
    });

    it("falls the docs link back to English for an unbuilt locale (#866)", () => {
        render(
            <MemoryRouter>
                <LicenseResourcesSection info={apiInfo} t={tFn} lang="ko" />
            </MemoryRouter>,
        );
        expect(
            screen.getByTestId("about-docs-link").getAttribute("href"),
        ).toBe("https://astrapi69.github.io/adaptive-learner/docs/en/");
    });
});

// ---- AboutTab (integration) -----------------------------------------

describe("AboutTab", () => {
    it("renders all five sub-sections after info loads (API mode)", async () => {
        const {getStorage} = await import("../../storage");
        vi.spyOn(getStorage().system, "info").mockResolvedValue(apiInfo);
        render(
            <MemoryRouter>
                <I18nProvider>
                    <AboutTab />
                </I18nProvider>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("about-content")).toBeTruthy();
        });
        expect(screen.getByTestId("about-version-section")).toBeTruthy();
        expect(screen.getByTestId("about-system-section")).toBeTruthy();
        expect(screen.getByTestId("about-credits-section")).toBeTruthy();
        expect(screen.getByTestId("about-donations-section")).toBeTruthy();
        expect(screen.getByTestId("about-license-section")).toBeTruthy();
    });

    it("shows the error state when system.info() throws", async () => {
        const {getStorage} = await import("../../storage");
        vi.spyOn(getStorage().system, "info").mockRejectedValue(
            new Error("backend unreachable"),
        );
        render(
            <MemoryRouter>
                <I18nProvider>
                    <AboutTab />
                </I18nProvider>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("about-error")).toBeTruthy();
        });
        expect(screen.getByTestId("about-error").textContent).toContain(
            "backend unreachable",
        );
    });

    it("uses Dexie's synthetic payload when storage mode is dexie", async () => {
        localStorage.setItem("adaptive-learner.storage_mode", "dexie");
        _resetStorageCacheForTests();
        const {getStorage} = await import("../../storage");
        vi.spyOn(getStorage().system, "info").mockResolvedValue(dexieInfo);
        render(
            <MemoryRouter>
                <I18nProvider>
                    <AboutTab />
                </I18nProvider>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("about-content")).toBeTruthy();
        });
        // I18nProvider defaults to lang="de" and loads the bundled DE
        // catalog (Phase 29F hotfix), so the storage-mode label resolves
        // to its DE translation. The catalog is now a lazily-imported
        // per-language chunk (perf F-1, v1.56.0), so wait for the DE
        // string to land rather than reading it synchronously.
        await waitFor(() =>
            expect(
                screen.getByTestId("about-storage-mode").textContent,
            ).toContain("Lokaler Browser-Speicher"),
        );
        // Python row hidden in dexie mode.
        expect(screen.queryByTestId("about-python-version")).toBeNull();
    });
});
