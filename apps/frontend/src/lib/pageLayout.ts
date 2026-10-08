// Standard page layout classes: on wide screens (xl and up) a page fills the space between
// the top nav and the footer, and its panels scroll individually instead of the whole page.
// On narrower screens panels stack and the main area scrolls.

// Root of a page. Fixed-height rows (headers, search bars) go directly inside it.
export const PAGE_SHELL = "flex flex-col gap-5 xl:h-full xl:min-h-[520px]";

// 12-column row of panels that takes the remaining height. Panels use `xl:col-span-*`.
export const PANEL_GRID =
  "grid grid-cols-1 gap-6 xl:grid-cols-12 xl:grid-rows-1 xl:h-full xl:min-h-0 xl:flex-1";

// For a plain wrapper around a panel, so the panel inside can shrink and scroll.
export const PANEL_WRAPPER = "xl:min-h-0";

// For a panel that is not a PageCard (PageCard scrolls its content by default).
export const PANEL_SCROLL = "xl:min-h-0 xl:overflow-y-auto";
