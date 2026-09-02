import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  _resolve: ((value: boolean) => void) | null;
  /** Open the dialog and resolve to the user's choice. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Called by the dialog with the user's answer. */
  resolve: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  _resolve: null,

  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      // If a prior prompt is somehow still open, treat it as cancelled.
      get()._resolve?.(false);
      set({ open: true, options, _resolve: resolve });
    }),

  resolve: (value) => {
    get()._resolve?.(value);
    // Keep `options` set so the text doesn't flash blank during the dialog's
    // close animation; the next confirm() call replaces it.
    set({ open: false, _resolve: null });
  },
}));

/**
 * Imperative confirm, a drop-in replacement for window.confirm() that returns
 * a Promise. Requires <ConfirmDialog /> to be mounted (see app/layout.tsx).
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().confirm(options);
}
