/**
 * SettingsPage — Page Object for the 7-tab Settings page (#616). Real
 * selectors from ``pages/Settings.tsx`` + ``ThemePicker`` + avatar /
 * username / backup / selective-export controls.
 */

import { expect, type Locator, type Page } from "@playwright/test";

export type SettingsTab =
  | "general"
  | "ai"
  | "learning"
  | "plugins"
  | "data"
  | "help"
  | "about";

/** The panel testid revealed when each tab is active. */
export const SETTINGS_PANELS: Record<SettingsTab, string> = {
  general: "settings-section-appearance",
  ai: "settings-provider",
  learning: "settings-panel-learning",
  plugins: "settings-panel-plugins",
  data: "settings-panel-data",
  help: "settings-panel-help",
  about: "settings-panel-about",
};

export class SettingsPage {
  constructor(private readonly page: Page) {}

  get sidebar(): Locator {
    return this.page.getByTestId("settings-tabs");
  }
  tab(tab: SettingsTab): Locator {
    return this.page.getByTestId(`settings-tab-${tab}`);
  }
  panel(tab: SettingsTab): Locator {
    return this.page.getByTestId(SETTINGS_PANELS[tab]);
  }
  get mobileTrigger(): Locator {
    return this.page.getByTestId("settings-mobile-trigger");
  }
  mobileTab(tab: SettingsTab): Locator {
    return this.page.getByTestId(`settings-mobile-tab-${tab}`);
  }

  // Backup (data tab)
  get backupExport(): Locator {
    return this.page.getByTestId("backup-export");
  }
  get themePicker(): Locator {
    return this.page.getByTestId("settings-theme-picker");
  }
  themeOption(id: string): Locator {
    return this.page.getByTestId(`settings-theme-${id}`);
  }
  /** The clickable theme card (label) wrapping a radio — the radio
   *  itself is sr-only, so interaction must target the label. */
  themeCard(id: string): Locator {
    return this.page
      .locator("label.theme-card")
      .filter({ has: this.themeOption(id) });
  }
  get themeCards(): Locator {
    return this.page.locator("label.theme-card");
  }
  themeGroup(group: "recommended" | "classic"): Locator {
    return this.page.getByTestId(`theme-group-${group}`);
  }
  get usernameInput(): Locator {
    return this.page.getByTestId("settings-username-input");
  }
  get usernameSave(): Locator {
    return this.page.getByTestId("settings-username-save");
  }
  get avatarUpload(): Locator {
    return this.page.getByTestId("avatar-upload-button");
  }
  get avatarFileInput(): Locator {
    return this.page.getByTestId("avatar-file-input");
  }
  get cropConfirm(): Locator {
    return this.page.getByTestId("crop-confirm");
  }
  get selectiveExport(): Locator {
    return this.page.getByTestId("data-export-selective");
  }
  get selectiveSelectAll(): Locator {
    return this.page.getByTestId("data-export-select-all");
  }

  async goto(tab?: SettingsTab): Promise<void> {
    await this.page.goto(tab ? `/settings?tab=${tab}` : "/settings");
  }

  /** Click a desktop sidebar tab and wait for its panel. */
  async openTab(tab: SettingsTab): Promise<void> {
    await this.tab(tab).click();
    await expect(this.tab(tab)).toHaveAttribute("aria-current", "page");
    await expect(this.panel(tab)).toBeVisible();
  }
}
