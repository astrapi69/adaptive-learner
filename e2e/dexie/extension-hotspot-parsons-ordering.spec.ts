/**
 * ext:al-ordering, ext:al-parsons, ext:al-hotspot end to end (#3110).
 *
 * One lesson per extension, each declaring `requires_extensions` so the
 * load guard's acceptance is exercised (not just the renderer): the guard
 * refuses a lesson naming an unadopted extension (E-EXT-UNSUPPORTED), so a
 * lesson that LOADS and PLAYS here proves both halves at once.
 *
 * GitHub fetches are mocked with page.route (deterministic, offline),
 * mirroring multiple-choice-device-check.spec.ts / exercise-variables.spec.ts.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";
import { currentStepTestId, waitForStepAdvance } from "./_step-flow";

const OWNER_REPO = "e2e/ext-hotspot-parsons-ordering";

/** A tiny, self-contained inline SVG data URI - offline-safe, no network
 *  fetch, and its own intrinsic aspect ratio keeps the hotspot overlay's
 *  rendered box a known shape for the click-position math below. */
const STIMULUS_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
      '<rect width="200" height="200" fill="#eee"/></svg>',
  );

function orderingLesson() {
  return {
    id: "ordering-steps",
    title: "Hill start",
    description: "ext:al-ordering, schema v1.14+",
    target_language: "en",
    source_language: "en",
    domain: "knowledge",
    estimated_minutes: 1,
    cards: [],
    steps: [
      {
        id: "s1",
        type: "exercise",
        exercise: {
          id: "e1",
          type: "ext:al-ordering",
          prompt: "Put the hill-start steps in order.",
          card_ids: [],
          distractors: [],
          ext_payload: {
            items: ["Engage clutch", "Select gear", "Release clutch"],
          },
        },
      },
    ],
  };
}

function parsonsLesson() {
  return {
    id: "parsons-greet",
    title: "Greet function",
    description: "ext:al-parsons, schema v1.14+",
    target_language: "en",
    source_language: "en",
    domain: "programming",
    estimated_minutes: 1,
    cards: [],
    // Two steps of the SAME exercise (mirrors exercise-variables.spec.ts):
    // "Try again" is unavailable in the Lesson page's controlled two-phase
    // flow (ExerciseFooter renders nothing when controlled), so a
    // wrong-then-correct sequence is exercised across two fresh step
    // mounts instead of a retry within one.
    steps: [
      {
        id: "s1",
        type: "exercise",
        exercise: {
          id: "e1",
          type: "ext:al-parsons",
          prompt: "Arrange the function body.",
          card_ids: [],
          distractors: [],
          ext_payload: {
            language: "python",
            lines: [
              { code: "def greet(name):", indent: 0 },
              { code: "print(name)", indent: 1 },
            ],
          },
        },
      },
      {
        id: "s2",
        type: "exercise",
        exercise: {
          id: "e2",
          type: "ext:al-parsons",
          prompt: "Arrange the function body.",
          card_ids: [],
          distractors: [],
          ext_payload: {
            language: "python",
            lines: [
              { code: "def greet(name):", indent: 0 },
              { code: "print(name)", indent: 1 },
            ],
          },
        },
      },
    ],
  };
}

function hotspotLesson() {
  return {
    id: "hotspot-capital",
    title: "Find the capital",
    description: "ext:al-hotspot, schema v1.14+",
    target_language: "en",
    source_language: "en",
    domain: "knowledge",
    estimated_minutes: 1,
    cards: [],
    steps: [
      {
        id: "s1",
        type: "exercise",
        exercise: {
          id: "e1",
          type: "ext:al-hotspot",
          prompt: "Click the correct zone.",
          card_ids: [],
          distractors: [],
          ext_payload: {
            src: STIMULUS_IMAGE,
            zones: [
              {
                shape: "rect",
                coords: { x: 10, y: 10, width: 20, height: 20 },
                is_correct: "true",
              },
              { shape: "circle", coords: { cx: 70, cy: 70, radius: 15 } },
            ],
          },
        },
      },
    ],
  };
}

const ROOT_MANIFEST = `
schema_version: "1.14"
sets:
  - id: ordering-set
    title: "Ordering"
    target_language: en
    source_language: en
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: knowledge
    path: sets/en/ordering
    requires_extensions:
      - "ext:al-ordering@1"
  - id: parsons-set
    title: "Parsons"
    target_language: en
    source_language: en
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: programming
    path: sets/en/parsons
    requires_extensions:
      - "ext:al-parsons@1"
  - id: hotspot-set
    title: "Hotspot"
    target_language: en
    source_language: en
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: knowledge
    path: sets/en/hotspot
    requires_extensions:
      - "ext:al-hotspot@1"
`;

const SET_MANIFEST = (filename: string) => `
metadata:
  lessons:
    - "${filename}"
`;

async function mockRepo(page: Page) {
  await page.route(
    `**/raw.githubusercontent.com/${OWNER_REPO}/main/**`,
    (route) => {
      const url = route.request().url();
      if (url.endsWith("/main/manifest.yaml")) {
        return route.fulfill({ status: 200, body: ROOT_MANIFEST });
      }
      if (url.endsWith("/sets/en/ordering/manifest.yaml")) {
        return route.fulfill({ status: 200, body: SET_MANIFEST("01-ordering.json") });
      }
      if (url.endsWith("/01-ordering.json")) {
        return route.fulfill({ status: 200, body: JSON.stringify(orderingLesson()) });
      }
      if (url.endsWith("/sets/en/parsons/manifest.yaml")) {
        return route.fulfill({ status: 200, body: SET_MANIFEST("01-parsons.json") });
      }
      if (url.endsWith("/01-parsons.json")) {
        return route.fulfill({ status: 200, body: JSON.stringify(parsonsLesson()) });
      }
      if (url.endsWith("/sets/en/hotspot/manifest.yaml")) {
        return route.fulfill({ status: 200, body: SET_MANIFEST("01-hotspot.json") });
      }
      if (url.endsWith("/01-hotspot.json")) {
        return route.fulfill({ status: 200, body: JSON.stringify(hotspotLesson()) });
      }
      return route.fulfill({ status: 404, body: "" });
    },
  );
}

async function connectRepo(page: Page) {
  await mockRepo(page);
  await createTestUser(page);
  await page.goto("/settings?tab=data");
  await expect(page.getByTestId("content-repo-section")).toBeVisible({
    timeout: 15000,
  });
  await page
    .getByTestId("content-repo-url")
    .fill(`https://github.com/${OWNER_REPO}`);
  await page.getByTestId("content-repo-connect").click();
  await expect(page.getByTestId("content-repo-result")).toContainText(
    /passed|erfolgreich/i,
  );
}

async function openSet(page: Page, setId: string) {
  await page.goto("/content?tab=my");
  await expect(page.getByTestId("content-tree")).toBeVisible({
    timeout: 15000,
  });
  const open = page.getByTestId(`content-set-${setId}-open`);
  await expect(open).toBeVisible({ timeout: 15000 });
  await open.click();
  await expect(page.getByTestId("lesson-page")).toBeVisible({
    timeout: 15000,
  });
}

async function check(page: Page) {
  const checkBtn = page.getByTestId("lesson-check");
  await expect(checkBtn).toBeEnabled({ timeout: 5000 });
  await checkBtn.click();
}

async function next(page: Page) {
  const nextBtn = page.getByTestId("lesson-next");
  await expect(nextBtn).toBeVisible({ timeout: 5000 });
  const before = await currentStepTestId(page);
  await nextBtn.click();
  await waitForStepAdvance(page, before);
}

test.describe("#3110 - three adopted extensions play end to end on a real browser (Dexie build)", () => {
  test("ext:al-ordering: tap-to-place in the correct order grades correct", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await connectRepo(page);
    await openSet(page, "ordering-set");

    await expect(page.getByTestId("ordering-exercise")).toBeVisible();
    await page.getByTestId("ordering-scrambled-0").click();
    await page.getByTestId("ordering-scrambled-1").click();
    await page.getByTestId("ordering-scrambled-2").click();
    await check(page);
    await expect(page.getByTestId("ordering-result")).toHaveAttribute(
      "data-result",
      "correct",
    );

    await next(page);
    await expect(page.getByTestId("lesson-summary")).toBeVisible({
      timeout: 15000,
    });
    expect(errors, `unexpected page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("ext:al-parsons: order AND indent must both be right", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await connectRepo(page);
    await openSet(page, "parsons-set");

    // --- Step 1: right order, indent left at 0/0 - wrong (line 2 needs
    //     indent 1). No "Try again" in the Lesson page's controlled
    //     two-phase flow, so move on to a fresh step instead of retrying. ---
    await expect(page.getByTestId("parsons-exercise")).toBeVisible();
    await page.getByTestId("parsons-scrambled-0").click();
    await page.getByTestId("parsons-scrambled-1").click();
    await check(page);
    await expect(page.getByTestId("parsons-result")).toHaveAttribute(
      "data-result",
      "wrong",
    );
    await next(page);

    // --- Step 2: same exercise, this time the placed line 2 gets its
    //     correct indent (1) - order AND indent both right. ---
    await expect(page.getByTestId("parsons-exercise")).toBeVisible();
    await page.getByTestId("parsons-scrambled-0").click();
    await page.getByTestId("parsons-scrambled-1").click();
    await page.getByTestId("parsons-indent-inc-1").click();
    await check(page);
    await expect(page.getByTestId("parsons-result")).toHaveAttribute(
      "data-result",
      "correct",
    );

    await next(page);
    await expect(page.getByTestId("lesson-summary")).toBeVisible({
      timeout: 15000,
    });
    expect(errors, `unexpected page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("ext:al-hotspot: click the correct zone (rect, edge-inclusive)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await connectRepo(page);
    await openSet(page, "hotspot-set");

    await expect(page.getByTestId("hotspot-exercise")).toBeVisible();
    const overlay = page.getByTestId("hotspot-overlay");
    const box = await overlay.boundingBox();
    if (!box) throw new Error("hotspot overlay has no bounding box");

    // Zone 0 is rect {x:10,y:10,width:20,height:20} in 0-100 percent
    // coordinates - click its center (15, 15).
    await overlay.click({
      position: { x: box.width * 0.15, y: box.height * 0.15 },
    });
    await check(page);
    await expect(page.getByTestId("hotspot-result")).toHaveAttribute(
      "data-result",
      "correct",
    );

    await next(page);
    await expect(page.getByTestId("lesson-summary")).toBeVisible({
      timeout: 15000,
    });
    expect(errors, `unexpected page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
