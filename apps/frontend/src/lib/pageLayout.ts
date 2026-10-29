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

// Always reserve the scrollbar's width, so content does not jump sideways when switching to
// content tall enough to scroll (e.g. between tabs). Add next to PANEL_SCROLL.
export const STABLE_SCROLLBAR = "[scrollbar-gutter:stable]";

// Opt-in compact summaries: headers stay visible while each body scrolls independently.
export const COMPACT_SUMMARY_CARD = "min-h-0 min-w-0 overflow-hidden gap-3 py-4";
export const COMPACT_SUMMARY_HEADER = "shrink-0 px-4 text-base [.border-b]:pb-3";
export const COMPACT_SUMMARY_CONTENT =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 space-y-3 text-sm leading-5 break-words [&_h1]:text-sm [&_h2]:text-sm [&_textarea]:text-sm";
