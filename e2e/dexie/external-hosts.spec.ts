/**
 * Third-party host guard for the static build (#3803).
 *
 * Every host the web app contacts is named in the privacy policy; this spec
 * keeps the app to that list. It walks the main surfaces of the Dexie build
 * (the GitHub Pages shape) the way a visitor does and records EVERY request
 * of the browser context, service workers included. A host that is neither
 * the preview server nor listed in ``ALLOWED_HOSTS`` (each entry with its
 * reason) fails the run, and so does a Content-Security-Policy violation:
 * the policy in ``index.html`` blocks a foreign image before it is
 * requested, so a renderer regression would otherwise hide behind it.
 *
 * The content is a mocked third-party repository whose lesson carries what
 * used to reach other hosts: YouTube single-video resources on the lesson
 * summary (they loaded thumbnails from img.youtube.com) and Markdown images
 * from a probe host in a theory step and in a post-answer explanation. The
 * second test adds a mocked AI reply with a Markdown image. The probe host
 * and img.youtube.com are answered locally, so a regression shows up here
 * without reaching a third party. All GitHub content is answered locally
 * too: the spec needs no network.
 *
 * Modelled on bibliogon's e2e/static-smoke/external-hosts.spec.ts.
 */

import {expect, test} from "@playwright/test";
import type {BrowserContext, Page, Route} from "@playwright/test";

import {createTestUser} from "../helpers/onboarding";
import {currentStepTestId, waitForStepAdvance} from "./_step-flow";

/** host -> why the app may contact it. An entry is a decision with a
 *  reason, never a fix; the privacy policy names every one of them. */
const ALLOWED_HOSTS: Record<string, string> = {
    "raw.githubusercontent.com":
        "lesson content, catalogs (manifest.yaml, media.yaml, books.yaml, " +
        "recommended-repos.json) and book covers of the official and the " +
        "connected content repositories, loaded by design",
};

/** Hosts allowed only in the test that stores an AI key, with the reason. */
const AI_HOSTS: Record<string, string> = {
    "api.anthropic.com":
        "the learner's own AI provider, contacted only after the learner " +
        "stored their key (here a fake key, answered locally)",
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const PROBE_HOST = "probe-image.example";
const OWNER_REPO = "probe-owner/privacy-probe";
const SET_ID = "privacy-probe";
const SET_PATH = "sets/de/privacy-probe";
const LESSON_FILE = "01-probe.json";
const FAKE_KEY = "sk-ant-" + "a".repeat(95);

const ROOT_MANIFEST = `
schema_version: "1.13"
sets:
  - id: ${SET_ID}
    title: "Privacy Probe"
    target_language: de
    source_language: de
    domain: knowledge
    level: none
    version: "1.0.0"
    lesson_count: 1
    path: ${SET_PATH}
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "${LESSON_FILE}"
`;

const LESSON = JSON.stringify({
    id: "01-probe",
    title: "Probe",
    target_language: "de",
    source_language: "de",
    cards: [{id: "c1", front: "eins", back: "one"}],
    resources: [
        {type: "youtube", title: "Single video", url: "https://www.youtube.com/watch?v=aircAruvnKk"},
        {
            type: "youtube",
            title: "Video inside a playlist",
            url: "https://www.youtube.com/watch?v=a0_lo_GDcFw&list=PLZZWrBYkx7Otcjr3eCLZDCgfpqnxMY29s",
        },
    ],
    steps: [
        {
            id: "t1",
            type: "theory",
            title: "Bild",
            body: `Text mit Bild.\n\n![Probebild](https://${PROBE_HOST}/pixel.png?from=theory)`,
        },
        {
            id: "e1",
            type: "exercise",
            exercise: {
                id: "e1",
                type: "multiple_choice",
                prompt: "Was heißt eins?",
                card_ids: ["c1"],
                options: [{text: "one", correct: true}, {text: "two"}],
                explanation: `Erklärung.\n\n![Erklärbild](https://${PROBE_HOST}/pixel.png?from=explanation)`,
            },
        },
    ],
});

/** The official media catalog with one single video for the probe's domain,
 *  so the domain-media path of the summary is covered as well. */
const MEDIA_YAML = JSON.stringify({
    knowledge: [
        {
            type: "youtube",
            title: "Domain video",
            url: "https://youtu.be/vo4pMVb0R6M",
            free: true,
        },
    ],
});

const AI_REPLY = `Hallo. ![KI-Bild](https://${PROBE_HOST}/pixel.png?from=ai-reply)`;

const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
);

/** Same-origin surfaces a visitor reaches from the navigation, after the
 *  learner exists. What matters is breadth of mounted code, not testids. */
const ROUTES = [
    "/dashboard",
    "/content",
    "/content?tab=my",
    "/content?tab=import",
    "/create-lesson",
    "/learning-path",
    "/progress",
    "/statistics",
    "/curriculum",
    "/session",
    "/anki",
    "/arcade",
    "/pronunciation",
    "/contribute",
    "/settings?tab=general",
    "/settings?tab=ai",
    "/settings?tab=learning",
    "/settings?tab=plugins",
    "/settings?tab=data",
    "/settings?tab=integrations",
    "/settings?tab=help",
    "/settings?tab=diagnostics",
    "/settings?tab=about",
];

interface Capture {
    /** Every request URL the context issued, by host. */
    byHost: Map<string, string[]>;
    /** Requests to a host that is neither local nor allowed. */
    external: string[];
    /** Content-Security-Policy violations the pages reported. */
    csp: string[];
    /** Same-origin scripts or stylesheets that 404 (the preview is broken). */
    broken: string[];
}

/** Record every request of the context against ``allowed``. */
function capture(context: BrowserContext, allowed: Record<string, string>): Capture {
    const result: Capture = {byHost: new Map(), external: [], csp: [], broken: []};
    context.on("request", (request) => {
        const url = new URL(request.url());
        if (url.protocol === "data:" || url.protocol === "blob:") return;
        const urls = result.byHost.get(url.hostname) ?? [];
        urls.push(url.href);
        result.byHost.set(url.hostname, urls);
        if (LOCAL_HOSTS.has(url.hostname) || url.hostname in allowed) return;
        result.external.push(`${request.resourceType()} ${url.origin}${url.pathname}${url.search}`);
    });
    context.on("response", (response) => {
        const url = new URL(response.url());
        const kind = response.request().resourceType();
        if (LOCAL_HOSTS.has(url.hostname) && response.status() === 404 && (kind === "script" || kind === "stylesheet")) {
            result.broken.push(`${response.status()} ${url.pathname}`);
        }
    });
    context.on("page", (page) => watchCsp(page, result));
    return result;
}

function watchCsp(page: Page, result: Capture): void {
    page.on("console", (message) => {
        if (/Content Security Policy/i.test(message.text())) result.csp.push(message.text());
    });
}

/** The page reports every violation itself, so none can slip past the
 *  console wording of a particular Chromium version. */
async function reportCspViolations(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
            console.error(
                `Content Security Policy violation: ${event.violatedDirective} blocked ${event.blockedURI}`,
            );
        });
    });
}

/** Answer every GitHub content request locally: the mocked repository, an
 *  empty official index and registry, and a media catalog with a video. */
async function mockContent(context: BrowserContext): Promise<void> {
    await context.route("**/raw.githubusercontent.com/**", (route: Route) => {
        const url = route.request().url();
        if (url.includes(`/${OWNER_REPO}/`)) return fulfillProbeRepo(route, url);
        if (url.endsWith("/recommended-repos.json")) {
            return route.fulfill({status: 200, contentType: "application/json", body: '{"repos":[]}'});
        }
        if (url.endsWith("/media.yaml")) return route.fulfill({status: 200, body: MEDIA_YAML});
        if (url.endsWith("/books.yaml")) return route.fulfill({status: 200, body: "domains: {}\n"});
        if (url.endsWith("/manifest.yaml")) {
            return route.fulfill({status: 200, body: 'schema_version: "1.13"\nsets: []\n'});
        }
        return route.fulfill({status: 404, body: ""});
    });
    await context.route(`https://${PROBE_HOST}/**`, (route) =>
        route.fulfill({status: 200, contentType: "image/png", body: PNG}),
    );
    await context.route("https://img.youtube.com/**", (route) =>
        route.fulfill({status: 200, contentType: "image/png", body: PNG}),
    );
}

function fulfillProbeRepo(route: Route, url: string) {
    if (url.endsWith("/main/manifest.yaml")) return route.fulfill({status: 200, body: ROOT_MANIFEST});
    if (url.endsWith(`/${SET_PATH}/manifest.yaml`)) return route.fulfill({status: 200, body: SET_MANIFEST});
    if (url.endsWith(`/${LESSON_FILE}`)) {
        return route.fulfill({status: 200, contentType: "application/json", body: LESSON});
    }
    return route.fulfill({status: 404, body: ""});
}

/** Answer the Anthropic API locally: the model list, the streamed tutor
 *  reply (with a Markdown image) and the step evaluator's JSON verdict. */
async function mockAnthropic(context: BrowserContext): Promise<void> {
    await context.route("https://api.anthropic.com/**", (route) => {
        const request = route.request();
        const cors = {
            "access-control-allow-origin": request.headers()["origin"] || "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
        };
        const path = new URL(request.url()).pathname;
        if (request.method() === "OPTIONS") return route.fulfill({status: 204, headers: cors});
        if (path === "/v1/models") {
            return route.fulfill({
                status: 200,
                headers: {...cors, "content-type": "application/json"},
                body: JSON.stringify({data: [{id: "claude-haiku-4-5-20251001", display_name: "Mock Haiku"}]}),
            });
        }
        let body: {stream?: boolean} = {};
        try {
            body = JSON.parse(request.postData() ?? "{}");
        } catch {
            body = {};
        }
        if (body.stream) {
            const event = (payload: {type: string}) => `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`;
            return route.fulfill({
                status: 200,
                headers: {...cors, "content-type": "text/event-stream"},
                body:
                    event({type: "message_start"}) +
                    event({type: "content_block_delta", index: 0, delta: {type: "text_delta", text: AI_REPLY}} as {type: string}) +
                    event({type: "message_stop"}),
            });
        }
        return route.fulfill({
            status: 200,
            headers: {...cors, "content-type": "application/json"},
            body: JSON.stringify({content: [{type: "text", text: '{"advance": false, "reason": "mock"}'}]}),
        });
    });
}

async function visit(page: Page, route: string): Promise<void> {
    await page.goto(route);
    await page.waitForLoadState("networkidle", {timeout: 10_000}).catch(() => undefined);
    await page.waitForTimeout(300);
}

/** Connect the mocked repository and open its lesson. */
async function openProbeLesson(page: Page): Promise<void> {
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-add")).toBeVisible({timeout: 60_000});
    await page.getByTestId("content-repo-url").fill(`https://github.com/${OWNER_REPO}`);
    await page.getByTestId("content-repo-connect").click();
    await expect(page.getByTestId("content-repo-result")).toContainText(/passed|erfolgreich/i);
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 15_000});
    const open = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(open).toBeVisible({timeout: 15_000});
    await open.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 15_000});
}

/** The image is offered as a link with its alt text, never loaded. Soft:
 *  a miss here must not hide the request verdict at the end of the test. */
async function expectImageAsLink(page: Page, scope: string, altText: string, from: string): Promise<void> {
    const link = page.getByTestId(scope).getByTestId("markdown-remote-image");
    await expect.soft(link).toHaveText(altText);
    await expect.soft(link).toHaveAttribute("href", `https://${PROBE_HOST}/pixel.png?from=${from}`);
    await expect.soft(link).toHaveAttribute("target", "_blank");
    await expect.soft(page.locator(`img[src*="${PROBE_HOST}"]`)).toHaveCount(0);
}

async function advance(page: Page): Promise<void> {
    const before = await currentStepTestId(page);
    await page.getByTestId("lesson-next").click();
    await waitForStepAdvance(page, before);
}

/** Theory, a wrong answer that opens the explanation, the summary. */
async function playProbeLesson(page: Page): Promise<void> {
    await expectImageAsLink(page, "lesson-theory-body", "Probebild", "theory");
    await advance(page);
    await page.getByRole("radio", {name: "two"}).check();
    await page.getByTestId("lesson-check").click();
    await expect(page.getByTestId("exercise-explanation")).toHaveAttribute("data-state", "open");
    await expectImageAsLink(page, "exercise-explanation-body", "Erklärbild", "explanation");
    await advance(page);
    await expect(page.getByTestId("lesson-summary")).toBeVisible({timeout: 15_000});
    // Two lesson resources plus the domain video from media.yaml.
    const videos = page.locator('[data-testid="resource-card-link"][data-type="youtube"]');
    await expect(videos).toHaveCount(3);
    for (const card of await videos.all()) {
        // Lazy images load only in view: bring every card there first.
        await card.scrollIntoViewIfNeeded();
        await expect.soft(card.getByTestId("youtube-thumbnail-placeholder")).toBeVisible();
        await expect.soft(card).toHaveAttribute("target", "_blank");
        await expect.soft(card).toHaveAttribute("href", /^https:\/\/(www\.youtube\.com|youtu\.be)\//);
    }
    await expect.soft(page.locator("img[src*='img.youtube.com']")).toHaveCount(0);
    await page.waitForLoadState("networkidle", {timeout: 10_000}).catch(() => undefined);
}

/** The verdict shared by both tests. ``ownRequests`` is the positive
 *  control: requests the capture must have seen, or it saw nothing. */
function expectOnlyAllowedHosts(captured: Capture, ownRequests: {host: string; contains: string}[]): void {
    const total = [...captured.byHost.values()].reduce((sum, urls) => sum + urls.length, 0);
    console.log(
        `external-hosts: ${total} requests recorded, hosts: ` +
            [...captured.byHost.entries()].map(([host, urls]) => `${host} (${urls.length})`).join(", "),
    );
    expect(captured.broken, "same-origin 404s: the preview does not serve this build").toEqual([]);
    for (const {host, contains} of ownRequests) {
        const seen = (captured.byHost.get(host) ?? []).filter((url) => url.includes(contains));
        expect(seen.length, `positive control: the capture saw no request to ${host} (${contains})`).toBeGreaterThan(0);
    }
    expect(
        captured.external,
        "third-party requests: self-host the resource, or allowlist the host with a reason",
    ).toEqual([]);
    expect(captured.csp, "Content-Security-Policy violations").toEqual([]);
}

test.describe("#3803 - the static build contacts no unlisted host", () => {
    test("main surfaces, a lesson with remote images and YouTube resources", async ({page, context}) => {
        test.setTimeout(240_000);
        await reportCspViolations(context);
        const captured = capture(context, ALLOWED_HOSTS);
        watchCsp(page, captured);
        await mockContent(context);

        await visit(page, "/");
        await createTestUser(page);
        await expect(page.getByTestId("dashboard")).toBeVisible({timeout: 20_000});
        for (const route of ROUTES) await visit(page, route);
        await openProbeLesson(page);
        await playProbeLesson(page);

        expectOnlyAllowedHosts(captured, [{host: "raw.githubusercontent.com", contains: `/${OWNER_REPO}/`}]);
    });

    test("an AI reply with a remote image", async ({page, context}) => {
        test.setTimeout(180_000);
        await reportCspViolations(context);
        const captured = capture(context, {...ALLOWED_HOSTS, ...AI_HOSTS});
        watchCsp(page, captured);
        await mockContent(context);
        await mockAnthropic(context);

        await createTestUser(page);
        await page.goto("/settings?tab=ai");
        await page.getByTestId("api-key-input-anthropic").fill(FAKE_KEY);
        await page.getByTestId("api-key-save-anthropic").click();
        // The overview row shows the provider as configured once the key is stored.
        await expect(page.getByTestId("provider-overview-preview-anthropic")).not.toHaveText("—", {
            timeout: 15_000,
        });
        await visit(page, "/session");
        await page.getByTestId("chat-input").fill("Hallo");
        await page.getByTestId("chat-send").click();
        const reply = page.getByTestId("chat-message-assistant").last();
        await expect(reply).toContainText("Hallo.", {timeout: 20_000});
        await expect.soft(reply.getByTestId("markdown-remote-image")).toHaveText("KI-Bild");
        await expect.soft(page.locator(`img[src*="${PROBE_HOST}"]`)).toHaveCount(0);
        await page.waitForLoadState("networkidle", {timeout: 10_000}).catch(() => undefined);

        expectOnlyAllowedHosts(captured, [{host: "api.anthropic.com", contains: "/v1/messages"}]);
    });

    test("every allowlisted host carries a written reason", () => {
        for (const [host, reason] of Object.entries({...ALLOWED_HOSTS, ...AI_HOSTS})) {
            expect(reason.trim(), `${host} is allowlisted without a reason`).not.toBe("");
        }
    });
});
