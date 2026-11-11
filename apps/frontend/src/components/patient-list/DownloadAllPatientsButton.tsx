"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { isAdmin } from "@/lib/permissions";
import { downloadFile, toCsv } from "@/components/analytics/exportCsv";
import { hostToday } from "@/stores/useHostClockStore";

/**
 * Admin only: a spreadsheet of every patient and every visit, all locations and dates, one row per
 * visit (apps/backend/routes/export.js). Column names are the database's.
 */
export default function DownloadAllPatientsButton() {
  const user = useUserStore((state) => state.user);
  const [busy, setBusy] = useState(false);
  if (!isAdmin(user?.role)) return null;

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${backend_url}/api/export/patients`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || error.message || `Download failed (${res.status})`);
      }
      const rows: Record<string, string | number | boolean | null>[] = await res.json();
      if (!rows.length) {
        toast("There are no patients to download yet.");
        return;
      }
      const columns = Object.keys(rows[0]);
      downloadFile(toCsv([columns, ...rows.map(row => columns.map(column => row[column]))]), `veasna-all-patients-${hostToday()}.csv`);
      toast.success(`Downloaded ${rows.length} rows.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to download patient data.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" disabled={busy} onClick={download}
      title="Every patient and visit, all locations and dates, as a spreadsheet (CSV)">
      <Download className="size-4" aria-hidden="true" />
      {busy ? "Preparing..." : "Download all patient data"}
    </Button>
  );
}
