import {describe, it, expect, vi, beforeEach} from "vitest";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";

import type {NotDownloadedSet} from "../../lib/learning-path/personal-path";

const downloadMock = vi.fn();
const successMock = vi.fn();
const errorMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {downloadSet: downloadMock},
    }),
}));

vi.mock("../../utils/notify", () => ({
    notify: {
        success: (m: string) => successMock(m),
        error: (m: string) => errorMock(m),
    },
}));

import NotDownloadedSection from "./NotDownloadedSection";

function entry(over: Partial<NotDownloadedSet> = {}): NotDownloadedSet {
    return {
        source: "src",
        setId: "fra2",
        title: "Französisch A2",
        domain: "language",
        lessonCount: 15,
        ...over,
    };
}

beforeEach(() => {
    downloadMock.mockReset();
    successMock.mockReset();
    errorMock.mockReset();
});

describe("NotDownloadedSection", () => {
    it("renders nothing when there are no sets", () => {
        const {container} = render(
            <NotDownloadedSection sets={[]} expanded onDownloaded={vi.fn()} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it("starts collapsed when expanded=false and opens on click", () => {
        render(
            <NotDownloadedSection
                sets={[entry()]}
                expanded={false}
                onDownloaded={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("not-downloaded-list")).toBeNull();
        fireEvent.click(screen.getByTestId("not-downloaded-toggle"));
        expect(screen.getByTestId("not-downloaded-list")).toBeInTheDocument();
    });

    it("lists each set with a lesson count and download button", () => {
        render(
            <NotDownloadedSection
                sets={[entry()]}
                expanded
                onDownloaded={vi.fn()}
            />,
        );
        expect(screen.getByTestId("not-downloaded-fra2")).toHaveTextContent(
            "Französisch A2",
        );
        expect(screen.getByTestId("not-downloaded-fra2")).toHaveTextContent(
            "15",
        );
        expect(
            screen.getByTestId("not-downloaded-download-fra2"),
        ).toBeInTheDocument();
    });

    it("downloads on click and notifies + reloads on success", async () => {
        downloadMock.mockResolvedValue({});
        const onDownloaded = vi.fn();
        render(
            <NotDownloadedSection
                sets={[entry()]}
                expanded
                onDownloaded={onDownloaded}
            />,
        );
        fireEvent.click(screen.getByTestId("not-downloaded-download-fra2"));
        await waitFor(() => expect(onDownloaded).toHaveBeenCalledTimes(1));
        expect(downloadMock).toHaveBeenCalledWith("src", "fra2");
        expect(successMock).toHaveBeenCalled();
    });

    it("notifies on a failed download without reloading", async () => {
        downloadMock.mockRejectedValue(new Error("offline"));
        const onDownloaded = vi.fn();
        render(
            <NotDownloadedSection
                sets={[entry()]}
                expanded
                onDownloaded={onDownloaded}
            />,
        );
        fireEvent.click(screen.getByTestId("not-downloaded-download-fra2"));
        await waitFor(() => expect(errorMock).toHaveBeenCalled());
        expect(onDownloaded).not.toHaveBeenCalled();
    });
});
