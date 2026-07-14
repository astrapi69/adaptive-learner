/**
 * Tests for the legacy /contribute redirect (#1494).
 *
 * The dedicated "Beitragen" page + its primary-nav entry were dropped: the
 * "Missing Lessons" gap section now renders inline on /content (in context
 * with the downloaded sets it is derived from) and vanishes when there are
 * no gaps. The /contribute route is kept only so old links / bookmarks
 * resolve — it redirects to /content (``replace``).
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Contribute from "./Contribute";

function renderAtContribute() {
  return render(
    <MemoryRouter initialEntries={["/contribute"]}>
      <Routes>
        <Route path="/contribute" element={<Contribute />} />
        <Route
          path="/content"
          element={<div data-testid="content-landing">Content</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("/contribute redirect (#1494)", () => {
  it("redirects to /content", () => {
    renderAtContribute();
    expect(screen.getByTestId("content-landing")).toBeInTheDocument();
  });

  it("renders no contribution page of its own", () => {
    renderAtContribute();
    expect(screen.queryByTestId("contribute-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contribute-empty")).not.toBeInTheDocument();
  });
});
