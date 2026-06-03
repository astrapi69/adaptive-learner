/**
 * shadcn/ui Progress (new-york), hand-authored from the canonical
 * source. Wraps @radix-ui/react-progress (Radix provides
 * role="progressbar" + aria-valuemin/max/now from `value`). Styled
 * via the Phase B semantic-token bridge so it is theme-correct
 * across all 6 themes.
 *
 * Best fit for THIN, label-less bars (XP, download progress). Thick
 * bars with an overlaid label (lesson step, missions) are a
 * different pattern and stay on their bespoke CSS.
 */

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import {cn} from "@/lib/utils";

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({className, value, ...props}, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        // Pass value to the Root (not just the indicator) so Radix
        // emits role="progressbar" + aria-valuenow/min/max + data-state.
        value={value}
        className={cn(
            "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
            className,
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className="h-full w-full flex-1 bg-primary transition-all"
            style={{transform: `translateX(-${100 - (value || 0)}%)`}}
        />
    </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export {Progress};
