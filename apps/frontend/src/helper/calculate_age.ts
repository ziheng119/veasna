import { hostNow } from "@/stores/useHostClockStore";

export const calculateAge = (date_of_birth: string): number | null => {
    if (!date_of_birth) return null;
    const birthDate = new Date(date_of_birth);
    if (isNaN(birthDate.getTime())) return null;

    // Ages count from the host's date: this device's clock may be wrong.
    const today = hostNow();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    return monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ? age - 1 : age;
};