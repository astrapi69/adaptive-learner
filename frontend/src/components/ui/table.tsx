/**
 * shadcn/ui Table (new-york). Hand-authored canonical source; pure
 * presentational table primitives, no dependencies. Styled via the
 * semantic-token bridge (border-border, text-fg-muted, text-foreground)
 * so it is theme-correct across all 12 themes.
 */

import * as React from "react";

import {cn} from "@/lib/utils";

const Table = React.forwardRef<
    HTMLTableElement,
    React.HTMLAttributes<HTMLTableElement>
>(({className, ...props}, ref) => (
    <div className="relative w-full overflow-x-auto">
        <table
            ref={ref}
            className={cn("w-full caption-bottom border-collapse text-sm", className)}
            {...props}
        />
    </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({className, ...props}, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({className, ...props}, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
    HTMLTableRowElement,
    React.HTMLAttributes<HTMLTableRowElement>
>(({className, ...props}, ref) => (
    <tr
        ref={ref}
        className={cn(
            "border-b border-border transition-colors hover:bg-muted/50",
            className,
        )}
        {...props}
    />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
    HTMLTableCellElement,
    React.ThHTMLAttributes<HTMLTableCellElement>
>(({className, ...props}, ref) => (
    <th
        ref={ref}
        scope="col"
        className={cn(
            "h-10 px-2 py-1 text-left align-middle font-semibold text-fg-muted",
            className,
        )}
        {...props}
    />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
    HTMLTableCellElement,
    React.TdHTMLAttributes<HTMLTableCellElement>
>(({className, ...props}, ref) => (
    <td
        ref={ref}
        className={cn("px-2 py-1 align-middle text-foreground", className)}
        {...props}
    />
));
TableCell.displayName = "TableCell";

export {Table, TableHeader, TableBody, TableRow, TableHead, TableCell};
