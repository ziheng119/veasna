"use client";

import { useEffect, useState } from "react";
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import toast from "react-hot-toast";
import GlassButton from "@/components/shared/GlassButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sevaReferralLabel } from "@/constants/sevaReferral";
import type { FormOption } from "@/lib/types/formOptions";
import type { PartnerNgoReferralType } from "@/lib/api/analytics";
import { useFormOptions } from "@/stores/useFormOptionsStore";
import PartnerNgoReferralTables from "./PartnerNgoReferralTables";
import { getSevaReferrals, SevaReferralRow } from "@/lib/api/visit/seva/getSevaReferrals";
import { useUserStore } from "@/stores/useUserStore";
import { ClipboardList } from "lucide-react";

// One table per referral type, in the order of the Station data list; a type since removed from it
// comes after, under its saved id.
function groupByType(rows: SevaReferralRow[], options: FormOption[]): PartnerNgoReferralType[] {
  const ids = [...options.map((option) => option.id), ...rows.map((row) => row.referral)].filter((id, i, all) => all.indexOf(id) === i);
  return ids.map((id) => ({
    id,
    label: sevaReferralLabel(id, options),
    listed: options.some((option) => option.id === id),
    patients: rows.filter((row) => row.referral === id).map((row) => ({
      visitId: row.visit_id, patientId: row.patient_id, queueNo: row.queue_no, visitDate: row.visit_date,
      referral: row.referral, referralDate: row.date_of_referral, diagnosis: row.diagnosis,
      englishName: row.english_name, khmerName: row.khmer_name, sex: row.sex, dateOfBirth: row.date_of_birth, phone: row.phone_number,
    })),
  }));
}

// Button that opens the list of patients the partner NGO station has marked for referral.
export default function SevaReferralListDialog() {
  const token = useUserStore((state) => state.user?.token);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SevaReferralRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const referralTypes = useFormOptions("seva_referrals");

  useEffect(() => {
    if (!open || !token) return;

    let cancelled = false;
    setIsLoading(true);
    getSevaReferrals(token)
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
  }, [open, token]);

  return (
    <>
      {/* At the bottom of the queue column; icon only when the queue is folded. */}
      <GlassButton type="button" className="shrink-0 px-4 in-data-queue-compact:px-2.5" onClick={() => setOpen(true)}
        title={`${PARTNER_NGO_NAME} referral list`}>
        <ClipboardList className="size-4" aria-hidden="true" />
        <span className="in-data-queue-compact:sr-only">Referral list</span>
      </GlassButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{PARTNER_NGO_NAME} referrals</DialogTitle>
            <DialogDescription>
              Patients marked for referral on the {PARTNER_NGO_NAME} form, by referral type, newest visit first.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No patients have been marked for referral.</p>
          ) : (
            <PartnerNgoReferralTables types={groupByType(rows, referralTypes)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
