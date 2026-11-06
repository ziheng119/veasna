"use client";

import { ReactNode, useCallback, useRef, useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

export interface ConfirmOptions {
  title: string;
  // One short line: what happens, and what it means.
  description: ReactNode;
  confirmLabel: string;
  // Red confirm button (deleting, removing, discharging). Defaults to true.
  destructive?: boolean;
}

/**
 * The custom confirmation pop-up as a promise: `if (await confirm({...})) doIt()`. Render `dialog`
 * once in the component. Resolves false when cancelled or dismissed.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setOptions(next);
  }), []);

  const close = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      title={options?.title ?? ""}
      description={options?.description ?? ""}
      confirmLabel={options?.confirmLabel ?? "Confirm"}
      destructive={options?.destructive ?? true}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
