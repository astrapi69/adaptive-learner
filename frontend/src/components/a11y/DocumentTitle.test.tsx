import "fake-indexeddb/auto";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "../../hooks/ui/useI18n";
import { _resetStorageCacheForTests } from "../../storage";
import { DocumentTitle } from "./DocumentTitle";

let navigateTo: (path: string) => void = () => {};

function NavigateHandle() {
  navigateTo = useNavigate();
  return null;
}

afterEach(() => {
  document.title = "";
  localStorage.clear();
  _resetStorageCacheForTests();
});

describe("DocumentTitle (#3431)", () => {
  it("names the page and follows a route change", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <DocumentTitle />
        <NavigateHandle />
      </MemoryRouter>,
    );
    expect(document.title).toBe("Settings - Adaptive Learner");

    act(() => navigateTo("/dashboard"));
    expect(document.title).toBe("Dashboard - Adaptive Learner");

    act(() => navigateTo("/"));
    expect(document.title).toBe("Adaptive Learner");
  });
});

describe("DocumentTitle follows the UI language (#3431)", () => {
  function LangSwitch() {
    const { setLang } = useI18n();
    return (
      <button type="button" data-testid="to-de" onClick={() => setLang("de")}>
        de
      </button>
    );
  }

  it("re-titles the page when the language changes", async () => {
    // The catalogs load through the storage layer; Dexie mode reads the
    // bundled JSON, API mode would need a backend.
    localStorage.setItem("adaptive-learner.storage_mode", "dexie");
    _resetStorageCacheForTests();
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <I18nProvider>
          <DocumentTitle />
          <LangSwitch />
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.title).toMatch(/ - Adaptive Learner$/));

    fireEvent.click(screen.getByTestId("to-de"));
    await waitFor(() => expect(document.title).toBe("Einstellungen - Adaptive Learner"));
  });
});
