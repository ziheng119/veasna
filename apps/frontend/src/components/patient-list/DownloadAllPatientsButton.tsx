"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { can } from "@/lib/permissions";
import { downloadFile, toCsv } from "@/components/analytics/exportCsv";
import { hostToday } from "@/stores/useHostClockStore";
import { apiFetch, readError } from "@/lib/api/request";

/**
 * "Print and download" permission (hidden without it): a spreadsheet of every patient this account
 * may see (every patient with "See past patients", otherwise its day's) and their visits, one row
 * per visit (apps/backend/routes/export.js). Column names are the database's.
 */
export default function DownloadAllPatientsButton() {
  const user = useUserStore((state) => state.user);
  const [busy, setBusy] = useState(false);
  if (!can(user, "print")) return null;

  const download = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`${backend_url}/api/export/patients`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${user?.token}` },
        // Every patient and visit: allow longer than an ordinary request.
        timeoutMs: 120_000,
      });
      if (!res.ok) throw new Error(await readError(res, "Download failed"));
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
      title="Every patient and visit this account can see, as a spreadsheet (CSV)">
      <Download className="size-4" aria-hidden="true" />
      {busy ? "Preparing..." : "Download all patient data"}
    </Button>
  );
}
