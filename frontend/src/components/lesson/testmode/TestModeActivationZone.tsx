/**
 * Test-mode activation zone (#2319). Wraps a neutral lesson element (the
 * progress bar) with the hidden multi-tap gesture that turns test mode on.
 *
 * When the build did not opt in (``VITE_TEST_MODE`` unset) the gesture is
 * inert, so the wrapper is a transparent pass-through - it renders its
 * children and nothing else. ``display: contents`` keeps it out of the layout
 * so the wrapped progress bar keeps its flex sizing.
 */

import type {ReactNode} from "react";

import {useTestMode} from "../../../hooks/lesson/modes/useTestMode";
import {useSecretTapGesture} from "../../../hooks/ui/useSecretTapGesture";

export default function TestModeActivationZone({
    children,
}: {
    children: ReactNode;
}) {
    const {available, enabled, enable} = useTestMode();
    const gesture = useSecretTapGesture({
        taps: 6,
        windowMs: 2000,
        enabled: available && !enabled,
        onTrigger: enable,
    });
    return (
        <div {...gesture} data-testid="test-mode-activation" className="contents">
            {children}
        </div>
    );
}
