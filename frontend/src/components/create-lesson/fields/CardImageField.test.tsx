/**
 * Tests for the card image upload field (#1763).
 *
 * A real image decode needs a canvas that happy-dom can't run, so the
 * success/compression path is covered in ``card-image.test.ts``. Here we
 * pin the prop-driven UI: preview from a data-URI value, remove, the
 * advanced manual-path fallback, and a clear error on a bad file type
 * (which rejects before any decode).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import CardImageField from "./CardImageField";

const DATA_URI = "data:image/jpeg;base64,AAAA";

describe("CardImageField (#1763)", () => {
    it("shows an upload control and no preview when empty", () => {
        render(<CardImageField value="" onChange={vi.fn()} idPrefix="card" />);
        expect(screen.getByTestId("card-image-upload")).toBeInTheDocument();
        expect(screen.queryByTestId("card-image-preview")).not.toBeInTheDocument();
    });

    it("renders a preview image for a data-URI value, with alt text", () => {
        render(
            <CardImageField
                value={DATA_URI}
                onChange={vi.fn()}
                previewAlt="Bonjour"
                idPrefix="card"
            />,
        );
        const img = screen.getByTestId("card-image-preview") as HTMLImageElement;
        expect(img).toBeInTheDocument();
        expect(img.src).toBe(DATA_URI);
        expect(img.getAttribute("alt")).toBe("Bonjour");
    });

    it("clears the image when Remove is pressed", () => {
        const onChange = vi.fn();
        render(
            <CardImageField value={DATA_URI} onChange={onChange} idPrefix="card" />,
        );
        fireEvent.click(screen.getByTestId("card-image-remove"));
        expect(onChange).toHaveBeenCalledWith("");
    });

    it("exposes an advanced manual-path fallback that emits the typed path", () => {
        const onChange = vi.fn();
        render(<CardImageField value="" onChange={onChange} idPrefix="card" />);
        fireEvent.click(screen.getByTestId("card-image-path-toggle"));
        const path = screen.getByTestId("card-image-path");
        fireEvent.change(path, {target: {value: "img/bonjour.png"}});
        expect(onChange).toHaveBeenCalledWith("img/bonjour.png");
    });

    it("shows the manual path expanded when the value is a plain path", () => {
        render(
            <CardImageField
                value="img/bonjour.png"
                onChange={vi.fn()}
                idPrefix="card"
            />,
        );
        const path = screen.getByTestId("card-image-path") as HTMLInputElement;
        expect(path.value).toBe("img/bonjour.png");
        // A plain path is not a preview image.
        expect(screen.queryByTestId("card-image-preview")).not.toBeInTheDocument();
    });

    it("shows a clear error and does not crash on an unsupported file type", async () => {
        const onChange = vi.fn();
        render(<CardImageField value="" onChange={onChange} idPrefix="card" />);
        const fileInput = screen.getByTestId("card-image-file") as HTMLInputElement;
        const gif = new File(["x"], "a.gif", {type: "image/gif"});
        fireEvent.change(fileInput, {target: {files: [gif]}});
        await waitFor(() =>
            expect(screen.getByTestId("card-image-error")).toBeInTheDocument(),
        );
        expect(onChange).not.toHaveBeenCalled();
    });
});
