import { useUserStore } from "@/stores/useUserStore";
import { EyeIcon, TrashIcon } from "@/assets/icons";
import formatDate from "@/helper/format_date";
import { PatientInfo } from "@/lib/types/patient";
import FamilyButton from "./FamilyButton";
import FamilyBadge from "@/components/shared/FamilyBadge";
import { familyTone } from "@/lib/family";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface PatientTableRowProps {
    patient: PatientInfo
    onViewPatient?: (patientId: number) => void;
    onDeletePatient?: (patientId: number) => void;
}

export function PatientTableRow({ patient, onViewPatient, onDeletePatient}: PatientTableRowProps) {
    const isAdmin = useUserStore(state => state.user?.role === "admin");
    // While this patient's "Add to family" pop-up is open, the row is highlighted.
    const [grouping, setGrouping] = useState(false);
    const family = patient.day_family;

    const calculateAge = (birthDate: string): number => {
            const today = new Date();
            const dob = new Date(birthDate);
            const age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();

            const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())
                ? age - 1 : age;

            return calculatedAge;
    }
    
    return (
        <tr
            data-family={family || undefined}
            aria-current={grouping || undefined}
            className={cn(
                "h-16 align-middle transition-colors duration-150",
                grouping ? "bg-primary/10 ring-2 ring-inset ring-primary" : "hover:bg-accent/50",
            )}
        >
                <td className="relative px-4 py-3 text-sm text-foreground">
                    {/* Absolutely placed, so a family takes no extra room and rows stay even. */}
                    {family && <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", familyTone(family).stripe)} />}
                    <span className="flex items-center gap-2">
                        <span className="min-w-0">{patient.english_name}</span>
                        {family && <FamilyBadge family={family} />}
                    </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.khmer_name}</td>
                <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{formatDate(patient.date_of_birth)}</td>
                <td className="px-4 py-3 text-sm text-foreground">{calculateAge(patient.date_of_birth)}</td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.sex}</td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.phone_number}</td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.address}</td>
                <td className="px-4 py-3 text-sm text-foreground break-all">{patient.face_id}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {patient.last_visit_date || "-"}
                </td>
                <td className="py-3 text-sm text-foreground">
                    <div className="flex items-center gap-2">

                        {/* View Patient */}
                        <button
                        onClick={() => patient.id && onViewPatient?.(patient.id)}
                        className="text-primary hover:text-primary/80"
                        title="View patient"
                        >
                            <EyeIcon className="w-4- h-4"/>
                        </button>

                        {/* Group with a family member in today's queue */}
                        {patient.id && <FamilyButton patientId={patient.id} patientName={patient.english_name || "This patient"} onOpenChange={setGrouping} />}

                        {/* Delete Patient*/}
                        <button
                        disabled={!isAdmin}
                        onClick={() => patient.id && onDeletePatient?.(patient.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete Patient"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>

                    </div>
                </td>
            </tr>
    )
}