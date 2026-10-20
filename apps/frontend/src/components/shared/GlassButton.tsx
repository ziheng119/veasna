import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ComponentProps } from "react";

/** Shared consultation action style; retain native focus and disabled behavior. */
export default function GlassButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button {...props} variant="ghost" className={cn(
    "rounded-full bg-gradient-to-b from-background/90 to-background/50 text-foreground ring-1 ring-foreground/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_2px_6px_0_rgba(0,0,0,0.12)] backdrop-blur-md transition duration-200 hover:bg-muted/50 hover:shadow-md active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none",
    className
  )} />;
}
