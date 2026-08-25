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
                <dd data-testid={testid} className="m-0 min-w-0 break-all">
                    {version ?? t("about.dep_unknown", "unknown")}
                </dd>
            </>
        );
    return (
        <article
            data-testid="about-system-section"
            className="p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface)]"
        >
            <h3 className="mt-0 mb-3">
                {t("about.system_heading", "System")}
            </h3>
            <dl className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.9rem] m-0">
                <dt>
                    <strong>{t("about.storage_label", "Storage")}</strong>
                </dt>
                <dd data-testid="about-storage-mode" className="m-0 min-w-0 break-all">
                    {isDexie
                        ? t("about.storage_dexie", "Local Browser Storage (IndexedDB)")
                        : t("about.storage_api", "Server (FastAPI + SQLite)")}
                </dd>
                <dt>
                    <strong>{t("about.data_dir_label", "Data directory")}</strong>
                </dt>
                <dd data-testid="about-data-dir" className="m-0 min-w-0 break-all">
                    {info.paths.data_directory}
                </dd>
                {!isDexie && (
                    <>
                        <dt>
                            <strong>
                                {t("about.db_path_label", "Database path")}
                            </strong>
                        </dt>
                        <dd data-testid="about-db-path" className="m-0 min-w-0 break-all">
                            {info.paths.database_path}
                        </dd>
                    </>
                )}
                {!isDexie && info.runtime.python_version && (
                    <>
                        <dt>
                            <strong>Python</strong>
                        </dt>
                        <dd data-testid="about-python-version" className="m-0 min-w-0 break-all">
                            {info.runtime.python_version}
                        </dd>
                    </>
                )}
                <dt>
                    <strong>{t("about.platform_label", "Platform")}</strong>
                </dt>
                <dd data-testid="about-platform" className="m-0 min-w-0 break-all">
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
