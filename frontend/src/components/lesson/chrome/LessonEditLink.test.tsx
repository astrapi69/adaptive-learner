/**
 * LessonEditLink — mentor-mode Phase 1 (#2766).
 *
 * The Options-panel entry that deep-links from the running lesson into
 * the editor's edit route for the learner's OWN sets. Pins the gating
 * (user-generated only, analysis sets excluded) and the exact #1740/#2210
 * deep-link target including URL encoding.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {describe, expect, it} from "vitest";

import LessonEditLink from "./LessonEditLink";
import {USER_GENERATED_SOURCE} from "../../../storage/types";

function renderLink(props: {source: string; setId: string; filename: string}) {
    return render(
        <MemoryRouter>
            <LessonEditLink {...props} />
        </MemoryRouter>,
    );
}

describe("LessonEditLink (#2766)", () => {
    it("links a user-generated lesson to the editor edit route", () => {
        renderLink({
            source: USER_GENERATED_SOURCE,
            setId: "my-set",
            filename: "01.json",
        });
        const link = screen.getByTestId("lesson-edit-in-editor");
        expect(link).toHaveAttribute(
            "href",
            "/create-lesson/edit/user-generated/my-set?lesson=01.json",
        );
    });

    it("URL-encodes source, set id and lesson filename", () => {
        renderLink({
            source: USER_GENERATED_SOURCE,
            setId: "set with space",
            filename: "lektion ä.json",
        });
        expect(screen.getByTestId("lesson-edit-in-editor")).toHaveAttribute(
            "href",
            "/create-lesson/edit/user-generated/set%20with%20space?lesson=lektion%20%C3%A4.json",
        );
    });

    it.each([
        {
            label: "downloaded set",
            source: "astrapi69/learn-content",
            setId: "fr-a1-from-en",
        },
        {
            label: "analysis set",
            source: USER_GENERATED_SOURCE,
            setId: "analysis-abc123",
        },
    ])("renders nothing for a $label", ({source, setId}) => {
        renderLink({source, setId, filename: "01.json"});
        expect(
            screen.queryByTestId("lesson-edit-in-editor"),
        ).not.toBeInTheDocument();
    });
});
