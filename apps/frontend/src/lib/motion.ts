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

// Small icon buttons (table actions): pop out on hover with a soft tinted circle.
export const POP =
  "rounded-md p-1.5 transition-[transform,background-color,box-shadow,color] duration-150 hover:scale-115 hover:bg-primary/10 hover:shadow-sm active:scale-95 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transform-none";

// Clickable cards (queue cards, pick lists): lift slightly with a shadow on hover.
export const LIFT =
  "transition-[transform,box-shadow,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none";
