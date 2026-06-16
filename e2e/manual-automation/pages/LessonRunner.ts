/**
 * LessonRunner — Page Object for the controlled lesson viewer (#616).
 * Real selectors from ``pages/Lesson.tsx`` + the five exercise renderers
 * (see ``e2e/dexie/lesson-playthrough.spec.ts`` for the proven testids).
 *
 * In the Lesson page the exercises run in CONTROLLED mode: there is no
 * per-exercise submit button — the shared ``lesson-check`` grades and
 * ``lesson-next`` advances. The step-advance wait is explicit (waits for
 * the current step article to detach), never a fixed timeout.
 */

import { expect, type Locator, type Page } from "@playwright/test";

export type ExerciseKind =
  | "matching"
  | "free_text"
  | "word_tiles"
  | "cloze"
  | "picture_choice"
  | "theory";

export class LessonRunner {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId("lesson-page");
  }
  get check(): Locator {
    return this.page.getByTestId("lesson-check");
  }
  get next(): Locator {
    return this.page.getByTestId("lesson-next");
  }
  get prev(): Locator {
    return this.page.getByTestId("lesson-prev");
  }
  get summary(): Locator {
    return this.page.getByTestId("lesson-summary");
  }
  get theoryBody(): Locator {
    return this.page.getByTestId("lesson-theory-body");
  }
  private get activeStep(): Locator {
    return this.page.locator('[data-testid^="lesson-step-"]').first();
  }

  /** Detect + answer the on-screen exercise (any answer — coverage, not
   *  correctness). Returns the kind seen ("theory" when no exercise). */
  async answerCurrent(): Promise<ExerciseKind> {
    if (await this.page.getByTestId("free-text-exercise").count()) {
      await this.page.getByTestId("free-text-input").fill("Bonjour");
      return "free_text";
    }
    if (await this.page.getByTestId("cloze-exercise").count()) {
      const inputs = this.page.locator('[data-testid^="cloze-input-"]');
      const n = await inputs.count();
      for (let i = 0; i < n; i++) await inputs.nth(i).fill("Bonjour");
      return "cloze";
    }
    if (await this.page.getByTestId("word-tiles-exercise").count()) {
      const scrambled = this.page.locator(
        '[data-testid^="word-tile-scrambled-"]',
      );
      let guard = 0;
      while ((await scrambled.count()) > 0 && guard++ < 12) {
        await scrambled.first().click();
      }
      return "word_tiles";
    }
    if (await this.page.getByTestId("picture-exercise").count()) {
      await this.page.locator('[data-testid^="picture-choice-"]').first().click();
      return "picture_choice";
    }
    if (await this.page.getByTestId("matching-exercise").count()) {
      await this.pairAllMatching();
      return "matching";
    }
    return "theory";
  }

  /** Pair every left tile with the right of the same index (A → B). */
  async pairAllMatching(): Promise<void> {
    const lefts = this.page.getByTestId(/^matching-left-\d+$/);
    const n = await lefts.count();
    for (let i = 0; i < n; i++) {
      await this.page.getByTestId(`matching-left-${i}`).click();
      await this.page.getByTestId(`matching-right-${i}`).click();
    }
  }

  /** Advance one step: grade via the shared check (if an exercise step)
   *  then click next, waiting explicitly for the step to swap. */
  async advance(): Promise<void> {
    const before = await this.activeStep.getAttribute("data-testid");
    if (await this.check.count()) {
      await expect(this.check).toBeEnabled();
      await this.check.click();
    }
    await expect(this.next).toBeVisible();
    await this.next.click();
    // Explicit step-swap wait (no fixed timeout): the previous step
    // article detaches, or we reached the summary.
    if (before) {
      await Promise.race([
        this.page
          .locator(`[data-testid="${before}"]`)
          .waitFor({ state: "detached" })
          .catch(() => undefined),
        this.summary.waitFor({ state: "visible" }).catch(() => undefined),
      ]);
    }
  }

  /** Play the lesson to the scored summary, returning the set of
   *  exercise kinds traversed. */
  async playToSummary(maxSteps = 40): Promise<Set<ExerciseKind>> {
    const seen = new Set<ExerciseKind>();
    for (let i = 0; i < maxSteps; i++) {
      if (await this.summary.count()) break;
      const kind = await this.answerCurrent();
      if (kind !== "theory") seen.add(kind);
      await this.advance();
    }
    await expect(this.summary).toBeVisible({ timeout: 15_000 });
    return seen;
  }

  /** Step forward (answering each step) until the given exercise kind is
   *  the one on screen — WITHOUT answering it — so the caller can drive
   *  that exercise directly. Returns false if not reached. */
  async advanceUntil(target: ExerciseKind, maxSteps = 40): Promise<boolean> {
    for (let i = 0; i < maxSteps; i++) {
      if (await this.summary.count()) return false;
      const kind = await this.detectKind();
      if (kind === target) return true;
      await this.answerCurrent();
      await this.advance();
    }
    return false;
  }

  /** Detect the on-screen exercise kind without answering it. */
  async detectKind(): Promise<ExerciseKind> {
    if (await this.page.getByTestId("free-text-exercise").count())
      return "free_text";
    if (await this.page.getByTestId("cloze-exercise").count()) return "cloze";
    if (await this.page.getByTestId("word-tiles-exercise").count())
      return "word_tiles";
    if (await this.page.getByTestId("picture-exercise").count())
      return "picture_choice";
    if (await this.page.getByTestId("matching-exercise").count())
      return "matching";
    return "theory";
  }
}
