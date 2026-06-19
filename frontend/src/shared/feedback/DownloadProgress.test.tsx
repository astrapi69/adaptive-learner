import {describe, it, expect} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

import DownloadProgress from "./DownloadProgress";

describe("DownloadProgress", () => {
    it("renders the count + progressbar semantics", () => {
        cleanup();
        render(<DownloadProgress current={3} total={5} label="Offline" />);
        expect(screen.getByTestId("download-progress-count")).toHaveTextContent(
            "3 / 5",
        );
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "3");
        expect(bar).toHaveAttribute("aria-valuemax", "5");
        expect(bar).toHaveAttribute("aria-label", "Offline");
    });

    it("clamps current into [0, total]", () => {
        cleanup();
        render(<DownloadProgress current={99} total={5} />);
        expect(screen.getByRole("progressbar")).toHaveAttribute(
            "aria-valuenow",
            "5",
        );
    });

    it("treats total <= 0 as an empty bar", () => {
        cleanup();
        render(<DownloadProgress current={2} total={0} />);
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "0");
        expect(bar).toHaveAttribute("aria-valuemax", "0");
    });

    it("omits the label row when no label is given", () => {
        cleanup();
        render(<DownloadProgress current={1} total={2} />);
        expect(
            screen.queryByTestId("download-progress-count"),
        ).not.toBeInTheDocument();
    });
});
