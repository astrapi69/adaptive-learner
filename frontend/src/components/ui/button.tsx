/**
 * shadcn/ui Button (new-york). Hand-authored from the canonical
 * new-york-v4 source (the registry CLI is unreachable in this
 * environment); styled via the Phase B semantic-token bridge in
 * tailwind.css so every variant is theme-correct across all 6 themes.
 *
 * Variants: default (brand primary) / destructive / outline / secondary
 * / ghost / link. Sizes: default / sm / lg / icon. ``asChild`` renders
 * the child element (Radix Slot) so a router <Link> can be a button.
 */

import * as React from "react";
import {Slot} from "@radix-ui/react-slot";
import {cva, type VariantProps} from "class-variance-authority";

import {cn} from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
                // #148 — outline + ghost set no background-tinted text,
                // so they need an explicit ``text-foreground``. Tailwind
                // preflight is OFF in this project, so a colorless button
                // falls back to the UA default (black) and goes invisible
                // on a dark surface. The other variants already pin a
                // foreground color.
                outline:
                    "border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                // 44px minimum touch target on every size variant
                // (mobile learning app — overrides shadcn's 36px h-9
                // default). See Tailwind Phase C / Phase B learnings.
                default: "min-h-11 px-4 py-2",
                sm: "min-h-11 rounded-md px-3 text-xs",
                lg: "min-h-12 rounded-md px-8",
                icon: "size-11",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({className, variant, size, asChild = false, ...props}, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                // #146 — mark button-styled anchors (``asChild`` + a
                // router <Link>) so the global ``a { color:
                // var(--accent) }`` rule skips them and the variant's
                // own text color wins. Without this the unlayered
                // anchor color overrides the layered Tailwind utility,
                // putting accent text on an accent background
                // (invisible in dark mode). Harmless on <button>.
                data-slot="button"
                className={cn(buttonVariants({variant, size, className}))}
                ref={ref}
                {...props}
            />
        );
    },
);
Button.displayName = "Button";

export {Button, buttonVariants};
