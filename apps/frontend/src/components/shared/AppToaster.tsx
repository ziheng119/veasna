"use client";

// The app's toasts (react-hot-toast), each with an × on the right to close it before it times out.
import toast, { ToastBar, Toaster } from "react-hot-toast";
import { X } from "lucide-react";

export default function AppToaster() {
  return (
    <Toaster position="top-center">
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              {message}
              {t.type !== "loading" && (
                <button
                  type="button"
                  aria-label="Close notification"
                  onClick={() => toast.dismiss(t.id)}
                  className="-mr-1 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}
