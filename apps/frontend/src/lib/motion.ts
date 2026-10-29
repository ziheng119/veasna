// Shared motion and surface styles, so interactive controls feel the same across pages.
// Every animation has a motion-reduce fallback for users who ask for less motion.

// Content appearing: fades and rises slightly. Re-runs whenever the element is shown again.
export const ENTER = "animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both motion-reduce:animate-none";

// Faster entrance for small swaps (tab panels, view/edit toggles).
export const ENTER_FAST = "animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none";

// Frosted "glass" pill used by GlassButton and the sliding highlight of segmented controls.
export const GLASS_SURFACE =
  "bg-gradient-to-b from-background/90 to-background/50 ring-1 ring-foreground/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_2px_6px_0_rgba(0,0,0,0.12)] backdrop-blur-md";

// Press feedback for buttons and clickable cards.
export const PRESS = "active:scale-[0.97] motion-reduce:transform-none";
