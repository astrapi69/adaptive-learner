/**
 * Server-Sent Events reader for POST endpoints (v1.6.0 / Phase 19).
 *
 * The native ``EventSource`` API only supports GET. Our streaming
 * route is ``POST /api/plugins/session/{id}/message/stream`` because
 * the user's message goes in the body. We therefore parse the
 * ``text/event-stream`` wire format manually on top of ``fetch`` +
 * ``ReadableStream``.
 *
 * Wire format (W3C SSE):
 *   - One event per blank-line-separated frame.
 *   - Each frame has lines starting with ``event:``, ``data:``,
 *     ``id:``, ``retry:`` (we only consume ``event:`` and ``data:``).
 *   - ``data:`` lines on the same frame are joined with ``\n``.
 *   - We always JSON-encode the ``data`` payload backend-side, so
 *     the reader parses each ``data`` payload as JSON.
 *
 * Cancellation: the caller passes an ``AbortSignal`` that aborts
 * the fetch + stops the loop on the next read. The reader does NOT
 * swallow the abort — it surfaces as a ``DOMException("aborted")``
 * the caller can branch on.
 *
 * No external dependency. ``@microsoft/fetch-event-source`` would
 * give us reconnection + last-event-id resumption, but our endpoint
 * is a one-shot per user message (no reconnection use case yet) so
 * a minimal hand-rolled parser keeps the bundle smaller.
 */

export interface SseEvent {
    /** SSE ``event:`` line value. Default ``"message"`` when omitted. */
    event: string;
    /** Parsed JSON payload of the ``data:`` line(s). */
    data: unknown;
}

export interface StreamSseOptions {
    /** Absolute or relative URL to POST to. */
    url: string;
    /** JSON body. */
    body: unknown;
    /** Additional headers (Content-Type + Accept are added automatically). */
    headers?: Record<string, string>;
    /** AbortSignal to cancel the stream. */
    signal?: AbortSignal;
    /** Called for every parsed SSE event. */
    onEvent: (event: SseEvent) => void;
}

/**
 * Open a POST SSE stream and dispatch every parsed event to
 * ``onEvent`` until the server closes. Resolves on clean close;
 * rejects on transport / parse / abort errors.
 */
export async function streamSse(opts: StreamSseOptions): Promise<void> {
    const response = await fetch(opts.url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(opts.headers ?? {}),
        },
        body: JSON.stringify(opts.body),
        signal: opts.signal,
    });

    if (!response.ok) {
        // Surface the HTTP error verbatim so callers see the same
        // detail shape as ApiError elsewhere in the app.
        const text = await response.text().catch(() => "");
        throw new Error(`SSE request failed (${response.status}): ${text}`);
    }
    if (!response.body) {
        throw new Error("SSE response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
        while (true) {
            const {value, done} = await reader.read();
            if (done) {
                // Flush any final partial frame in the buffer.
                if (buffer.trim().length > 0) {
                    const event = parseFrame(buffer);
                    if (event) opts.onEvent(event);
                }
                return;
            }
            buffer += decoder.decode(value, {stream: true});
            // SSE frames are separated by a blank line (``\n\n``).
            // The buffer may carry a partial frame at the tail; we
            // emit only complete frames here and leave the partial
            // tail for the next chunk.
            let separatorIdx = buffer.indexOf("\n\n");
            while (separatorIdx !== -1) {
                const rawFrame = buffer.slice(0, separatorIdx);
                buffer = buffer.slice(separatorIdx + 2);
                const event = parseFrame(rawFrame);
                if (event) opts.onEvent(event);
                separatorIdx = buffer.indexOf("\n\n");
            }
        }
    } finally {
        // Always release the lock so the underlying stream can be
        // GC'd even on an exception thrown by onEvent.
        try {
            reader.releaseLock();
        } catch {
            /* the reader may already be released after abort */
        }
    }
}

/**
 * Parse one raw SSE frame into a ``SseEvent``. Returns ``null``
 * for frames that have no ``data`` payload (e.g. heartbeat
 * comments — though our backend doesn't emit any).
 */
export function parseFrame(raw: string): SseEvent | null {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
        if (!line) continue;
        if (line.startsWith(":")) continue; // comment line
        const colonIdx = line.indexOf(":");
        const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
        // Per spec: one space after the colon is part of the
        // separator, not the value.
        const rawValue = colonIdx === -1 ? "" : line.slice(colonIdx + 1);
        const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
        if (field === "event") {
            event = value;
        } else if (field === "data") {
            dataLines.push(value);
        }
        // id, retry: ignored — our route doesn't use them.
    }
    if (dataLines.length === 0) {
        return null;
    }
    const dataText = dataLines.join("\n");
    let data: unknown;
    try {
        data = JSON.parse(dataText);
    } catch {
        // Surface the raw string when the server emitted non-JSON
        // (shouldn't happen with our backend; defensive).
        data = dataText;
    }
    return {event, data};
}
