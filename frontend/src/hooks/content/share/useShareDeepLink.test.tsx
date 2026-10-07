/**
 * ``/content?share=<setId>`` opens the share flow for that set (#3660).
 * "Save & share" in the lesson creator navigates there after saving.
 */

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { useShareDeepLink } from "./useShareDeepLink";
import { USER_GENERATED_SOURCE, type ContentSetEntry } from "../../../storage/types";

const OWN = { id: "set-1", source: USER_GENERATED_SOURCE } as ContentSetEntry;
const DOWNLOADED = { id: "set-1", source: "repo" } as ContentSetEntry;

function run(entry: string, sets: ContentSetEntry[], loading = false) {
  const onShare = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
  const view = renderHook(
    (props: { loading: boolean }) => {
      useShareDeepLink({ loading: props.loading, sets, onShare });
      return useLocation();
    },
    { wrapper, initialProps: { loading } },
  );
  return { onShare, view };
}

describe("useShareDeepLink (#3660)", () => {
  it("opens the share flow for the user's own set and drops the parameter", () => {
    const { onShare, view } = run("/content?share=set-1", [DOWNLOADED, OWN]);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(OWN);
    expect(view.result.current.search).toBe("?tab=my");
  });

  it("waits until the sets are loaded", () => {
    const { onShare, view } = run("/content?share=set-1", [OWN], true);
    expect(onShare).not.toHaveBeenCalled();
    view.rerender({ loading: false });
    expect(onShare).toHaveBeenCalledWith(OWN);
  });

  it.each([
    ["an unknown set", "/content?share=gone", [OWN]],
    ["a downloaded set with that id", "/content?share=set-1", [DOWNLOADED]],
  ])("ignores %s but still drops the parameter", (_label, entry, sets) => {
    const { onShare, view } = run(entry, sets);
    expect(onShare).not.toHaveBeenCalled();
    expect(view.result.current.search).toBe("?tab=my");
  });

  it("does nothing without the parameter", () => {
    const { onShare, view } = run("/content?tab=my", [OWN]);
    expect(onShare).not.toHaveBeenCalled();
    expect(view.result.current.search).toBe("?tab=my");
  });
});
