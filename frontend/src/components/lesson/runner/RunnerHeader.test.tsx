/**
 * RunnerHeader (EXP-052 slice 1, refs #3169).
 *
 * The session variant every session runner renders today (back button,
 * full title, optional subtitle), generalised over the testid prefix and
 * the policy's ``exit``; the run-time back button (slice 3, Error Replay)
 * leaves to the source's ``backTo``; the set-link variant is slice 4's,
 * pinned here only as far as it is built.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";
import {describe, expect, it} from "vitest";

import RunnerHeader from "./RunnerHeader";
import {ERROR_REPLAY_POLICY, LESSON_POLICY, REVIEW_POLICY} from "./policies";
import type {RunnerSource} from "./types";

const SOURCE: RunnerSource = {
  status: "ready",
  error: null,
  title: "Review session",
  subtitle: "Reviewing 3 elements",
  step: null,
  cards: [],
  setId: "fr-a1",
  lessonId: "l1",
  runKey: "fr-a1#0",
  position: {index: 0, total: 3},
  isSummary: false,
  tallies: {correct: 0, total: 0},
  goNext: () => {},
  recordStepAttempts: async () => {},
};

function mount(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/review/fr-a1"]}>
      <Routes>
        <Route path="/review/:setId" element={ui} />
        <Route path="/dashboard" element={<div data-testid="dashboard-stub" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RunnerHeader: session variant", () => {
  it("renders the back button, the full title and the subtitle under the prefix", () => {
    mount(<RunnerHeader policy={REVIEW_POLICY} source={SOURCE} />);
    expect(screen.getByTestId("review-back-btn")).toBeInTheDocument();
    expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("Review session");
    expect(screen.getByTestId("review-subtitle")).toHaveTextContent("Reviewing 3 elements");
  });

  it("the back button navigates to the policy's backTo route", () => {
    mount(<RunnerHeader policy={REVIEW_POLICY} source={SOURCE} />);
    fireEvent.click(screen.getByTestId("review-back-btn"));
    expect(screen.getByTestId("dashboard-stub")).toBeInTheDocument();
  });

  // #2761 moved into the shell (slice 3): a long unbreakable title word
  // ("Organisationspsychologie") must break instead of widening the page,
  // or iOS WebKit clips the sticky footer's Next button (#1834 class).
  it("the title wraps a long unbreakable word instead of overflowing sideways (#2761)", () => {
    mount(<RunnerHeader policy={REVIEW_POLICY} source={SOURCE} />);
    expect(screen.getByRole("heading", {level: 1})).toHaveClass("wrap-anywhere");
  });

  it("edge: no subtitle element when the source carries none", () => {
    mount(<RunnerHeader policy={REVIEW_POLICY} source={{...SOURCE, subtitle: undefined}} />);
    expect(screen.queryByTestId("review-subtitle")).toBeNull();
  });

  it("renders the header extension under the title", () => {
    mount(
      <RunnerHeader
        policy={REVIEW_POLICY}
        source={SOURCE}
        headerExtra={(source) => <p data-testid="extra">{source.title}!</p>}
      />,
    );
    expect(screen.getByTestId("extra")).toHaveTextContent("Review session!");
  });
});

describe("RunnerHeader: the other two exits (slices 3 and 4)", () => {
  function mountReplay(source: RunnerSource) {
    return render(
      <MemoryRouter initialEntries={["/error-replay/slug/fr-a1/03.json"]}>
        <Routes>
          <Route
            path="/error-replay/:setSlug/:setId/:filename"
            element={<RunnerHeader policy={ERROR_REPLAY_POLICY} source={source} />}
          />
          <Route path="/lesson/:setSlug/:setId/:filename" element={<div data-testid="lesson-stub" />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-stub" />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("back-button (Error Replay, slice 3) leaves to the source's run-time destination", () => {
    mountReplay({...SOURCE, backTo: "/lesson/slug/fr-a1/03.json"});
    const back = screen.getByTestId("error-replay-back-btn");
    expect(back).toHaveTextContent("Back to lesson");
    expect(back).toHaveAttribute("aria-label", "Back to lesson");
    fireEvent.click(back);
    expect(screen.getByTestId("lesson-stub")).toBeInTheDocument();
  });

  it("edge: back-button without a destination renders no back button (no guessed history step)", () => {
    mountReplay({...SOURCE, backTo: undefined});
    expect(screen.queryByTestId("error-replay-back-btn")).toBeNull();
    expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("Review session");
  });

  it("set-link (lesson, slice 4) renders the title and no back button", () => {
    mount(<RunnerHeader policy={LESSON_POLICY} source={SOURCE} />);
    expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("Review session");
    expect(screen.queryByTestId("lesson-back-btn")).toBeNull();
  });
});
