import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/12 text-primary [a&]:hover:bg-primary/16",
        active:
          "border-primary/25 bg-primary/14 text-primary [a&]:hover:bg-primary/18",
        inactive:
          "border-border bg-muted text-muted-foreground [a&]:hover:bg-muted/80",
        success:
          "border-emerald-300 bg-emerald-50 text-emerald-700 [a&]:hover:bg-emerald-100",
        warning:
          "border-amber-300 bg-amber-50 text-amber-700 [a&]:hover:bg-amber-100",
        info:
          "border-sky-300 bg-sky-50 text-sky-700 [a&]:hover:bg-sky-100",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-destructive/20 bg-destructive/12 text-destructive [a&]:hover:bg-destructive/18 focus-visible:ring-destructive/20",
        outline:
          "border-border text-foreground bg-card [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
