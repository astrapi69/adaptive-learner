/**
 * PluginLifecycleSection (#3055, PLUGINFORGE-LIFECYCLE-UI-01): the
 * "Installed plugins" card of Settings > Plugins.
 *
 * Lists every plugin the desktop app's PluginForge host loaded, with the
 * v0.9.0 lifecycle metadata the backend exposes per plugin
 * (``GET /api/plugins/inspect/{name}``): version, source (package entry
 * point or direct registration), activation time, and a marker for a
 * load error, a discovery filter or a config change after activation.
 * The plugin names come from ``plugins.health()`` (the active set), the
 * details from one ``plugins.inspect(name)`` each, both through
 * ``getStorage()`` so no component talks to ``api.*`` directly.
 *
 * Desktop-only by nature (a browser build has no plugin host): the
 * ``PLUGIN_LIFECYCLE`` feature resolves to ``disabled`` in Dexie mode and
 * the card stays visible with the desktop-only notice (#335), without
 * making a request. Loading, empty and failed reads are visible states;
 * a failed read also reaches the toast layer with the API detail.
 *
 * @example
 * <PluginLifecycleSection />
 */

import { Feature } from "@astrapi69/feature-strategy-react";
import { Monitor } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "../../../api/client";
import type { PluginInspection } from "../../../api/client-core";
import { FEATURES } from "../../../features/featureConfig";
import { useI18n } from "../../../hooks/ui/useI18n";
import { getStorage } from "../../../storage";
import { notify } from "../../../utils/notify";
import { SettingsSection } from "../SettingsSection";

type Translate = ReturnType<typeof useI18n>["t"];
type PluginState = PluginInspection["state"];

interface InspectionRead {
  rows: PluginInspection[] | null;
  error: string | null;
  loading: boolean;
}

/** The active plugin names (sorted) and one inspection per name. */
async function readInspections(): Promise<PluginInspection[]> {
  const storage = getStorage();
  const health = await storage.plugins.health();
  const names = Object.keys(health).sort((a, b) => a.localeCompare(b));
  return Promise.all(names.map((name) => storage.plugins.inspect(name)));
}

/** Loads the inspections once on mount; surfaces a failure inline and as a toast. */
function useInspections(t: Translate): InspectionRead {
  const [read, setRead] = useState<InspectionRead>({ rows: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    readInspections()
      .then((rows) => {
        if (!cancelled) setRead({ rows, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.detail : String(err);
        setRead({ rows: null, error: message, loading: false });
        notify.error(
          t("settings.plugins_error_load", "Could not read the plugin status") + ": " + message,
        );
      });
    return () => {
      cancelled = true;
    };
    // ``t`` is deliberately not a dependency: the provider rebuilds it on
    // every catalog (re)load and a re-run would refetch for nothing; only
    // the error toast reads it (lessons/frontend.md "the t function isn't
    // stable").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return read;
}

/** Localized activation timestamp, or a dash when the host recorded none. */
function formatActivated(iso: string | null, lang: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
}

/** True when the plugin's config changed after its activation. */
function configChangedAfterActivation(state: PluginState): boolean {
  return Boolean(
    state.last_config_change &&
      state.activated_at &&
      state.last_config_change > state.activated_at,
  );
}

function sourceLabel(source: PluginState["source"], t: Translate): string {
  if (source === "entry_point") return t("settings.plugins_source_entry_point", "Package");
  if (source === "direct_register") {
    return t("settings.plugins_source_direct", "Registered directly");
  }
  return "-";
}

const MARKER_TONE = {
  error: "border-error text-error",
  warning: "border-warning text-warning",
  muted: "border-border text-fg-muted",
} as const;

interface MarkerProps {
  testid: string;
  tone: keyof typeof MARKER_TONE;
  label: string;
  detail?: string | null;
}

function Marker({ testid, tone, label, detail }: MarkerProps) {
  return (
    <span
      data-testid={testid}
      className={`rounded-app border px-1.5 py-0.5 text-xs ${MARKER_TONE[tone]}`}
    >
      <span className="font-medium">{label}</span>
      {detail ? `: ${detail}` : null}
    </span>
  );
}

interface PluginRowProps {
  row: PluginInspection;
  lang: string;
  t: Translate;
}

function PluginRow({ row, lang, t }: PluginRowProps) {
  const { name, version, state } = row;
  return (
    <li
      data-testid={`plugin-lifecycle-row-${name}`}
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-app border border-border bg-bg-elevated px-3 py-2 text-sm"
    >
      <span className="font-medium text-fg-primary">{name}</span>
      <span className="text-fg-muted">
        {version} · {sourceLabel(state.source, t)} · {formatActivated(state.activated_at, lang)}
      </span>
      {state.load_error ? (
        <Marker
          testid={`plugin-lifecycle-marker-load-error-${name}`}
          tone="error"
          label={t("settings.plugins_marker_load_error", "Load error")}
          detail={state.load_error}
        />
      ) : null}
      {state.filter_reason ? (
        <Marker
          testid={`plugin-lifecycle-marker-filtered-${name}`}
          tone="warning"
          label={t("settings.plugins_marker_filtered", "Filtered")}
          detail={state.filter_reason}
        />
      ) : null}
      {configChangedAfterActivation(state) ? (
        <Marker
          testid={`plugin-lifecycle-marker-config-changed-${name}`}
          tone="muted"
          label={t("settings.plugins_marker_config_changed", "Config changed")}
        />
      ) : null}
    </li>
  );
}

function PluginLifecycleBody({ read, lang, t }: { read: InspectionRead; lang: string; t: Translate }) {
  if (read.loading) {
    return (
      <p data-testid="settings-plugins-lifecycle-loading" className="m-0 text-sm text-fg-muted">
        {t("settings.plugins_loading", "Reading plugins…")}
      </p>
    );
  }
  if (read.error !== null) {
    return (
      <p data-testid="settings-plugins-lifecycle-error" role="alert" className="m-0 text-sm text-error">
        {t("settings.plugins_error_load", "Could not read the plugin status")}: {read.error}
      </p>
    );
  }
  if (!read.rows || read.rows.length === 0) {
    return (
      <p data-testid="settings-plugins-lifecycle-empty" className="m-0 text-sm text-fg-muted">
        {t("settings.plugins_empty", "No plugins loaded.")}
      </p>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {read.rows.map((row) => (
        <PluginRow key={row.name} row={row} lang={lang} t={t} />
      ))}
    </ul>
  );
}

function PluginLifecycleList() {
  const { t, lang } = useI18n();
  const read = useInspections(t);
  return (
    <SettingsSection
      testid="settings-plugins-lifecycle"
      title={t("settings.plugins_installed_title", "Installed plugins")}
    >
      <p className="m-0 mb-3 text-sm text-fg-muted">
        {t(
          "settings.plugins_installed_desc",
          "Every plugin the desktop app loaded, with version, source and activation time (PluginForge lifecycle).",
        )}
      </p>
      <PluginLifecycleBody read={read} lang={lang} t={t} />
    </SettingsSection>
  );
}

function DesktopOnlyCard({ t }: { t: Translate }) {
  return (
    <SettingsSection
      testid="settings-plugins-lifecycle-desktop-only"
      title={t("settings.plugins_installed_title", "Installed plugins")}
    >
      <div className="flex items-start gap-2 rounded-app border border-border bg-card px-3 py-2 text-sm text-fg-secondary">
        <Monitor size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{t("feature.desktop_only", "Only available with the desktop app.")}</span>
      </div>
    </SettingsSection>
  );
}

/** Settings > Plugins card: the installed plugins with their lifecycle state. */
export default function PluginLifecycleSection() {
  const { t } = useI18n();
  return (
    <Feature id={FEATURES.PLUGIN_LIFECYCLE} whenDisabled={<DesktopOnlyCard t={t} />}>
      <PluginLifecycleList />
    </Feature>
  );
}
