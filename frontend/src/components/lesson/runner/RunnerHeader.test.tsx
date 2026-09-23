/**
 * RunnerHeader (EXP-052 slice 1, refs #3169).
 *
 * The session variant every session runner renders today (back button,
 * full title, optional subtitle), generalised over the testid prefix and
 * the policy's ``exit``; the set-link variant is slice 4's, the
 * run-time back button slice 3's, both pinned here only as far as this
 * slice builds them.
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
  it("back-button (Error Replay, slice 3) renders the session variant's back button", () => {
    mount(<RunnerHeader policy={ERROR_REPLAY_POLICY} source={SOURCE} />);
    expect(screen.getByTestId("error-replay-back-btn")).toBeInTheDocument();
  });

  it("set-link (lesson, slice 4) renders the title and no back button", () => {
    mount(<RunnerHeader policy={LESSON_POLICY} source={SOURCE} />);
    expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("Review session");
    expect(screen.queryByTestId("lesson-back-btn")).toBeNull();
  });
});
