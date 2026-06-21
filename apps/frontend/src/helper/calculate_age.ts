import { PatientInfo } from "@/lib/types/patient";

export const calculateAge = (date_of_birth: string) => {
    if (date_of_birth) {
        const today = new Date();
        const birthDate = new Date(date_of_birth);
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
            ? age - 1 : age;
        
        return calculatedAge
    }
};