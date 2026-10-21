/**
 * #3806 - an imported-chat session sends its AI opening ONCE.
 *
 * Measured before the fix: every reload or re-open of
 * ``/session?session=<id>`` sent the opening again (a streamed chat request
 * whose system prompt holds the whole imported transcript, plus a
 * step-evaluator request), with nothing typed.
 *
 * These tests drive the real thread against the REAL Dexie storage
 * (fake-indexeddb) and mock only the provider, at the ``fetch`` layer, counting
 * every request that would leave the browser. The opening's record is what the
 * storage layer persists, so the only faithful test of "a reload sends
 * nothing" is one that reloads against what the first open really stored.
 */

import "fake-indexeddb/auto";

import {render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {_resetStorageCacheForTests, setPersistedStorageMode} from "../../../storage";
import {_resetDbForTests} from "../../../storage/dexie/db";
import {dexieStorage} from "../../../storage/dexie-storage";
import {anthropicSseResponse} from "../../../test/anthropic-sse";
import AssistantUiThread from "./AssistantUiThread";

const OPENING_QUESTION = "Erste Frage: Was braucht eine Pflanze?";
const VERDICT = '{"advance":false,"confidence":0.4,"reason":"ok","suggested_step":1}';

interface ProviderRequest {
    url: string;
    stream: boolean;
}

let providerRequests: ProviderRequest[];
let streamReplies: string[];

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
    setPersistedStorageMode("dexie");
    _resetStorageCacheForTests();
    providerRequests = [];
    streamReplies = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : (input as URL).toString();
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const stream = body.stream === true;
        providerRequests.push({url, stream});
        if (stream) return anthropicSseResponse([streamReplies.shift() ?? "Noch eine Eröffnung?"]);
        return new Response(JSON.stringify({content: [{type: "text", text: VERDICT}]}), {
            status: 200,
            headers: {"Content-Type": "application/json"},
        });
    }) as unknown as typeof fetch;
});

afterEach(async () => {
    await _resetDbForTests();
    localStorage.clear();
    _resetStorageCacheForTests();
    vi.restoreAllMocks();
});

/** A learner with a key, an imported chat and a session started from it. */
async function startImportedSession(): Promise<string> {
    const user = await dexieStorage.users.create({name: "A", language: "de"});
    const project = await dexieStorage.users.projects.create(user.id, {
        topic: "Biologie",
        goal: "Biologie lernen",
        timeframe: "1w",
        daily_minutes: 10,
    });
    await dexieStorage.settings.setApiKey(user.id, {provider: "anthropic", key: "sk-fake"});
    const conversation = await dexieStorage.imports.create(user.id, {
        source: "manual",
        title: "Photosynthese",
        model: null,
        source_created_at: null,
        messages: [
            {role: "user", content: "Wie funktioniert Photosynthese?", timestamp: null},
            {role: "assistant", content: "Licht wird zu chemischer Energie.", timestamp: null},
        ],
    });
    const started = await dexieStorage.session.start({
        project_id: project.id,
        lang: "de",
        imported_conversation_id: conversation.id,
    });
    return started.session.id;
}

function openSession(sessionId: string) {
    return render(<AssistantUiThread sessionId={sessionId} autoOpen introTopic="Photosynthese" />);
}

/** Open a fresh imported session and wait until its opening has completed:
 *  the question is on screen and both requests (chat + step evaluator) went
 *  out. Returns the mounted view. */
async function openAndAwaitOpening(sessionId: string) {
    streamReplies.push(OPENING_QUESTION);
    const view = openSession(sessionId);
    await waitFor(() =>
        expect(screen.getByTestId("chat-message-assistant")).toHaveTextContent(OPENING_QUESTION),
    );
    await waitFor(() => expect(providerRequests).toHaveLength(2));
    return view;
}

/** Give a stray opening run time to reach the provider before asserting that
 *  none did: the history read and a run both go through IndexedDB. */
async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("AssistantUiThread opens an imported session once (#3806)", () => {
    it("sends the opening when the session is new: one chat request, one step evaluation", async () => {
        const sessionId = await startImportedSession();
        await openAndAwaitOpening(sessionId);
        expect(providerRequests.map((request) => request.stream)).toEqual([true, false]);
        expect(screen.queryByTestId("chat-message-user")).not.toBeInTheDocument();
    });

    it("sends nothing on a reload and shows the stored conversation", async () => {
        const sessionId = await startImportedSession();
        const first = await openAndAwaitOpening(sessionId);
        first.unmount();

        openSession(sessionId);
        const resumed = await screen.findByTestId("chat-message-assistant");
        await settle();

        expect(providerRequests).toHaveLength(2);
        expect(resumed).toHaveTextContent(OPENING_QUESTION);
        expect(screen.getAllByTestId("chat-message-assistant")).toHaveLength(1);
        // The hidden opening trigger is on record, never a learner bubble.
        expect(screen.queryByTestId("chat-message-user")).not.toBeInTheDocument();
    });

    it("sends nothing from a second tab on the same session", async () => {
        const sessionId = await startImportedSession();
        await openAndAwaitOpening(sessionId);

        const secondTab = openSession(sessionId);
        const bubbles = () =>
            secondTab.container.querySelectorAll('[data-testid="chat-message-assistant"]');
        await waitFor(() => expect(bubbles()).toHaveLength(1));
        await settle();

        expect(providerRequests).toHaveLength(2);
        expect(bubbles()[0]).toHaveTextContent(OPENING_QUESTION);
    });
});
