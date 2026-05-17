/**
 * Tests for the toast notification utility.
 */

import {describe, it, expect, vi, beforeEach} from "vitest";

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import {toast} from "react-toastify";
import {notify} from "./notify";

beforeEach(() => {
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.warning).mockReset();
  vi.mocked(toast.info).mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("notify", () => {
  it("error forwards the message and sets autoClose to 12s", () => {
    notify.error("boom");
    expect(toast.error).toHaveBeenCalledWith("boom", {autoClose: 12000});
  });

  it("warning forwards the message and sets autoClose to 10s", () => {
    notify.warning("warn");
    expect(toast.warning).toHaveBeenCalledWith("warn", {autoClose: 10000});
  });

  it("info forwards the message and sets autoClose to 8s", () => {
    notify.info("fyi");
    expect(toast.info).toHaveBeenCalledWith("fyi", {autoClose: 8000});
  });

  it("success forwards the message and sets autoClose to 5s", () => {
    notify.success("done");
    expect(toast.success).toHaveBeenCalledWith("done", {autoClose: 5000});
  });
});
