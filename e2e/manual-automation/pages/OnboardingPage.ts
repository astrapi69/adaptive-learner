/**
 * OnboardingPage — Page Object for the Landing → Onboarding → Wizard flow
 * (#616). Real selectors from ``pages/Onboarding.tsx`` /
 * ``OnboardingWizard``.
 */

import { expect, type Locator, type Page } from "@playwright/test";

export class OnboardingPage {
  constructor(private readonly page: Page) {}

  readonly url = "/onboarding";

  get root(): Locator {
    return this.page.getByTestId("onboarding");
  }
  get nameInput(): Locator {
    return this.page.getByTestId("onboarding-name");
  }
  get topicInput(): Locator {
    return this.page.getByTestId("onboarding-topic");
  }
  get submit(): Locator {
    return this.page.getByTestId("onboarding-submit");
  }
  get restoreButton(): Locator {
    return this.page.getByTestId("onboarding-restore-backup");
  }
  get restoreInput(): Locator {
    return this.page.getByTestId("onboarding-restore-input");
  }
  /** The post-quick-start invite ("jump right in" / "set up profile"). */
  get invite(): Locator {
    return this.page.getByTestId("onboarding-invite");
  }
  get jumpRightIn(): Locator {
    return this.page.getByTestId("onboarding-invite-start-now");
  }
  get setUpProfile(): Locator {
    return this.page.getByTestId("onboarding-invite-setup-profile");
  }
  get wizard(): Locator {
    return this.page.getByTestId("onboarding-wizard");
  }
  get wizardStepLabel(): Locator {
    return this.page.getByTestId("onboarding-wizard-step-label");
  }
  get wizardNext(): Locator {
    return this.page.getByTestId("onboarding-wizard-next");
  }
  get wizardBack(): Locator {
    return this.page.getByTestId("onboarding-wizard-back");
  }
  get wizardGoal(): Locator {
    return this.page.getByTestId("onboarding-wizard-goal");
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await expect(this.root).toBeVisible();
  }

  /** Fill name + topic and submit to reach the invite screen. */
  async quickStart(name = "QA Learner", topic = "Spanish B1"): Promise<void> {
    await this.nameInput.fill(name);
    await this.topicInput.fill(topic);
    await this.submit.click();
    await expect(this.invite).toBeVisible();
  }
}
