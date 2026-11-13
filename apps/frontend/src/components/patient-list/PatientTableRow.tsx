import DisabledActionHint from "@/components/shared/DisabledActionHint";
import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { EyeIcon, TrashIcon } from "@/assets/icons";
import formatDate from "@/helper/format_date";
import { PatientInfo } from "@/lib/types/patient";
import FamilyButton from "./FamilyButton";
import ReferralAction from "./ReferralAction";
import FamilyBadge from "@/components/shared/FamilyBadge";
import StationBadge from "@/components/shared/StationBadge";
import { stationLabel, stationPageHref } from "@/constants/stations";
import { familyTone } from "@/lib/family";
import { ENTER_FAST, POP } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { hostNow } from "@/stores/useHostClockStore";

// Rows fade in one after another when the list loads, up to this many (the rest appear at once).
const STAGGERED_ROWS = 15;

// Room on the sides of each cell; the first column has a little more, clear of the family stripe.
const CELL = "px-5 py-3 text-sm text-foreground";

interface PatientTableRowProps {
    patient: PatientInfo
    // Position in the list, for the entrance animation.
    index?: number;
    allPatients: PatientInfo[];
    onViewPatient?: (patientId: number) => void;
    onDeletePatient?: (patientId: number) => void;
    onFamilyChanged?: () => void | Promise<unknown>;
    // Called after a completed visit's referral was saved or deleted, to reload the list.
    onReferralChanged?: () => void | Promise<unknown>;
}

const calculateAge = (birthDate: string): number => {
    const today = hostNow();
    const dob = new Date(birthDate);
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    return monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) ? age - 1 : age;
};

const VIEW_ADMIN_ONLY = "Only the admin can open patient records here. Open a returning patient's past visits from their card in the queue.";

export function PatientTableRow({ patient, index = 0, allPatients, onViewPatient, onDeletePatient, onFamilyChanged, onReferralChanged }: PatientTableRowProps) {
    const router = useRouter();
    const isAdmin = useUserStore(state => state.user?.role === "admin");
    // While this patient's "Add to family" pop-up is open, the row is highlighted.
    const [grouping, setGrouping] = useState(false);
    const family = patient.family;
    // A patient waiting in today's queue opens at their station, selected; anyone else can't be clicked.
    const href = patient.queue_visit_id && patient.current_station
        ? stationPageHref(patient.current_station, patient.queue_visit_id)
        : null;

    const open = (event: MouseEvent<HTMLTableRowElement>) => {
        // The action buttons, and the family pop-up (rendered outside the row), handle their own clicks.
        const target = event.target as Element;
        if (!href || !event.currentTarget.contains(target) || target.closest("button")) return;
        router.push(href);
    };
    const openWithKey = (event: KeyboardEvent<HTMLTableRowElement>) => {
        if (href && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            router.push(href);
        }
    };

    return (
        <tr
            data-family={family || undefined}
            aria-current={grouping || undefined}
            tabIndex={href ? 0 : undefined}
            aria-label={href ? `Open ${patient.english_name || "patient"} at ${stationLabel(patient.current_station)}` : undefined}
            onClick={open}
            onKeyDown={openWithKey}
            style={{ animationDelay: `${Math.min(index, STAGGERED_ROWS) * 25}ms` }}
            className={cn(
                "h-16 align-middle transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                ENTER_FAST,
                grouping ? "bg-primary/10 ring-2 ring-inset ring-primary" : href ? "cursor-pointer hover:bg-accent" : "cursor-default",
            )}
        >
                <td className={cn(CELL, "relative pl-6")}>
                    {/* Absolutely placed, so a family takes no extra room and rows stay even. */}
                    {family && <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", familyTone(family).stripe)} />}
                    <span className="flex items-center gap-2">
                        <span className="min-w-0">{patient.english_name}</span>
                        {family && <FamilyBadge family={family} />}
                    </span>
                </td>
                <td className={CELL}>{patient.khmer_name}</td>
                <td className={cn(CELL, "whitespace-nowrap")}>{formatDate(patient.date_of_birth)}</td>
                <td className={CELL}>{calculateAge(patient.date_of_birth)}</td>
                <td className={CELL}>{patient.sex}</td>
                <td className={CELL}>{patient.phone_number}</td>
                <td className={CELL}>{patient.address}</td>
                <td className={cn(CELL, "break-all")}>{patient.face_id}</td>
                <td className={cn(CELL, "whitespace-nowrap text-muted-foreground")}>
                    {patient.last_visit_date || "-"}
                </td>
                <td className={CELL}>
                    {/* Empty when the patient isn't in today's queue. */}
                    {patient.queue_visit_id && <StationBadge station={patient.current_station} />}
                </td>
                <td className="py-3 pl-4 pr-6 text-sm text-foreground">
                    <div className="flex items-center gap-0.5">

                        {/* View every record of the patient: admin only. Other accounts open a returning
                            patient's past visits from their card in the station queue. */}
                        <DisabledActionHint disabled={!isAdmin} message={VIEW_ADMIN_ONLY}>
                            <button
                            disabled={!isAdmin}
                            onClick={() => patient.id && onViewPatient?.(patient.id)}
                            className={cn(POP, "text-primary")}
                            title={isAdmin ? "View patient" : undefined}
                            aria-label={`View ${patient.english_name || "patient"}`}
                            >
                                <EyeIcon className="h-4 w-4"/>
                            </button>
                        </DisabledActionHint>

                        {/* Add or edit the referral once the patient's visit is completed */}
                        <ReferralAction patient={patient} onChanged={onReferralChanged} />

                        {/* Group with the patients they came with */}
                        {patient.id && (
                            <FamilyButton
                                patient={patient}
                                patients={allPatients}
                                onOpenChange={setGrouping}
                                onChanged={onFamilyChanged}
                            />
                        )}

                        {/* Delete Patient*/}
                        <button
                        disabled={!isAdmin}
                        onClick={() => patient.id && onDeletePatient?.(patient.id)}
                        className={cn(POP, "text-red-600 hover:bg-red-500/10 hover:text-red-700")}
                        title="Delete Patient"
                        aria-label={`Delete ${patient.english_name || "patient"}`}
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>

                    </div>
                </td>
            </tr>
    )
}
