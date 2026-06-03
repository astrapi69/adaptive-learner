/**
 * shadcn/ui Sheet (new-york), hand-authored from the canonical source
 * (the registry CLI is unreachable in this environment). A Dialog
 * variant that anchors to a viewport edge as a slide-over panel
 * instead of centering. Wraps @radix-ui/react-dialog (already a
 * project dependency) and styles via the Phase B semantic-token
 * bridge so it is correct across all 6 themes.
 *
 * Like ui/dialog.tsx, the project ships no tailwindcss-animate plugin,
 * so the canonical enter/exit slide animations are intentionally
 * omitted. This is also load-bearing for tests: a CSS transition would
 * make Radix's Presence wait for a transitionend that happy-dom never
 * fires, leaving the panel mounted after close and breaking the
 * close-on-click unit tests. Radix still provides the focus trap,
 * escape-to-close, outside-click-to-close, and scroll lock.
 *
 * SheetContent props:
 *  - ``side``: "right" (default) | "left" | "top" | "bottom"
 *  - ``showCloseButton`` (default true): pass ``false`` to supply your
 *    own close control (e.g. a header button carrying its own testid).
 */

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import {cva, type VariantProps} from "class-variance-authority";
import {X} from "lucide-react";

import {cn} from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({className, ...props}, ref) => (
    <SheetPrimitive.Overlay
        ref={ref}
        className={cn("fixed inset-0 z-[1200] bg-[var(--bg-overlay)]", className)}
        {...props}
    />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
    "fixed z-[1201] flex flex-col bg-[var(--surface)]" +
        " shadow-[var(--shadow-elevated)] focus:outline-none",
    {
        variants: {
            side: {
                right:
                    "inset-y-0 right-0 h-full w-[min(640px,100vw)]" +
                    " border-l border-border",
                left:
                    "inset-y-0 left-0 h-full w-[min(640px,100vw)]" +
                    " border-r border-border",
                top: "inset-x-0 top-0 max-h-[90vh] border-b border-border",
                bottom: "inset-x-0 bottom-0 max-h-[90vh] border-t border-border",
            },
        },
        defaultVariants: {side: "right"},
    },
);

interface SheetContentProps
    extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
        VariantProps<typeof sheetVariants> {
    showCloseButton?: boolean;
}

const SheetContent = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Content>,
    SheetContentProps
>(
    (
        {side = "right", className, children, showCloseButton = true, ...props},
        ref,
    ) => (
        <SheetPortal>
            <SheetOverlay />
            <SheetPrimitive.Content
                ref={ref}
                className={cn(sheetVariants({side}), className)}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <SheetPrimitive.Close
                        aria-label="Close"
                        className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-sm text-[var(--fg-muted)] opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <X className="size-5" />
                        <span className="sr-only">Close</span>
                    </SheetPrimitive.Close>
                )}
            </SheetPrimitive.Content>
        </SheetPortal>
    ),
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

function SheetHeader({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "flex flex-col gap-1.5 text-center sm:text-left",
                className,
            )}
            {...props}
        />
    );
}
SheetHeader.displayName = "SheetHeader";

function SheetFooter({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                className,
            )}
            {...props}
        />
    );
}
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({className, ...props}, ref) => (
    <SheetPrimitive.Title
        ref={ref}
        className={cn("text-lg font-semibold text-[var(--fg)]", className)}
        {...props}
    />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({className, ...props}, ref) => (
    <SheetPrimitive.Description
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
    Sheet,
    SheetPortal,
    SheetOverlay,
    SheetTrigger,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
};
