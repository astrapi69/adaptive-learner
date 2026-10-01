/**
 * #3364 - the lesson tells a learner without a profile that nothing is
 * saved, and links to creating one.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {describe, expect, it} from "vitest";

import LessonNoProfileNotice from "./LessonNoProfileNotice";

describe("LessonNoProfileNotice (#3364)", () => {
    it("says progress is not saved and links to the profile setup", () => {
        render(
            <MemoryRouter>
                <LessonNoProfileNotice userId={null} />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("lesson-no-profile-notice")).toHaveTextContent(/profile/i);
        expect(screen.getByTestId("lesson-no-profile-create")).toHaveAttribute("href", "/onboarding");
    });

    it("renders nothing for a learner with a profile", () => {
        render(
            <MemoryRouter>
                <LessonNoProfileNotice userId="u-1" />
            </MemoryRouter>,
        );
        expect(screen.queryByTestId("lesson-no-profile-notice")).toBeNull();
    });
});
