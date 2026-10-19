import { redirect } from "next/navigation";

// Keep old registration links working with the shared, authenticated form on Home.
export default function PatientFormPage() {
  redirect("/#patient-registration");
}
