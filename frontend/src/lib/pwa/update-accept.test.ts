/**
 * Tests for the update-accept persistence + suppression helpers (#846): once
 * the user clicks "Aktualisieren" the banner must stay suppressed for the quiet
 * window and for the accepted version, while a genuinely newer version (after
 * the window) re-offers it.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ACCEPT_QUIET_MS,
  ACCEPTED_AT_KEY,
  ACCEPTED_SESSION_KEY,
  ACCEPTED_VERSION_KEY,
  readAcceptedAt,
  readAcceptedThisSession,
  readAcceptedVersion,
  recordUpdateAccepted,
  shouldShowUpdateBanner,
} from "./update-accept";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("recordUpdateAccepted", () => {
  it("stores the ISO timestamp and the accepted version", () => {
    const now = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted("1.91.0", "aaa1111", now);
    expect(localStorage.getItem(ACCEPTED_AT_KEY)).toBe("2026-06-20T10:00:00.000Z");
    expect(localStorage.getItem(ACCEPTED_VERSION_KEY)).toBe("1.91.0");
    expect(readAcceptedAt()).toBe("2026-06-20T10:00:00.000Z");
    expect(readAcceptedVersion()).toBe("1.91.0");
  });

  it("stamps the timestamp even when the version is unknown (SW-only update)", () => {
    const now = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted(null, null, now);
    expect(localStorage.getItem(ACCEPTED_AT_KEY)).toBe("2026-06-20T10:00:00.000Z");
    expect(localStorage.getItem(ACCEPTED_VERSION_KEY)).toBeNull();
  });

  it("sets the in-session guard flag (#845)", () => {
    recordUpdateAccepted("1.91.0");
    expect(sessionStorage.getItem(ACCEPTED_SESSION_KEY)).toBe("true");
    expect(readAcceptedThisSession()).toBe(true);
  });
});

describe("shouldShowUpdateBanner", () => {
  it("shows the banner when nothing was ever accepted", () => {
    expect(shouldShowUpdateBanner("1.91.0")).toBe(true);
  });

  it("suppresses within the 1-hour quiet window (any version)", () => {
    const accepted = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted("1.91.0", "aaa1111", accepted);

    // 30 seconds later — well inside the quiet window.
    expect(shouldShowUpdateBanner("1.91.0", "aaa1111", accepted + 30_000)).toBe(false);
    // A newer version still suppressed while the window is open.
    expect(shouldShowUpdateBanner("1.92.0", "bbb2222", accepted + 30_000)).toBe(false);
    // Just before the window closes.
    expect(shouldShowUpdateBanner("1.92.0", "bbb2222", accepted + ACCEPT_QUIET_MS - 1)).toBe(false);
  });

  it("keeps suppressing the SAME accepted version after the quiet window", () => {
    const accepted = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted("1.91.0", "aaa1111", accepted);
    // 2 hours later: window closed, but the version was already accepted.
    expect(shouldShowUpdateBanner("1.91.0", "aaa1111", accepted + 2 * ACCEPT_QUIET_MS)).toBe(false);
  });

  it("re-offers a NEWER version once the quiet window has passed (fresh session)", () => {
    const accepted = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted("1.91.0", "aaa1111", accepted);
    // The in-session guard (#845) only applies within the accepting session;
    // a fresh session falls back to the localStorage quiet-window logic.
    sessionStorage.clear();
    // 2 hours later, a newer deploy — banner comes back.
    expect(shouldShowUpdateBanner("1.92.0", "bbb2222", accepted + 2 * ACCEPT_QUIET_MS)).toBe(true);
  });

  it("suppresses for the rest of the session once accepted, regardless of version or clock (#845)", () => {
    const accepted = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted("1.91.0", "aaa1111", accepted);
    // Even a much newer version, long after the quiet window, stays suppressed
    // while the session flag is set — this is the hard re-nag guard.
    expect(
      shouldShowUpdateBanner("2.0.0", "ccc3333", accepted + 10 * ACCEPT_QUIET_MS),
    ).toBe(false);
  });

  it("session guard suppresses even when localStorage was never written", () => {
    // Simulate the sessionStorage flag set without the localStorage timestamp
    // (e.g. a private-mode localStorage write that failed).
    sessionStorage.setItem(ACCEPTED_SESSION_KEY, "true");
    expect(shouldShowUpdateBanner("1.92.0")).toBe(false);
  });

  // #1382 — the Latest strand: the version string never changes between
  // deploys, only the build hash moves. Version-keyed suppression alone
  // muted the banner FOREVER after one accepted update.
  it("re-offers a SAME-version deploy with a NEWER hash after the quiet window (#1382, Latest)", () => {
    const accepted = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted("1.99.0", "aaa1111", accepted);
    sessionStorage.clear(); // fresh session — the #845 guard does not apply
    expect(
      shouldShowUpdateBanner("1.99.0", "bbb2222", accepted + 2 * ACCEPT_QUIET_MS),
    ).toBe(true);
  });

  it("keeps suppressing the SAME version+hash after the quiet window (#1382)", () => {
    const accepted = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted("1.99.0", "aaa1111", accepted);
    sessionStorage.clear();
    expect(
      shouldShowUpdateBanner("1.99.0", "aaa1111", accepted + 2 * ACCEPT_QUIET_MS),
    ).toBe(false);
  });

  it("falls back to version-only suppression when the hash is unknown (#1382)", () => {
    const accepted = Date.parse("2026-06-20T10:00:00.000Z");
    recordUpdateAccepted("1.99.0", null, accepted);
    sessionStorage.clear();
    expect(
      shouldShowUpdateBanner("1.99.0", null, accepted + 2 * ACCEPT_QUIET_MS),
    ).toBe(false);
  });

  it("treats a corrupt timestamp as no acceptance (fails open to showing)", () => {
    localStorage.setItem(ACCEPTED_AT_KEY, "not-a-date");
    localStorage.setItem(ACCEPTED_VERSION_KEY, "1.91.0");
    // Quiet window can't apply (unparseable), and a different version isn't the
    // accepted one, so a newer version shows.
    expect(shouldShowUpdateBanner("1.92.0")).toBe(true);
  });
});
