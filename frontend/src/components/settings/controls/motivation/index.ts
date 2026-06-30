/**
 * Barrel for the `motivation` settings controls (#1275 god-folder split).
 * Re-exports each control's default + named members so consumers can
 * import from the concern folder or the parent `controls` barrel.
 */

export * from "./GamificationSettingsSection";
export { default as GamificationSettingsSection } from "./GamificationSettingsSection";
export * from "./MissionSettingsControl";
export { default as MissionSettingsControl } from "./MissionSettingsControl";
export * from "./FeedbackIntensityControl";
export { default as FeedbackIntensityControl } from "./FeedbackIntensityControl";
export * from "./SoundSettingsControl";
export { default as SoundSettingsControl } from "./SoundSettingsControl";
