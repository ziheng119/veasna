import { EditIcon, EyeIcon, TrashIcon } from "@/assets/icons";
import formatDate from "@/helper/format_date";
import { PatientInfo } from "@/lib/types/patient";

interface PatientTableRowProps {
    patient: PatientInfo
    onViewPatient?: (patientId: number) => void;
    onDeletePatient?: (patientId: number) => void;
}

export function PatientTableRow({ patient, onViewPatient, onDeletePatient}: PatientTableRowProps) {
    

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
        <tr className="h-16 align-middle hover:bg-accent/50 transition-colors duration-150">
                <td className="px-4 py-3 text-sm text-foreground">{patient.english_name}</td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.khmer_name}</td>
                <td className="px-4 py-3 text-sm text-foreground">{formatDate(patient.date_of_birth)}</td>
                <td className="px-4 py-3 text-sm text-foreground">{calculateAge(patient.date_of_birth)}</td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.sex}</td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.phone_number}</td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.address}</td>
                <td className="px-4 py-3 text-sm text-foreground">{patient.face_id}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                    {patient.lastUpdated
                        ? new Date(patient.lastUpdated).toLocaleString()
                        : "-"}
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

                        {/* Delete Patient*/}
                        <button
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