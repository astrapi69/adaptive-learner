/**
 * NavBar — Page Object for the top navigation header (#616). Real
 * selectors from ``components/Navigation.tsx`` (nav-* testids) + the
 * mobile hamburger.
 */

import { type Locator, type Page } from "@playwright/test";

export class NavBar {
  constructor(private readonly page: Page) {}

  get links(): Locator {
    return this.page.getByTestId("nav-links");
  }
  get xpBadge(): Locator {
    return this.page.getByTestId("nav-xp-badge");
  }
  get xpTotal(): Locator {
    return this.page.getByTestId("nav-xp-badge-total");
  }
  get help(): Locator {
    return this.page.getByTestId("nav-help");
  }
  get themeToggle(): Locator {
    return this.page.getByTestId("nav-theme-toggle");
  }
  /** Mobile hamburger that toggles the nav drawer. */
  get hamburger(): Locator {
    return this.page.getByTestId("nav-hamburger");
  }
  link(name: string): Locator {
    return this.page.getByTestId(`nav-${name}`);
  }
}
