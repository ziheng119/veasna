"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  // While true, both buttons are disabled and the dialog can't be dismissed.
  busy?: boolean;
  // Red confirm button, for deleting or removing something.
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A confirmation in the centre of the screen, in place of the browser's own pop-up. */
export default function ConfirmDialog({ open, title, description, confirmLabel, busy = false, destructive = false, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>
            {busy ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
