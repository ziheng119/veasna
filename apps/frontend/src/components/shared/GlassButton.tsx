import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ComponentProps } from "react";
import { GLASS_SURFACE, PRESS } from "@/lib/motion";

/** Shared consultation action style; retain native focus and disabled behavior. */
export default function GlassButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button {...props} variant="ghost" className={cn(
    "rounded-full text-foreground transition duration-200 hover:bg-muted/50 hover:shadow-md motion-reduce:transition-none",
    GLASS_SURFACE, PRESS,
    className
  )} />;
}
