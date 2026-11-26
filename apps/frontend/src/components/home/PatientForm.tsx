"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

import { PatientInfo } from "@/lib/types/patient";
import { Vitals } from "@/lib/types/vitals";
import { HEF } from "@/lib/types/hef";
import { QueuedPatient } from "@/lib/types/patient";
import { PatientFormData } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";
import { can } from "@/lib/permissions";
import { createVisit } from "@/lib/api/visit/createVisit";
import { retryableRequestId } from "@/lib/requestId";
import StickerColourSelect from "@/components/shared/StickerColourSelect";
import { LOOKUP_MIN_LENGTH, lookupPatients } from "@/lib/api/patients/lookupPatients";
import { getNextQueueNo } from "@/lib/api/queue/getNextQueueNo";
import formatDate from "@/helper/format_date";
import { calculateAge } from "@/helper/calculate_age";
import { PageCard } from "../shared/PageCard";
import { ExistingPatientDialog } from "./ExistingPatientDialog";
import { useFormOptions } from "@/stores/useFormOptionsStore";
import FilteredInput from "../shared/FilteredInput";
import { generateFaceId } from "@/lib/faceId";
import { REGISTRATION_ROUTE, stationLabel } from "@/constants/stations";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import { TB_MIN_RED_FLAGS, TB_STATIONS, meetsTbThreshold, tbObservedHint } from "@/constants/tb";
import { ShieldAlert } from "lucide-react";
import { useNewFormDraft } from "@/hooks/useNewFormDraft";
import { newRecordDraftKey } from "@/lib/drafts";
import { LiveRecordNotice } from "../shared/LiveRecord";

// Values the form works out itself (queue number, BMI, ...): a dashed outline and no fill, so they
// line up with the fields around them but don't look like something to type in.
const COMPUTED_FIELD = "border-dashed bg-transparent shadow-none";

// Wide limits on vitals: they catch typing slips (1 cm, 99 °C) without refusing a real extreme reading.
const VITAL_LIMITS = {
  height: [30, 250], weight: [1, 300], bp_systolic: [50, 300], bp_diastolic: [20, 200], temperature: [30, 45],
} as const;
const inRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;

// The control the cursor goes to when a field has a problem.
const FIELD_FOCUS: Record<string, string> = {
  english_name: "#englishName", sex: "#sex", height: "#height", weight: "#weight", bmi: "#height",
  bp_systolic: "#systolic", bp_diastolic: "#diastolic", temperature: "#temperature",
  know_of_hef: "#knows-yes", has_hef: "#has-yes", has_nssf: "#nssf-yes",
};

// A Yes/No or checkbox option: the label fills a row at least 40px tall, so the whole row is
// easy to tap on a tablet.
const OPTION_ROW = "flex min-h-10 items-center space-x-2";
const OPTION_LABEL = "self-stretch cursor-pointer pr-2 font-normal";

// A field's error message, linked to the field with aria-describedby={errorId(field)}.
const errorId = (field: string) => `${field}-error`;
function FieldError({ field, message, className = "mt-1" }: { field: string; message?: string; className?: string }) {
  if (!message) return null;
  return <p id={errorId(field)} className={`${className} text-xs text-destructive`}>{message}</p>;
}

// Marks a form tab that has fields to fix; readable on the blue active tab too.
function TabErrorDot() {
  return (
    <>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive ring-2 ring-white" />
      <span className="sr-only">(has fields to fix)</span>
    </>
  );
}

interface PatientFormProps {
    existingPatients: PatientInfo[];
    onSubmit: (patient: QueuedPatient) => void;
}

type FormErrors = {
    english_name?: string;
    sex?: string;
    height?: string;
    weight?: string;
    bmi?: string;
    bp_systolic?: string;
    bp_diastolic?: string;
    temperature?: string;
    know_of_hef?: string;
    has_hef?: string;
    has_nssf?: string;
};

const emptyPatientInfo: PatientFormData = {
    english_name: "",
    khmer_name: "",
    date_of_birth: "",
    sex: "",
    phone_number: "",
    address: "",
    age: undefined,
    queue_no: "",
};

const emptyVitals: Vitals = {
    height: "",
    weight: "",
    bmi: "",
    below_3rd_percentile: false,
    category: "",
    bp_systolic: "",
    bp_diastolic: "",
    temperature: "",
    notes: ""
};

const emptyHef: HEF = { know_of_hef: "", has_hef: "", has_nssf: "", notes: "" };

const MAX_SUGGESTIONS = 8;
const MAX_AGE = 130;

const getBMICategory = (bmi: number) : string => {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal Weight";
    if (bmi < 30) return "Overweight";
    if (bmi < 35) return "Obese";
    return "Severely Obese";
}

export function PatientForm({ existingPatients, onSubmit }: PatientFormProps) {
    const token = useUserStore((state) => state.user?.token);

    const revision = useRealtimeStore(state => state.revision);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("patient-info");
    const [errors, setErrors] = useState<FormErrors>({});
    // Inline messages instead of browser pop-ups.
    const [noMatchFor, setNoMatchFor] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [nextQueueNo, setNextQueueNo] = useState("");

    const previewRequest = useRef<AbortController | null>(null);
    // Sent with the registration and again if Submit is pressed after a failure: when the host had
    // saved it but the answer was lost, it returns that registration instead of queuing twice.
    const registrationId = useRef(retryableRequestId());

    // The server assigns the queue number on submit; this previews it. It reloads after every change
    // on any device (live updates), so it moves on when someone else registers a patient first.
    const refreshNextQueueNo = useCallback(async () => {
      previewRequest.current?.abort();
      const controller = new AbortController();
      previewRequest.current = controller;
      if (!token) {
        setNextQueueNo("");
        return;
      }
      try {
        const next = await getNextQueueNo(token, controller.signal);
        if (!controller.signal.aborted) setNextQueueNo(next);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch next queue number:", err);
        setNextQueueNo("");
      }
    }, [token]);

    useEffect(() => {
      refreshNextQueueNo();
      return () => previewRequest.current?.abort();
    }, [refreshNextQueueNo, revision]);

    const [patientInfo, setPatientInfo] =  useState<PatientFormData>(emptyPatientInfo);
    // Existing patient this registration is for; null when registering a new patient.
    const [linkedPatient, setLinkedPatient] = useState<PatientInfo | null>(null);
    // Matches awaiting a choice. onSubmit: the prompt interrupted a submit and can continue it.
    const [matchPrompt, setMatchPrompt] = useState<{ matches: PatientInfo[]; onSubmit: boolean } | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Without "See past patients" the patient list holds only that day's patients (or none, without
    // "See today's patients"), so returning patients are looked up on the host by the name being
    // typed (debounced) and added to the matches.
    const listHasEveryone = useUserStore((state) => can(state.user, "view_past"));
    const lookupName = (patientInfo.english_name?.trim() || patientInfo.khmer_name?.trim() || "");
    const [lookedUp, setLookedUp] = useState<PatientInfo[]>([]);
    useEffect(() => {
      if (listHasEveryone || !token || lookupName.length < LOOKUP_MIN_LENGTH) {
        setLookedUp([]);
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => {
        lookupPatients(lookupName, token, controller.signal)
          .then(setLookedUp)
          .catch((err) => { if (!controller.signal.aborted) console.error("Patient lookup failed:", err); });
      }, 250);
      return () => { clearTimeout(timer); controller.abort(); };
    }, [listHasEveryone, token, lookupName]);
    const knownPatients = useMemo(() => {
      if (!lookedUp.length) return existingPatients;
      const ids = new Set(existingPatients.map((p) => p.id));
      return [...existingPatients, ...lookedUp.filter((p) => !ids.has(p.id))];
    }, [existingPatients, lookedUp]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const [vitals, setVitals] = useState<Vitals>(emptyVitals);

    const [hef, setHEF] = useState<HEF>(emptyHef);

    // Colour of the sticker handed to the patient (sticker_colours on Station data); "" for none.
    const [stickerColour, setStickerColour] = useState("");
    // TB red flags. With TB_MIN_RED_FLAGS or more the patient is flagged for suspected TB: they go
    // only to Consult and are marked in red in every queue. Fewer are saved as noted symptoms.
    const [tbRedFlags, setTbRedFlags] = useState<string[]>([]);
    const [tbNotes, setTbNotes] = useState("");
    const tbRedFlagOptions = useFormOptions("tb_red_flags");
    const tbFlagged = meetsTbThreshold(tbRedFlags);

    // Unsaved typing is kept on this device until the patient is registered (hooks/useNewFormDraft.ts),
    // with the registration's request id: if the host saved it but the answer was lost before a
    // reload, Submit returns that registration instead of queuing the patient twice.
    const userId = useUserStore((state) => state.user?.id);
    const requestId = registrationId.current.get();
    const draftValues = { patientInfo, linkedPatient, vitals, hef, stickerColour, tbRedFlags, tbNotes, requestId };
    const emptyForm: typeof draftValues = {
      patientInfo: emptyPatientInfo, linkedPatient: null, vitals: emptyVitals, hef: emptyHef,
      stickerColour: "", tbRedFlags: [], tbNotes: "", requestId,
    };
    const fillForm = (values: typeof draftValues) => {
      setPatientInfo(values.patientInfo);
      setLinkedPatient(values.linkedPatient);
      setVitals(values.vitals);
      // Drafts kept before the NSSF questions were added lack them.
      setHEF({ ...emptyHef, ...values.hef });
      setStickerColour(values.stickerColour);
      setTbRedFlags(values.tbRedFlags);
      setTbNotes(values.tbNotes);
      registrationId.current.resume(values.requestId);
    };
    const draft = useNewFormDraft(userId ? newRecordDraftKey(userId, "registration") : null,
      draftValues, emptyForm, fillForm);

    const clearFieldError = (field: keyof FormErrors) => {
      setErrors(prev => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };

    // Age follows the date of birth once it is filled in.
    useEffect(() => {
      const age = calculateAge(patientInfo.date_of_birth ?? "");
      if (age === null) return;
      setPatientInfo(prev => ({ ...prev, age: age >= 0 && age <= MAX_AGE ? age.toString() : "" }));
    }, [patientInfo.date_of_birth]);

    // BMI and its category follow height and weight once both are filled in and in range, so a
    // typing slip (1600 cm) never shows a BMI.
    useEffect(() => {
      const heightCm = parseFloat(vitals.height);
      const weightKg = parseFloat(vitals.weight);
      const heightM = heightCm / 100;

      if (inRange(heightCm, ...VITAL_LIMITS.height) && inRange(weightKg, ...VITAL_LIMITS.weight)) {
        const roundedBMI = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
        setVitals(prev => ({
          ...prev,
          bmi: roundedBMI.toString(),
          category: getBMICategory(roundedBMI)
        }));
        clearFieldError("bmi");
      } else {
        setVitals(prev => ({ ...prev, bmi: "", category: "" }));
      }
    }, [vitals.height, vitals.weight]);

    // Which errors belong to which tab, so each tab can show that it has some.
    const TAB_FIELDS: Record<string, (keyof FormErrors)[]> = {
      "patient-info": ["english_name", "sex"],
      vitals: ["height", "weight", "bmi", "bp_systolic", "bp_diastolic", "temperature"],
      hef: ["know_of_hef", "has_hef", "has_nssf"],
    };
    const tabHasErrors = (tab: string) => TAB_FIELDS[tab].some((field) => errors[field]);

    const findErrors = (): FormErrors => {
      const nextErrors: FormErrors = {};
      const englishName = patientInfo.english_name?.trim() ?? "";
      const height = Number(vitals.height);
      const weight = Number(vitals.weight);
      const bmi = Number(vitals.bmi);
      const bpSystolic = Number(vitals.bp_systolic);
      const bpDiastolic = Number(vitals.bp_diastolic);
      const temperature = Number(vitals.temperature);

      if (!englishName) nextErrors.english_name = "English name is required.";
      if (!patientInfo.sex) nextErrors.sex = "Sex is required.";

      if (!inRange(height, ...VITAL_LIMITS.height)) nextErrors.height = "Enter a height between 30 and 250 cm.";
      if (!inRange(weight, ...VITAL_LIMITS.weight)) nextErrors.weight = "Enter a weight between 1 and 300 kg.";
      // BMI is only calculated from a height and weight in range, so it needs no message of its own.
      if (!nextErrors.height && !nextErrors.weight && (!Number.isFinite(bmi) || bmi <= 0)) nextErrors.bmi = "Enter height and weight to calculate BMI.";
      if (!Number.isInteger(bpSystolic) || !inRange(bpSystolic, ...VITAL_LIMITS.bp_systolic)) nextErrors.bp_systolic = "Enter a systolic pressure between 50 and 300.";
      if (!Number.isInteger(bpDiastolic) || !inRange(bpDiastolic, ...VITAL_LIMITS.bp_diastolic)) nextErrors.bp_diastolic = "Enter a diastolic pressure between 20 and 200.";
      if (!inRange(temperature, ...VITAL_LIMITS.temperature)) nextErrors.temperature = "Enter a temperature between 30 and 45 °C.";

      if (!hef.know_of_hef) nextErrors.know_of_hef = "Please select Yes or No.";
      if (!hef.has_hef) nextErrors.has_hef = "Please select Yes or No.";
      if (!hef.has_nssf) nextErrors.has_nssf = "Please select Yes or No.";
      return nextErrors;
    };

    // Puts the cursor in the first field with a problem, once its tab is showing.
    const focusFirstError = (found: FormErrors, fields: (keyof FormErrors)[]) => {
      const field = fields.find((f) => found[f]);
      if (field) requestAnimationFrame(() => document.querySelector<HTMLElement>(FIELD_FOCUS[field])?.focus());
    };

    const validateForm = (): boolean => {
      const nextErrors = findErrors();
      setErrors(nextErrors);
      // Open the first tab with a problem; the others show a red dot.
      const firstTab = Object.keys(TAB_FIELDS).find((tab) => TAB_FIELDS[tab].some((field) => nextErrors[field]));
      if (firstTab) {
        setActiveTab(firstTab);
        focusFirstError(nextErrors, TAB_FIELDS[firstTab]);
      }
      return !firstTab;
    };

    // "Next" checks only the tab being left, so problems show up one step at a time.
    const goToNextTab = (from: string, to: string) => {
      const found = findErrors();
      const tabErrors: FormErrors = {};
      for (const field of TAB_FIELDS[from]) if (found[field]) tabErrors[field] = found[field];
      setErrors((prev) => ({ ...prev, ...tabErrors }));
      if (Object.keys(tabErrors).length === 0) setActiveTab(to);
      else focusFirstError(tabErrors, TAB_FIELDS[from]);
    };

    // Leaving a filled-in vital checks it, so a typing slip shows at once; empty ones wait for Next.
    const checkVital = (field: keyof FormErrors, value: string) => {
      if (!value.trim()) return;
      const message = findErrors()[field];
      if (message) setErrors((prev) => ({ ...prev, [field]: message }));
    };

    const normalizeName = (name?: string | null) => (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");

    // Links the form to an existing patient so the visit is added to their record
    // instead of creating a duplicate patient.
    const linkPatient = (found: PatientInfo) => {
      setLinkedPatient(found);
      setMatchPrompt(null);
      setShowSuggestions(false);
      setPatientInfo(prev => ({
        ...prev,
        english_name: found.english_name || "",
        khmer_name: found.khmer_name || "",
        date_of_birth: found.date_of_birth ? formatDate(found.date_of_birth) : "",
        sex: found.sex,
        address: found.address || "",
        phone_number: found.phone_number || "",
        age: undefined,
      }));
      setErrors((prev) => ({
        ...prev,
        english_name: undefined,
        sex: undefined,
      }));
    };

    const unlinkPatient = () => {
      setLinkedPatient(null);
      setPatientInfo(emptyPatientInfo);
    };

    const checkExistingPatient = () => {
      // Use either English or Khmer name for search
      const name = normalizeName(patientInfo.english_name) || normalizeName(patientInfo.khmer_name);
      if (!name) return;

      const matches = knownPatients.filter((p) =>
        normalizeName(p.english_name).includes(name) || normalizeName(p.khmer_name).includes(name)
      );

      if (matches.length === 0) {
        setNoMatchFor(patientInfo.english_name?.trim() || patientInfo.khmer_name?.trim() || name);
      } else if (matches.length === 1) {
        linkPatient(matches[0]);
      } else {
        setMatchPrompt({ matches, onSubmit: false });
      }
    };

    // Existing patients whose name is identical to the one being registered.
    const findSameNamePatients = () => {
      const englishName = normalizeName(patientInfo.english_name);
      const khmerName = normalizeName(patientInfo.khmer_name);
      return knownPatients.filter((p) =>
        (englishName && normalizeName(p.english_name) === englishName) ||
        (khmerName && normalizeName(p.khmer_name) === khmerName)
      );
    };

    const handleSubmit = () => {
        if (!token) {
          toast.error("You are signed out. Sign in again to register patients.");
          return;
        }
        if (!validateForm()) return;

        if (!linkedPatient) {
          const matches = findSameNamePatients();
          if (matches.length > 0) {
            setMatchPrompt({ matches, onSubmit: true });
            return;
          }
        }
        submitVisit(linkedPatient?.id);
    };

    const submitVisit = async (patientId?: number) => {
        if (!token) return;

        setMatchPrompt(null);
        setSubmitError(null);
        setIsSubmitting(true);

        // The queue number is assigned by the server.
        const completePatientInfo = {
          ...patientInfo,
          id: patientId,
        };

        try {
          const newQueuedPatient = await createVisit(
            {
              patientInfo: completePatientInfo,
              vitals,
              hef,
              // Every patient goes to Triage, which chooses their other stations. The server also
              // queues a TB patient only at Consult.
              stations: tbFlagged ? TB_STATIONS : REGISTRATION_ROUTE,
              sticker_colour: stickerColour,
              // Red flags below the threshold are saved too, as noted symptoms (not a TB flag).
              tb: tbRedFlags.length > 0 ? { red_flags: tbRedFlags, notes: tbNotes } : null,
              request_id: registrationId.current.get(),
            },
            token
          );
          registrationId.current.saved();

          // on success, call the onsubmit prop passed from the parent page
          onSubmit(newQueuedPatient);
          if (tbFlagged) {
            toast.error(
              `Suspected TB: number ${newQueuedPatient.queue_no} goes straight to the ${stationLabel(newQueuedPatient.current_station)} queue, marked red. Keep them apart from other villagers and inform a doctor.`,
              { duration: 10000 }
            );
          } else {
            toast.success(`Added to the ${stationLabel(newQueuedPatient.current_station)} queue as number ${newQueuedPatient.queue_no}${newQueuedPatient.family ? `, in family ${newQueuedPatient.family}` : ""}.`);
          }

          // Empty the form for the next patient, which also removes the draft.
          fillForm({ ...emptyForm, requestId: registrationId.current.get() });
          setActiveTab("patient-info");
          setErrors({});
          refreshNextQueueNo();
        } catch (error) {
          console.error("Submission failed: ", error)
          setSubmitError(error instanceof Error ? error.message : "The host didn't answer.");
        } finally {
          setIsSubmitting(false);
        }

        
    };

    // Autocomplete for returning patients: typing in the English name field matches
    // existing patients by English name or by Unique ID (face_id).
    const nameQuery = normalizeName(patientInfo.english_name);
    const suggestions = !linkedPatient && nameQuery
      ? knownPatients
          .filter((p) =>
            normalizeName(p.english_name).includes(nameQuery) ||
            normalizeName(p.face_id ?? "").includes(nameQuery)
          )
          .slice(0, MAX_SUGGESTIONS)
      : [];
    const suggestionsOpen = showSuggestions && suggestions.length > 0;

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!suggestionsOpen) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        linkPatient(suggestions[highlightedIndex]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    };

    return (
      <PageCard
        title="Patient Registration"
        className="xl:h-full w-full flex flex-col"
        headerClassName="py-3"
        contentClassName="flex-1 flex flex-col overflow-hidden"
      >
          <div className="mb-3 empty:hidden"><LiveRecordNotice live={draft} /></div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-3 bg-muted/80">
              
              <TabsTrigger 
                value="patient-info" data-tour-tab="patient-info" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ">
                  Patient Info
                  {tabHasErrors("patient-info") && <TabErrorDot />}
              </TabsTrigger>
              <TabsTrigger 
                value="vitals" data-tour-tab="vitals" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Vitals
                  {tabHasErrors("vitals") && <TabErrorDot />}
              </TabsTrigger>
              <TabsTrigger
                 value="hef" data-tour-tab="hef" 
                 className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  HEF &amp; TB
                  {tabHasErrors("hef") && <TabErrorDot />}
              </TabsTrigger>

            </TabsList>
            <div className="flex-1 w-full min-h-0 overflow-y-auto px-1">
              <TabsContent value="patient-info" className="space-y-4 mt-6 h-full">
                {linkedPatient && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                    <span>
                      Returning patient: <span className="font-semibold">{linkedPatient.english_name || linkedPatient.khmer_name}</span>{linkedPatient.face_id ? ` • Unique ID ${linkedPatient.face_id}` : ""}. This visit will be added to their record.
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={unlinkPatient}>
                      Clear
                    </Button>
                  </div>
                )}
                <div className="relative" data-tour="reg-name">
                  <Label htmlFor="englishName">English Name *</Label>
                  <Input
                    id="englishName"
                    value={patientInfo.english_name}
                    aria-invalid={!!errors.english_name} aria-describedby={errors.english_name ? errorId("english_name") : undefined}
                    autoComplete="off"
                    onChange={(e) => {
                      setPatientInfo(prev => ({ ...prev, english_name: e.target.value }));
                      clearFieldError("english_name");
                      setNoMatchFor(null);
                      setShowSuggestions(true);
                      setHighlightedIndex(-1);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setShowSuggestions(false)}
                    onKeyDown={handleNameKeyDown}
                    placeholder="Enter English name, or Unique ID for a returning patient"
                    className="mt-2"
                  />
                  {suggestionsOpen && (
                    <ul className="absolute z-10 bg-card border border-border rounded-md w-full mt-1 max-h-48 overflow-y-auto shadow-sm">
                      {suggestions.map((patient, idx) => {
                        const age = calculateAge(patient.date_of_birth);
                        const summary = [
                          patient.english_name,
                          patient.khmer_name,
                          patient.sex,
                          age !== null ? `Age ${age}` : null,
                        ].filter(Boolean).join(" • ");

                        return (
                        <li
                          key={patient.id}
                          className={`flex items-center justify-between gap-3 px-4 py-2 cursor-pointer text-sm ${
                            idx === highlightedIndex ? "bg-accent font-medium" : "hover:bg-accent/70"
                          }`}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          // mousedown fires before the input's blur closes the list
                          onMouseDown={(e) => {
                            e.preventDefault();
                            linkPatient(patient);
                          }}
                        >
                          <span>{summary}</span>
                          {patient.face_id && (
                            <span className="shrink-0 text-xs font-semibold text-muted-foreground">Unique ID {patient.face_id}</span>
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  )}
                  <FieldError field="english_name" message={errors.english_name} />
                  {noMatchFor && (
                    <p className="mt-1 text-xs text-muted-foreground" role="status">
                      No registered patient matches &ldquo;{noMatchFor}&rdquo;. Carry on to register them as new.
                    </p>
                  )}
                </div>
    
                <div>
                  <Label htmlFor="khmerName">Khmer Name</Label>
                  <Input
                    id="khmerName"
                    value={patientInfo.khmer_name}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, khmer_name: e.target.value }))}
                    placeholder="Enter Khmer name"
                    className="mt-2"
                  />
                </div>
    
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-4">
                  <div>
                    <Label htmlFor="queueNumber">Queue Number</Label>
                    <output
                      id="queueNumber"
                      aria-live="polite"
                      aria-describedby="queueNumberHint"
                      className={`mt-2 flex h-9 items-center rounded-md border border-input px-3 text-lg font-bold tabular-nums tracking-wide ${COMPUTED_FIELD}`}
                    >
                      {nextQueueNo || "–"}
                    </output>
                    <p id="queueNumberHint" className="mt-1 text-xs text-muted-foreground">
                      Assigned automatically when you submit.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="stickerColour">Sticker colour</Label>
                    <StickerColourSelect id="stickerColour" value={stickerColour} onChange={setStickerColour} className="mt-2" />
                    <p className="mt-1 text-xs text-muted-foreground">Shown on their card in every queue.</p>
                  </div>
                  <div>
                    <Label htmlFor="sex">Sex *</Label>
                    <Select 
                      value={patientInfo.sex} 
                      onValueChange={(value) => {
                        setPatientInfo(prev => ({ ...prev, sex: value as "M" | "F" }));
                        clearFieldError("sex");
                      }}
                    >
                      <SelectTrigger id="sex" className="mt-2 w-full" aria-invalid={!!errors.sex} aria-describedby={errors.sex ? errorId("sex") : undefined}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="M" className="text-foreground hover:bg-accent">Male</SelectItem>
                        <SelectItem value="F" className="text-foreground hover:bg-accent">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError field="sex" message={errors.sex} />
                  </div>
                </div>
    
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={patientInfo.date_of_birth}
                      onChange={(e) => setPatientInfo(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <FilteredInput
                      id="age"
                      format="wholeNumber"
                      value={String(patientInfo.age || "")}
                      readOnly={!!patientInfo.date_of_birth}
                      onValueChange={(age) => setPatientInfo(prev => ({ ...prev, age }))}
                      placeholder="Auto from date of birth"
                      className={`mt-2 ${patientInfo.date_of_birth ? COMPUTED_FIELD : ""}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <FilteredInput
                      id="phoneNumber"
                      format="phone"
                      value={patientInfo.phone_number || ""}
                      onValueChange={(phone_number) => setPatientInfo(prev => ({ ...prev, phone_number }))}
                      placeholder="Phone number"
                      className="mt-2"
                    />
                  </div>
                </div>
    
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={patientInfo.address || ""}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter address"
                    className="mt-2"
                  />
                </div>
    
                <div>
                  <Label htmlFor="faceId">Unique ID</Label>
                  <Input
                    id="faceId"
                    value={generateFaceId(patientInfo.english_name, patientInfo.khmer_name, patientInfo.date_of_birth)}
                    readOnly
                    tabIndex={-1}
                    placeholder="Generated from names and date of birth"
                    className={`mt-2 ${COMPUTED_FIELD}`}
                  />
                </div>

              </TabsContent>
    
              <TabsContent value="vitals" data-tour="reg-vitals" className="space-y-4 mt-6 h-full">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="height">Height (cm) *</Label>
                    <FilteredInput
                      id="height"
                      format="measurement"
                      value={vitals.height}
                      aria-invalid={!!errors.height} aria-describedby={errors.height ? errorId("height") : undefined}
                      onValueChange={(height) => {
                        setVitals(prev => ({ ...prev, height }));
                        clearFieldError("height");
                      }}
                      onBlur={() => checkVital("height", vitals.height)}
                      placeholder="Height in cm"
                      className="mt-2"
                    />
                    <FieldError field="height" message={errors.height} />
                  </div>
                  <div>
                    <Label htmlFor="weight">Weight (kg) *</Label>
                    <FilteredInput
                      id="weight"
                      format="measurement"
                      value={vitals.weight}
                      aria-invalid={!!errors.weight} aria-describedby={errors.weight ? errorId("weight") : undefined}
                      onValueChange={(weight) => {
                        setVitals(prev => ({ ...prev, weight }));
                        clearFieldError("weight");
                      }}
                      onBlur={() => checkVital("weight", vitals.weight)}
                      placeholder="Weight in kg"
                      className="mt-2"
                    />
                    <FieldError field="weight" message={errors.weight} />
                  </div>
                  <div>
                    <Label htmlFor="bmi">BMI</Label>
                    <Input
                      id="bmi"
                      value={vitals.bmi}
                      aria-invalid={!!errors.bmi} aria-describedby={errors.bmi ? errorId("bmi") : undefined}
                      readOnly
                      placeholder="Auto from height and weight"
                      tabIndex={-1}
                      className={`mt-2 ${COMPUTED_FIELD}`}
                    />
                    <FieldError field="bmi" message={errors.bmi} />
                  </div>
                </div>
    
                <div className={`${OPTION_ROW} pt-2`}>
                  <Checkbox
                    id="below3rd"
                    checked={vitals.below_3rd_percentile}
                    onCheckedChange={(checked) => setVitals(prev => ({ 
                      ...prev, 
                      below_3rd_percentile: checked as boolean 
                    }))}
                    className="bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Label htmlFor="below3rd" className={OPTION_LABEL}>Child is below 3rd percentile (BMI by age)</Label>
                </div>
    
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={vitals.category}
                    readOnly
                    placeholder="BMI category (auto-calculated)"
                    tabIndex={-1}
                    className={`mt-2 ${COMPUTED_FIELD}`}
                  />
                </div>
    
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="systolic">Blood pressure, systolic *</Label>
                    <FilteredInput
                      id="systolic"
                      format="wholeNumber"
                      value={vitals.bp_systolic}
                      aria-invalid={!!errors.bp_systolic} aria-describedby={errors.bp_systolic ? errorId("bp_systolic") : undefined}
                      onValueChange={(bp_systolic) => {
                        setVitals(prev => ({ ...prev, bp_systolic }));
                        clearFieldError("bp_systolic");
                      }}
                      onBlur={() => checkVital("bp_systolic", vitals.bp_systolic)}
                      placeholder="Systolic"
                      className="mt-2"
                    />
                    <FieldError field="bp_systolic" message={errors.bp_systolic} />
                  </div>
                  <div>
                    <Label htmlFor="diastolic">Blood pressure, diastolic *</Label>
                    <FilteredInput
                      id="diastolic"
                      format="wholeNumber"
                      value={vitals.bp_diastolic}
                      aria-invalid={!!errors.bp_diastolic} aria-describedby={errors.bp_diastolic ? errorId("bp_diastolic") : undefined}
                      onValueChange={(bp_diastolic) => {
                        setVitals(prev => ({ ...prev, bp_diastolic }));
                        clearFieldError("bp_diastolic");
                      }}
                      onBlur={() => checkVital("bp_diastolic", vitals.bp_diastolic)}
                      placeholder="Diastolic"
                      className="mt-2"
                    />
                    <FieldError field="bp_diastolic" message={errors.bp_diastolic} />
                  </div>
                </div>
    
                <div>
                  <Label htmlFor="temperature">Temperature (°C) *</Label>
                  <FilteredInput
                    id="temperature"
                    format="temperature"
                    value={vitals.temperature}
                    aria-invalid={!!errors.temperature} aria-describedby={errors.temperature ? errorId("temperature") : undefined}
                    onValueChange={(temperature) => {
                      setVitals(prev => ({ ...prev, temperature }));
                      clearFieldError("temperature");
                    }}
                    onBlur={() => checkVital("temperature", vitals.temperature)}
                    placeholder="Temperature in Celsius"
                    className="mt-2"
                  />
                  <FieldError field="temperature" message={errors.temperature} />
                </div>
    
                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={vitals.notes}
                    onChange={(e) => setVitals(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes about vitals"
                    className="mt-2"
                  />
                </div>
              </TabsContent>
    
              <TabsContent value="hef" className="space-y-4 mt-6 h-full">
                <div className="space-y-4">
                  <p className="text-sm font-semibold">Health coverage (HEF, NSSF)</p>
                  <div>
                    <Label className="block mb-2">Does patient know about HEF? *</Label>
                    <RadioGroup 
                      value={hef.know_of_hef}
                      aria-invalid={!!errors.know_of_hef}
                      aria-describedby={errors.know_of_hef ? errorId("know_of_hef") : undefined} 
                      onValueChange={(value) => {
                        setHEF(prev => ({ ...prev, know_of_hef: value as "yes" | "no" }));
                        clearFieldError("know_of_hef");
                      }}
                      className="flex gap-6"
                    >
                      <div className={OPTION_ROW}>
                        <RadioGroupItem value="yes" id="knows-yes" className="text-primary bg-background" />
                        <Label htmlFor="knows-yes" className={OPTION_LABEL}>Yes</Label>
                      </div>
                      <div className={OPTION_ROW}>
                        <RadioGroupItem value="no" id="knows-no" className="text-primary bg-background" />
                        <Label htmlFor="knows-no" className={OPTION_LABEL}>No</Label>
                      </div>
                    </RadioGroup>
                    <FieldError field="know_of_hef" message={errors.know_of_hef} className="mt-2" />
                  </div>
    
                  <div>
                    <Label className="block mb-2">Does patient have HEF? *</Label>
                    <RadioGroup 
                      value={hef.has_hef}
                      aria-invalid={!!errors.has_hef}
                      aria-describedby={errors.has_hef ? errorId("has_hef") : undefined} 
                      onValueChange={(value) => {
                        setHEF(prev => ({ ...prev, has_hef: value as "yes" | "no" }));
                        clearFieldError("has_hef");
                      }}
                      className="flex gap-6"
                    >
                      <div className={OPTION_ROW}>
                        <RadioGroupItem value="yes" id="has-yes" className="text-primary bg-background" />
                        <Label htmlFor="has-yes" className={OPTION_LABEL}>Yes</Label>
                      </div>
                      <div className={OPTION_ROW}>
                        <RadioGroupItem value="no" id="has-no" className="text-primary bg-background" />
                        <Label htmlFor="has-no" className={OPTION_LABEL}>No</Label>
                      </div>
                    </RadioGroup>
                    <FieldError field="has_hef" message={errors.has_hef} className="mt-2" />
                  </div>

                  <div>
                    <Label className="block mb-2">Does patient have NSSF? *</Label>
                    <RadioGroup
                      value={hef.has_nssf}
                      aria-invalid={!!errors.has_nssf}
                      aria-describedby={errors.has_nssf ? errorId("has_nssf") : undefined}
                      onValueChange={(value) => {
                        setHEF(prev => ({ ...prev, has_nssf: value as "yes" | "no" }));
                        clearFieldError("has_nssf");
                      }}
                      className="flex gap-6"
                    >
                      <div className={OPTION_ROW}>
                        <RadioGroupItem value="yes" id="nssf-yes" className="text-primary bg-background" />
                        <Label htmlFor="nssf-yes" className={OPTION_LABEL}>Yes</Label>
                      </div>
                      <div className={OPTION_ROW}>
                        <RadioGroupItem value="no" id="nssf-no" className="text-primary bg-background" />
                        <Label htmlFor="nssf-no" className={OPTION_LABEL}>No</Label>
                      </div>
                    </RadioGroup>
                    <FieldError field="has_nssf" message={errors.has_nssf} className="mt-2" />
                  </div>

                  <div>
                    <Label htmlFor="hefReason" className="block mb-3">Does patient use HEF/NSSF? Why or why not?</Label>
                    <Textarea
                      id="hefReason"
                      value={hef.notes}
                      onChange={(e) => setHEF(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Why the patient uses HEF/NSSF, or doesn't"
                      className=""
                    />
                  </div>
                </div>

                {/* A plain section like the others; only a flagged patient turns it into a red alert. */}
                <div data-tour="reg-tb" className={tbFlagged ? "rounded-md border border-destructive/50 bg-destructive/5 p-3" : "border-t border-border pt-4"}>
                  <Label className="block mb-1 font-semibold">TB red flags</Label>
                  <p className="mb-3 text-xs text-muted-foreground text-pretty">
                    Tick any that apply. With {TB_MIN_RED_FLAGS} or more, the patient is flagged for suspected TB: they go to Consult only (then Pharmacy for any prescriptions) and show in red in every queue.
                  </p>
                  <div className="grid gap-x-6 sm:grid-cols-2">
                    {tbRedFlagOptions.map((flag) => (
                      <div key={flag.id} className={OPTION_ROW}>
                        <Checkbox
                          id={`tb-flag-${flag.id}`}
                          checked={tbRedFlags.includes(flag.id)}
                          onCheckedChange={(checked) =>
                            setTbRedFlags((prev) =>
                              checked === true
                                ? tbRedFlagOptions.map((f) => f.id).filter((id) => id === flag.id || prev.includes(id))
                                : prev.filter((id) => id !== flag.id)
                            )
                          }
                          className="bg-background data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                        />
                        <Label htmlFor={`tb-flag-${flag.id}`} className={OPTION_LABEL}>{flag.label}</Label>
                      </div>
                    ))}
                  </div>
                  {!tbFlagged && tbRedFlags.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground" role="status">{tbObservedHint(tbRedFlags.length)}</p>
                  )}
                  {tbRedFlags.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {tbFlagged && (
                        <p className="flex items-start gap-2 text-sm font-medium text-destructive">
                          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                          Suspected TB: keep the patient apart from other villagers and inform a doctor.
                        </p>
                      )}
                      <div>
                        <Label htmlFor="tb-notes" className="mb-2">TB notes</Label>
                        <Textarea
                          id="tb-notes"
                          value={tbNotes}
                          onChange={(e) => setTbNotes(e.target.value)}
                          placeholder="For the doctor: how long the cough has lasted, or the other concern"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
  
          {submitError && (
            <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground">
              <p className="font-semibold text-destructive">The patient wasn&apos;t added to the queue.</p>
              <p className="mt-1">
                What you typed is kept. Press Submit again; they won&apos;t be added twice.
                <span className="text-muted-foreground"> ({submitError})</span>
              </p>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3 mt-6 pt-4 border-t border-border" data-tour="reg-actions">
            <Button 
              onClick={checkExistingPatient}
              variant="outline"
              className="px-6 bg-background border-input text-muted-foreground hover:bg-accent"
            >
              Check Existing
            </Button>
            {activeTab === "patient-info" && (
              <Button type="button" className="px-8" onClick={() => goToNextTab("patient-info", "vitals")}>
                Next: Vitals
              </Button>
            )}
            {activeTab === "vitals" && (
              <Button type="button" className="px-8" onClick={() => goToNextTab("vitals", "hef")}>
                Next: HEF &amp; TB
              </Button>
            )}
            {activeTab === "hef" && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                variant={tbFlagged ? "destructive" : "default"}
                className="px-8"
              >
                {tbFlagged && <ShieldAlert aria-hidden="true" />}
                {isSubmitting ? "Submitting..." : tbFlagged ? "Submit suspected TB patient" : "Submit & Add to Queue"}
              </Button>
            )}
          </div>

          <ExistingPatientDialog
            open={!!matchPrompt}
            matches={matchPrompt?.matches ?? []}
            description={
              matchPrompt?.onSubmit
                ? "A patient with this name is already registered. Select them to add this visit to their record, or register a new patient if this is a different person."
                : "More than one patient matches this name. Use the Unique ID and details to pick the right one."
            }
            onSelect={(patient) => {
              const continueSubmit = matchPrompt?.onSubmit;
              linkPatient(patient);
              if (continueSubmit) submitVisit(patient.id);
            }}
            onRegisterNew={matchPrompt?.onSubmit ? () => submitVisit() : undefined}
            onClose={() => setMatchPrompt(null)}
          />
      </PageCard>
    );



}