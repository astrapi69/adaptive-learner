/**
 * The app's one toast container, aware of a running lesson (#3235).
 *
 * On phones the bottom-right container lies full-width over the bottom
 * edge, exactly where the run footer (Check / Next / Previous / Pause)
 * sits, and an error toast stays until closed: the person who was just
 * told about an error is the same person whose Next button is now
 * covered. While a runner route is active (``useIsLessonActive``, all
 * six runner routes since #3199) the container therefore moves above
 * the footer (``toast-container-above-run-footer`` in toast-theme.css)
 * and every toast closes on a tap, not only on its X. Everywhere else
 * the container keeps its previous shape.
 *
 * @example
 * <AppToastContainer />   // once, inside the router, next to the routes
 */

import {ToastContainer, type ToastContainerProps} from "react-toastify";

import {useIsLessonActive} from "../../hooks/lesson/session/useIsLessonActive";

/** Class that lifts the container above the run footer (toast-theme.css). */
export const ABOVE_RUN_FOOTER_CLASS = "toast-container-above-run-footer";

/**
 * The container props for the current surface. Pure, so the decision is
 * unit-testable: a running lesson lifts the container and lets a tap
 * close a toast; any other route keeps the app-wide defaults.
 */
export function toastContainerProps(lessonActive: boolean): ToastContainerProps {
    return {
        position: "bottom-right",
        autoClose: 5000,
        hideProgressBar: false,
        newestOnTop: true,
        closeOnClick: lessonActive,
        draggable: false,
        pauseOnHover: true,
        theme: "colored",
        className: lessonActive ? ABOVE_RUN_FOOTER_CLASS : undefined,
    };
}

export default function AppToastContainer() {
    const lessonActive = useIsLessonActive();
    return <ToastContainer {...toastContainerProps(lessonActive)} />;
}
