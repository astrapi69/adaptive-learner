/**
 * Test helper: the Anthropic ``/v1/messages`` streaming wire.
 *
 * Tests that mock the AI provider at the ``fetch`` layer answer the streamed
 * chat call with this response: one ``content_block_delta`` frame per chunk,
 * then ``message_stop``, which is what the browser-direct ``aiStream`` parses.
 * The step evaluator after the stream sends ``stream: false``, so a mock keeps
 * a plain JSON branch for that call.
 *
 * Shared by the session-flow tests and the thread tests that count provider
 * requests (#3806), so the wire shape lives in one place.
 *
 * @param chunks - The text deltas, in streaming order.
 * @returns A 200 ``text/event-stream`` response carrying the frames.
 *
 * @example
 * global.fetch = vi.fn(async () => anthropicSseResponse(["Hi ", "there!"]));
 */
export function anthropicSseResponse(chunks: string[]): Response {
    const frames = chunks
        .map(
            (c) =>
                `event: content_block_delta\ndata: ${JSON.stringify({
                    type: "content_block_delta",
                    delta: {type: "text_delta", text: c},
                })}`,
        )
        .concat(["event: message_stop\ndata: {\"type\":\"message_stop\"}"]);
    const wire = frames.map((f) => `${f}\n\n`).join("");
    const encoder = new TextEncoder();
    let emitted = false;
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            if (!emitted) {
                controller.enqueue(encoder.encode(wire));
                emitted = true;
            } else {
                controller.close();
            }
        },
    });
    return new Response(stream, {
        status: 200,
        headers: {"Content-Type": "text/event-stream"},
    });
}
