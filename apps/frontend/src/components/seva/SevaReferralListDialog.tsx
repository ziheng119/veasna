"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SEVA_REFERRALS } from "@/constants/sevaReferral";
import { getSevaReferrals, SevaReferralRow } from "@/lib/api/visit/seva/getSevaReferrals";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserStore } from "@/stores/useUserStore";
import { ClipboardList } from "lucide-react";

// Button that opens the list of patients Seva has marked for referral at the current location.
export default function SevaReferralListDialog() {
  const location = useLocationStore((state) => state.currentLocation);
  const token = useUserStore((state) => state.user?.token);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SevaReferralRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !location || !token) return;

    let cancelled = false;
    setIsLoading(true);
    getSevaReferrals(location.id, token)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        console.error("Failed to load SEVA referrals:", err);
        if (!cancelled) toast.error("Failed to load the referral list");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, location, token]);

  return (
    <>
      <Button type="button" variant="outline" className="shrink-0" onClick={() => setOpen(true)} disabled={!location}>
        <ClipboardList className="size-4" />
        Referral list
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>SEVA referrals{location ? `: ${location.name}` : ""}</DialogTitle>
            <DialogDescription>
              Patients marked for referral on the Seva form, newest visit first.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No patients have been marked for referral.</p>
          ) : (
            SEVA_REFERRALS.map((referral) => {
              const group = rows.filter((row) => row.referral === referral.id);
              if (group.length === 0) return null;
              return (
                <div key={referral.id} className="space-y-2">
                  <h3 className="font-semibold text-foreground">
                    {referral.label} <span className="font-normal text-muted-foreground">({group.length})</span>
                  </h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Seen</th>
                          <th className="px-3 py-2 font-medium">English name</th>
                          <th className="px-3 py-2 font-medium">Khmer name</th>
                          <th className="px-3 py-2 font-medium">Sex</th>
                          <th className="px-3 py-2 font-medium">Date of birth</th>
                          <th className="px-3 py-2 font-medium">Phone</th>
                          <th className="px-3 py-2 font-medium">Diagnosis</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {group.map((row) => (
                          <tr key={row.visit_id}>
                            <td className="whitespace-nowrap px-3 py-2">{row.visit_date}</td>
                            <td className="px-3 py-2">{row.english_name || "-"}</td>
                            <td className="px-3 py-2">{row.khmer_name || "-"}</td>
                            <td className="px-3 py-2">{row.sex || "-"}</td>
                            <td className="whitespace-nowrap px-3 py-2">{row.date_of_birth || "-"}</td>
                            <td className="px-3 py-2">{row.phone_number || "-"}</td>
                            <td className="px-3 py-2">{row.diagnosis || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
