"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfirmStore } from "@/stores/useConfirmStore";

/**
 * Single app-wide confirmation dialog. Mount once; trigger it from anywhere
 * with `confirm({ ... })` from useConfirmStore.
 */
export default function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const resolve = useConfirmStore((s) => s.resolve);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resolve(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{options?.title ?? "Are you sure?"}</DialogTitle>
          {options?.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => resolve(false)}>
            {options?.cancelText ?? "Cancel"}
          </Button>
          <Button
            variant={options?.destructive ? "destructive" : "default"}
            onClick={() => resolve(true)}
            autoFocus
          >
            {options?.confirmText ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
