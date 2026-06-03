/**
 * shadcn/ui Input (new-york), hand-authored from the canonical
 * source. Styled via the Phase B semantic-token bridge so it is
 * theme-correct across all 6 themes. Height is bumped to a 44px
 * minimum touch target (Tailwind Phase C convention), overriding
 * shadcn's 36px default.
 */

import * as React from "react";

import {cn} from "@/lib/utils";

const Input = React.forwardRef<
    HTMLInputElement,
    React.ComponentProps<"input">
>(({className, type, ...props}, ref) => {
    return (
        <input
            type={type}
            ref={ref}
            className={cn(
                "flex min-h-11 w-full rounded-md border border-input bg-background" +
                    " px-3 py-2 text-base shadow-sm transition-colors" +
                    " placeholder:text-muted-foreground focus-visible:outline-none" +
                    " focus-visible:ring-1 focus-visible:ring-ring" +
                    " disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
});
Input.displayName = "Input";

export {Input};
