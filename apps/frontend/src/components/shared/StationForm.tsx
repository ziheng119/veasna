"use client";

import { ReactNode, useId } from "react";
import { StationId } from "@/constants/stations";
import { STICKY_FORM_FOOTER } from "@/lib/pageLayout";
import { cn } from "@/lib/utils";
import { StationTitle } from "./StationBadge";

interface Props {
  station: StationId;
  title: ReactNode;
  // The form's buttons (Save, Save & next…), stuck to the bottom of the patient's column.
  footer: ReactNode;
  // Locks the buttons like the fields, for an account that can't change saved data.
  footerDisabled?: boolean;
  footerClassName?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A station's form in the open patient's column on a station surface (StationSurface): a heading led
 * by the station's mark, the fields, and the buttons stuck to the column's bottom. The buttons are a
 * child of the column, not of the form, so they stay in reach however far down the form starts, and
 * sit at the bottom when the column is short.
 */
export default function StationForm({ station, title, footer, footerDisabled = false, footerClassName, className, children }: Props) {
  const headingId = useId();
  return (
    <>
      <section aria-labelledby={headingId} className={cn("space-y-4 px-5 pb-6 pt-5", className)}>
        <h2 id={headingId} className="text-base font-semibold text-foreground"><StationTitle station={station}>{title}</StationTitle></h2>
        {children}
      </section>
      <fieldset disabled={footerDisabled} className={cn(STICKY_FORM_FOOTER, "mx-0 mt-auto", footerClassName)}>{footer}</fieldset>
    </>
  );
}
