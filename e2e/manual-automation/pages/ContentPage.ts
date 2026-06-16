/**
 * ContentPage — Page Object for the /content Set Browser (#616). Real
 * selectors from ``pages/Content.tsx`` + ``ContentSetRow`` +
 * ``ContentSearchBar`` + book-companion section.
 *
 * The Dexie build bundles four sets (fr/es A1 for DE + EN speakers); the
 * EN-source sets live under the collapsed "other source languages"
 * section, so opening one needs ``expandOtherSources`` first.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { FIXTURE_SET_ID } from "../fixtures/content";

/** The fixture set (mocked via ``mockContent``) used by the suite. */
export const BUNDLED_SET_ID = FIXTURE_SET_ID;

export class ContentPage {
  constructor(private readonly page: Page) {}

  readonly url = "/content";

  get tree(): Locator {
    return this.page.getByTestId("content-tree");
  }
  get otherToggle(): Locator {
    return this.page.getByTestId("content-other-toggle");
  }
  get searchInput(): Locator {
    return this.page.getByTestId("content-search-input");
  }
  get searchResults(): Locator {
    return this.page.getByTestId("content-search-results");
  }
  get searchCount(): Locator {
    return this.page.getByTestId("content-search-count");
  }
  get searchClear(): Locator {
    return this.page.getByTestId("content-search-clear");
  }

  setAction(setId: string): Locator {
    return this.page.getByTestId(`content-set-${setId}-action`);
  }
  setOpen(setId: string): Locator {
    return this.page.getByTestId(`content-set-${setId}-open`);
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await expect(this.tree).toBeVisible({ timeout: 15_000 });
  }

  async expandOtherSources(): Promise<void> {
    await this.otherToggle.click();
  }

  /**
   * Download (idempotent) + open the fixture set's first lesson, landing
   * on the lesson viewer. Source-section-agnostic: if the set isn't in the
   * primary tree, expands the "other source languages" section first
   * (which group it lands in depends on the app language).
   */
  async openBundledLesson(setId = BUNDLED_SET_ID): Promise<void> {
    const action = this.setAction(setId);
    if (!(await action.isVisible().catch(() => false))) {
      if (await this.otherToggle.count()) {
        await this.expandOtherSources();
      }
    }
    await expect(action).toBeVisible({ timeout: 15_000 });
    await action.click();
    const open = this.setOpen(setId);
    await expect(open).toBeVisible({ timeout: 20_000 });
    await open.click();
    await expect(this.page.getByTestId("lesson-page")).toBeVisible({
      timeout: 15_000,
    });
  }
}
