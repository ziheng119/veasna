import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onClick?: () => void;
  mode?: string;
  label?: string;
  disabled?: boolean;
  busy?: boolean;
}

/** A form's Save. Same size and font as the buttons beside it (e.g. "Save & next"). */
export default function SaveButton({ onClick, mode, label, disabled = false, busy = false }: Props) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled || busy}>
      <Save aria-hidden="true" />
      {busy ? "Saving..." : label ?? (mode === "edit" ? "Update" : "Save")}
    </Button>
  );
}
