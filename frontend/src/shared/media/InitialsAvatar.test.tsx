import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import InitialsAvatar, {initialsOf, nameLeadingWithInitials} from "./InitialsAvatar";

describe("initialsOf", () => {
    it("takes the first letters of the first two words, uppercased", () => {
        expect(initialsOf("Asterios Raptis")).toBe("AR");
        expect(initialsOf("jane")).toBe("J");
        expect(initialsOf("  multiple   spaced   words ")).toBe("MS");
    });

    it("falls back to ? for an empty name", () => {
        expect(initialsOf("")).toBe("?");
        expect(initialsOf("   ")).toBe("?");
    });
});

describe("nameLeadingWithInitials (#3865)", () => {
    it("leads a control's name with the initials it shows", () => {
        expect(nameLeadingWithInitials("Your profile", "Ada Lovelace", true)).toBe("AL, Your profile");
    });

    it("keeps the label alone when the control shows a picture instead", () => {
        expect(nameLeadingWithInitials("Your profile", "Ada Lovelace", false)).toBe("Your profile");
    });

    it("keeps the label alone for an empty name, whose ? is no word to speak", () => {
        expect(nameLeadingWithInitials("Your profile", "  ", true)).toBe("Your profile");
    });
});

describe("InitialsAvatar", () => {
    it("renders the initials with an accessible name and a square size", () => {
        render(<InitialsAvatar name="Jane Doe" size={48} testId="a" />);
        const el = screen.getByTestId("a");
        expect(el).toHaveTextContent("JD");
        expect(el).toHaveAttribute("aria-label", "Jane Doe");
        expect(el).toHaveStyle({width: "48px", height: "48px"});
    });

    it("uses a token-backed colour by default and accepts an override", () => {
        const {rerender} = render(<InitialsAvatar name="x" testId="a" />);
        expect(screen.getByTestId("a").className).toContain("bg-primary");
        rerender(<InitialsAvatar name="x" className="bg-secondary" testId="a" />);
        expect(screen.getByTestId("a").className).toContain("bg-secondary");
    });
});
