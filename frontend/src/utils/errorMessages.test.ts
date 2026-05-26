/**
 * Tests for the friendly-error mapping
 * (DEV-MODE-FRIENDLY-ERRORS-01).
 *
 * Pins:
 *  - Each documented status code maps to the expected English
 *    fallback (the i18n catalogue is not loaded in the test
 *    harness, so the resolver returns the built-in fallback).
 *  - Unrecognised status codes fall through to the generic
 *    message.
 *  - The network-error / timeout helpers return their own
 *    dedicated friendly strings.
 *
 *  These pins exist to prevent the v1.26.0 class of bug (raw
 *  HTTP 404 reaching production toasts) from recurring. Any
 *  refactor that drops a status mapping would have to face
 *  these tests first.
 */

import {describe, expect, it} from "vitest";

import {
    friendlyErrorMessage,
    friendlyNetworkErrorMessage,
    friendlyTimeoutMessage,
} from "./errorMessages";

describe("friendlyErrorMessage", () => {
    const cases: Array<[number, string]> = [
        [400, "The request could not be processed."],
        [401, "Access denied. Please check your settings."],
        [403, "Access denied. Please check your settings."],
        [404, "This page or feature was not found."],
        [409, "This action conflicts with the current state."],
        [422, "The request could not be processed."],
        [429, "Too many requests. Please wait a moment and try again."],
        [500, "An internal error occurred."],
        [502, "The AI service is currently unreachable."],
        [503, "The AI service is currently unreachable."],
        [504, "The AI service is currently unreachable."],
    ];

    it.each(cases)(
        "maps status %i → expected friendly text",
        (status, expected) => {
            expect(friendlyErrorMessage({status})).toBe(expected);
        },
    );

    it("falls back to generic for unknown 4xx", () => {
        expect(friendlyErrorMessage({status: 418})).toBe(
            "Something went wrong. Please try again later.",
        );
    });

    it("collapses uncategorised 5xx codes to server message", () => {
        expect(friendlyErrorMessage({status: 599})).toBe(
            "An internal error occurred.",
        );
    });

    it("returns generic when no status is set", () => {
        expect(friendlyErrorMessage({})).toBe(
            "Something went wrong. Please try again later.",
        );
    });

    it("never returns an HTTP-style raw message", () => {
        // Sanity pin against the v1.26.0 regression class: any
        // friendly text must NOT contain "HTTP", "404", a slash-
        // prefixed endpoint path, or words like "stack" /
        // "endpoint" / "trace".
        const banned = ["HTTP", "404", "endpoint", "stack", "trace"];
        for (const [status] of cases) {
            const text = friendlyErrorMessage({status});
            for (const needle of banned) {
                expect(
                    text.toLowerCase().includes(needle.toLowerCase()),
                    `status ${status} text "${text}" must not contain "${needle}"`,
                ).toBe(false);
            }
        }
    });
});

describe("friendlyNetworkErrorMessage / friendlyTimeoutMessage", () => {
    it("network error has its own friendly text", () => {
        expect(friendlyNetworkErrorMessage()).toBe(
            "No connection to the server.",
        );
    });

    it("timeout has its own friendly text", () => {
        expect(friendlyTimeoutMessage()).toBe("The request took too long.");
    });
});
