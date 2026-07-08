/**
 * Barrel for the Settings tab-panel components (#1447). Each panel owns
 * one tab's content 1:1; the Settings page shell composes them as a thin
 * tab-router. The AI tab lives in ``components/settings/ai/AiSettingsPanel``
 * (extracted earlier, #386) and is imported there.
 */
export { default as GeneralPanel } from "./GeneralPanel";
export { default as LearningPanel } from "./LearningPanel";
export { default as PluginsPanel } from "./PluginsPanel";
export { default as DataPanel } from "./DataPanel";
export { default as IntegrationsPanel } from "./IntegrationsPanel";
export { default as HelpPanel } from "./HelpPanel";
export { default as AboutPanel } from "./AboutPanel";
