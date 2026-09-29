import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {describe, expect, it, vi} from "vitest";

import AppToastContainer, {
    ABOVE_RUN_FOOTER_CLASS,
    toastContainerProps,
} from "./AppToastContainer";

const containerProps = vi.fn();
vi.mock("react-toastify", () => ({
    ToastContainer: (props: Record<string, unknown>) => {
        containerProps(props);
        return <div data-testid="toast-container-stub" />;
    },
}));

describe("toastContainerProps (#3235)", () => {
    it("keeps the app-wide shape outside a run: bottom-right, no tap-to-close, no lift", () => {
        const props = toastContainerProps(false);
        expect(props).toMatchObject({
            position: "bottom-right",
            closeOnClick: false,
            draggable: false,
            theme: "colored",
        });
        expect(props.className).toBeUndefined();
    });

    it("lifts the container above the run footer and closes on a tap during a run", () => {
        const props = toastContainerProps(true);
        expect(props.position).toBe("bottom-right");
        expect(props.closeOnClick).toBe(true);
        expect(props.className).toBe(ABOVE_RUN_FOOTER_CLASS);
    });
});

describe("AppToastContainer", () => {
    it.each([
        ["/lesson/set-slug/set-id/01.json", true],
        ["/review/set-id", true],
        ["/endless-lesson/set-id", true],
        ["/dashboard", false],
        ["/create-lesson", false],
    ])("on %s the run mode is %s", (path, lifted) => {
        containerProps.mockClear();
        render(
            <MemoryRouter initialEntries={[path]}>
                <AppToastContainer />
            </MemoryRouter>,
        );
        expect(containerProps).toHaveBeenCalledOnce();
        const props = containerProps.mock.calls[0][0];
        expect(props.closeOnClick).toBe(lifted);
        expect(props.className).toBe(lifted ? ABOVE_RUN_FOOTER_CLASS : undefined);
    });
});
