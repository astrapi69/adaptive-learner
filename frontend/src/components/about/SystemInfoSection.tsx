/**
 * SystemInfoSection (Phase 14B).
 *
 * Backend runtime + bundled-dependency versions + data paths. In
 * API mode every row renders. In Dexie storage mode the backend
 * versions are null (no FastAPI/SQLAlchemy reachable) and the
 * paths surface as "Local Browser Storage (IndexedDB)"; we hide
 * the Python + backend-dependency rows in that mode rather than
 * render a column of "unknown".
 */

import type {StorageMode} from "../../storage";
import type {SystemInfo} from "../../types/domain";

interface Props {
    info: SystemInfo;
    storageMode: StorageMode;
    t: (key: string, fallback?: string) => string;
}

export default function SystemInfoSection({info, storageMode, t}: Props) {
    const isDexie = storageMode === "dexie";
    const depRow = (label: string, version: string | null, testid: string) =>
        version === null && isDexie ? null : (
            <>
                <dt>
                    <strong>{label}</strong>
                </dt>
                <dd data-testid={testid} style={ddStyle}>
                    {version ?? t("about.dep_unknown", "unknown")}
                </dd>
            </>
        );
    return (
        <article
            data-testid="about-system-section"
            style={sectionStyle}
        >
            <h3 style={{marginTop: 0, marginBottom: 12}}>
                {t("about.system_heading", "System")}
            </h3>
            <dl style={dlStyle}>
                <dt>
                    <strong>{t("about.storage_label", "Storage")}</strong>
                </dt>
                <dd data-testid="about-storage-mode" style={ddStyle}>
                    {isDexie
                        ? t("about.storage_dexie", "Local Browser Storage (IndexedDB)")
                        : t("about.storage_api", "Server (FastAPI + SQLite)")}
                </dd>
                <dt>
                    <strong>{t("about.data_dir_label", "Data directory")}</strong>
                </dt>
                <dd data-testid="about-data-dir" style={ddStyle}>
                    {info.paths.data_directory}
                </dd>
                {!isDexie && (
                    <>
                        <dt>
                            <strong>
                                {t("about.db_path_label", "Database path")}
                            </strong>
                        </dt>
                        <dd data-testid="about-db-path" style={ddStyle}>
                            {info.paths.database_path}
                        </dd>
                    </>
                )}
                {!isDexie && info.runtime.python_version && (
                    <>
                        <dt>
                            <strong>Python</strong>
                        </dt>
                        <dd data-testid="about-python-version" style={ddStyle}>
                            {info.runtime.python_version}
                        </dd>
                    </>
                )}
                <dt>
                    <strong>{t("about.platform_label", "Platform")}</strong>
                </dt>
                <dd data-testid="about-platform" style={ddStyle}>
                    {info.runtime.platform_system}
                    {info.runtime.platform_release
                        ? ` ${info.runtime.platform_release}`
                        : ""}
                    {info.runtime.platform_machine
                        ? ` (${info.runtime.platform_machine})`
                        : ""}
                </dd>
                {depRow("FastAPI", info.dependencies.fastapi, "about-dep-fastapi")}
                {depRow(
                    "SQLAlchemy",
                    info.dependencies.sqlalchemy,
                    "about-dep-sqlalchemy",
                )}
                {depRow("Pydantic", info.dependencies.pydantic, "about-dep-pydantic")}
                {depRow(
                    "PluginForge",
                    info.dependencies.pluginforge,
                    "about-dep-pluginforge",
                )}
            </dl>
        </article>
    );
}

const sectionStyle: React.CSSProperties = {
    padding: 16,
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface)",
};

const dlStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    gap: "4px 16px",
    fontSize: "0.9rem",
    margin: 0,
};

const ddStyle: React.CSSProperties = {margin: 0, wordBreak: "break-all"};
