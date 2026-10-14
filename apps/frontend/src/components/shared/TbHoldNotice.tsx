import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { QueuedPatient } from "@/lib/types/patient";

// Shown instead of a station's forms when the patient is on TB hold (waiting at the TB tent).
export default function TbHoldNotice({ patient }: { patient: QueuedPatient }) {
  return (
    <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-destructive/40 bg-destructive/5 p-6 text-center">
      <ShieldAlert className="size-10 text-destructive" />
      <h2 className="text-lg font-semibold text-destructive">Suspected TB: keep in the TB tent</h2>
      <p className="max-w-md text-sm text-foreground">
        {patient.english_name || "This patient"} (queue {patient.queue_no}) has TB red flags and cannot be
        seen at other stations until a TB doctor clears them.
      </p>
      <Link href="/tb-tent" className="text-sm font-medium text-primary underline underline-offset-4">
        Go to the TB Tent
      </Link>
    </div>
  );
}
