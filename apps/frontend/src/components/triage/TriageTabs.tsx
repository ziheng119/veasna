"use client"

import { STICKY_FORM_FOOTER } from "@/lib/pageLayout";
import SavedRecordFields from "@/components/shared/SavedRecordFields";
import { getTriageRecord } from "@/lib/api/triage/triageService";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, RefreshCw, Save, WifiOff } from "lucide-react";
import toast from "react-hot-toast";
import { saveVisualAcuity,savePresentingComplaint, saveMedicalHistory} from "@/lib/api/triage/triageService";   
import { VisualAcuity } from "@/lib/types/visualAcuity";
import EyeReadingsGrid, { EMPTY_EYE_READINGS, EYE_READING_FIELDS, EyeReadings, REQUIRED_EYE_READING_FIELDS } from "@/components/shared/EyeReadingsGrid";
import { normalizeSnellenFields, SNELLEN_ERROR } from "@/lib/snellen";
import { PresentingComplaint } from "@/lib/types/medicalHistory";
import { MedicalHistory } from "@/lib/types/medicalHistory";
import { Checkbox } from "@/components/ui/checkbox";
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { StationCheckboxes } from "@/components/shared/StationCheckboxes";
import { QueuedPatient } from "@/lib/types/patient";
import { StationId, TRIAGE_NEXT_STATION_IDS } from "@/constants/stations";
import { setStationNeeded } from "@/lib/api/queue/stations";
import { useUserStore } from "@/stores/useUserStore";
import { canEditSavedData } from "@/lib/permissions";
import { SaveAndNextButton, StationDonePrompt, useLeaveCheck, useSaveBeforeNext } from "@/components/shared/StationFlow";
import { LiveRecordNotice, useLiveRecord } from "@/components/shared/LiveRecord";
import { LOAD_RETRY_DELAYS_MS } from "@/hooks/useRecordLoad";
import { useConfirm } from "@/hooks/useConfirm";

// Triage is done when every section is saved with something in it.
const SECTIONS = [
    { id: "acuity", label: "Visual Acuity" },
    { id: "complaint", label: "Presenting Complaints" },
    { id: "history", label: "Medical History" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
// Each section's tab.
const SECTION_TABS: Record<SectionId, string> = { acuity: "visual-acuity", complaint: "presenting-complaint", history: "medical-history" };
const SECTION_TAB ="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

// On a section's tab: a tick once it is saved with something in it, a dot while typing isn't saved yet.
function SectionMark({ saved, unsaved }: { saved: boolean; unsaved: boolean }) {
    if (saved) return <><Check aria-hidden="true" className="size-3.5" /><span className="sr-only">(saved)</span></>;
    if (unsaved) return <><span aria-hidden="true" className="size-1.5 rounded-full bg-warning" /><span className="sr-only">(not saved yet)</span></>;
    return null;
}

// "A", "A and B", "A, B and C".
const listWords = (words: string[]) => words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

const sectionLabel = (id: SectionId) => SECTIONS.find((section) => section.id === id)!.label;

// Each section's form values for its saved record (empty when there is none).
const acuityValues = (acuity: VisualAcuity | null): VisualAcuity => ({
    ...Object.fromEntries(EYE_READING_FIELDS.map((field) => [field, acuity?.[field] ?? ""])) as EyeReadings,
    notes: acuity?.notes ?? "",
    refer_optician: acuity?.refer_optician ?? false,
});
const complaintValues = (complaint: PresentingComplaint | null): PresentingComplaint => ({
    history: complaint?.history ?? "", red_flags: complaint?.red_flags ?? "", systems_review: complaint?.systems_review ?? "", drug_allergies: complaint?.drug_allergies ?? "",
});
const historyValues = (history: MedicalHistory | null): MedicalHistory => ({
    past: history?.past ?? "", drug_and_treatment: history?.drug_and_treatment ?? "", family: history?.family ?? "", social: history?.social ?? "", systems_review: history?.systems_review ?? "",
});
// True when any field has something in it.
const anyFilled = (values: object) => Object.values(values).some((value) => String(value ?? "").trim() !== "");
// The readings and notes, or a ticked "Refer to optician" (an unticked box is not an entry).
const acuityFilled = ({ refer_optician, ...rest }: VisualAcuity) => Boolean(refer_optician) || anyFilled(rest);

// The free-text boxes of Presenting Complaints and Medical History, in order. Required ones (*) make
// the section complete; the rest are filled in when there is something to say. Each hint says what
// goes in the box, for volunteers new to the form.
interface NoteField<T> { key: keyof T & string; label: string; hint: string; rows: number; required?: boolean }
const COMPLAINT_FIELDS: NoteField<PresentingComplaint>[] = [
    { key: "history", label: "History of presenting symptoms", required: true, rows: 3,
      hint: "What is wrong, since when, and what makes it better or worse." },
    { key: "red_flags", label: "Other red flags (not TB)", rows: 2,
      hint: "Warning signs a doctor should see soon, e.g. chest pain, severe headache, bleeding. TB red flags go in Review TB red flags above." },
    { key: "systems_review", label: "Systems review for this complaint", rows: 2,
      hint: "Related symptoms by body system, e.g. breathing, stomach, urine." },
    { key: "drug_allergies", label: "Drug allergies", required: true, rows: 2,
      hint: "Write \"None known\" if they have none." },
];
const HISTORY_FIELDS: NoteField<MedicalHistory>[] = [
    { key: "past", label: "Past medical history", required: true, rows: 3,
      hint: "Earlier illnesses, operations and long-term conditions such as diabetes or high blood pressure." },
    { key: "drug_and_treatment", label: "Drug and treatment history", required: true, rows: 3,
      hint: "Medicines they take now, including traditional remedies." },
    { key: "family", label: "Family history", rows: 2, hint: "Illnesses that run in the family." },
    { key: "social", label: "Social history", rows: 2, hint: "Work, smoking, alcohol, and who they live with." },
    { key: "systems_review", label: "General systems review", rows: 2,
      hint: "Anything else, body system by body system, not covered under Presenting Complaints." },
];
// What "Fill blanks" writes into empty boxes, for a patient with nothing to report.
const NOTHING_TO_REPORT = "None";

// A labelled box with its hint below it (DESIGN.md: help text under the field).
function NoteBox<T extends object>({ form, field, values, onChange }: {
    form: string; field: NoteField<T>; values: T; onChange: (key: keyof T & string, value: string) => void;
}) {
    const id = `triage-${form}-${field.key}`;
    return (
        <div>
            <Label htmlFor={id}>{field.label}{field.required && " *"}</Label>
            <Textarea id={id} aria-describedby={`${id}-hint`} value={String(values[field.key] ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)} rows={field.rows} className="mt-2" />
            <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
        </div>
    );
}

// The buttons under a section: they stay in view at the bottom of the scrolling column.
const SECTION_FOOTER = STICKY_FORM_FOOTER;

interface TriageTabsProps {
    // The selected patient, for "Save & next".
    patient: QueuedPatient;
    visit_id: number;
    patient_id: number;
    // Stations indicated for the visit; Triage chooses the patient's next stations.
    stations?: QueuedPatient["stations"];
    // Called with the visit's remaining stations after triage changes them.
    onStationsChanged?: (remaining: StationId[]) => void;
    // Shown above the section tabs, scrolling away as the form is filled (registration's vitals and
    // the TB line on the Triage page).
    context?: ReactNode;
}

export function TriageTabs({ patient, visit_id, patient_id, stations, onStationsChanged, context }: TriageTabsProps) {
    const canEdit = useUserStore(state => canEditSavedData(state.user));
    const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
    // Saved sections that have something in them: a section saved empty doesn't make Triage "done".
    const [savedFilled, setSavedFilled] = useState<Record<string, boolean>>({});
    const { confirm, dialog } = useConfirm();
    const [loadedVisit, setLoadedVisit] = useState<number | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [retry, setRetry] = useState(0);
    const locked = (section: string) => loadedVisit !== visit_id || (!canEdit && savedSections[section]);
    const saved = (section: string, filled: boolean) => {
        setSavedSections(previous => ({ ...previous, [section]: true }));
        setSavedFilled(previous => ({ ...previous, [section]: filled }));
        setSaveCounts(previous => ({ ...previous, [section]: (previous[section] ?? 0) + 1 }));
    };
    // Counts loads and each section's saves, so Next on the queue card knows what is unsaved.
    const [loadCount, setLoadCount] = useState(0);
    const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
    useEffect(() => {
      let cancelled = false;
      setLoadedVisit(null); setLoadError(false);
      Promise.all([
        getTriageRecord<VisualAcuity>("visual-acuity", patient_id, visit_id),
        getTriageRecord<PresentingComplaint>("presenting-complaint", patient_id, visit_id),
        getTriageRecord<MedicalHistory>("history", patient_id, visit_id),
      ]).then(([acuity, complaint, history]) => {
        if (cancelled) return;
        setVisualAcuity(acuityValues(acuity));
        setPresentingComplaint(complaintValues(complaint));
        setMedicalHistory(historyValues(history));
        setSavedSections({ acuity: acuity !== null, complaint: complaint !== null, history: history !== null });
        setSavedFilled({ acuity: acuityFilled(acuityValues(acuity)), complaint: anyFilled(complaintValues(complaint)), history: anyFilled(historyValues(history)) });
        setLoadedVisit(visit_id);
        setLoadCount(count => count + 1);
      }).catch(() => { if (!cancelled) setLoadError(true); });
      return () => { cancelled = true; };
    }, [patient_id, visit_id, retry]);
    // A failed load (weak Wi-Fi) is tried again by itself; Retry does it at once.
    useEffect(() => {
      if (!loadError) return;
      const timer = setTimeout(() => setRetry(value => value + 1), LOAD_RETRY_DELAYS_MS[Math.min(retry, LOAD_RETRY_DELAYS_MS.length - 1)]);
      return () => clearTimeout(timer);
    }, [loadError, retry]);
    const token = useUserStore((state) => state.user?.token);
    // The stations the patient goes to after Triage (Dental, Consult, the partner NGO), chosen at the
    // end of Triage. None is ticked for a new patient; one already on the route shows ticked, and one
    // already finished can't be changed.
    const queuedNext = TRIAGE_NEXT_STATION_IDS.filter((id) => (stations ?? []).some((s) => s.station === id && !s.completed));
    const doneNext = TRIAGE_NEXT_STATION_IDS.filter((id) => (stations ?? []).some((s) => s.station === id && s.completed));
    const [nextStations, setNextStations] = useState<StationId[]>(queuedNext);
    // Puts the ticked stations on the route and takes unticked ones off; resolves to whether it worked.
    const applyNextStations = async (): Promise<boolean> => {
        if (!stations || !token) return true;
        const changes = TRIAGE_NEXT_STATION_IDS.filter((id) => !doneNext.includes(id) && nextStations.includes(id) !== queuedNext.includes(id));
        if (!changes.length) return true;
        try {
            let remaining: StationId[] = [];
            // The server places each station in clinic order, keeping any custom route.
            for (const id of changes) remaining = await setStationNeeded(visit_id, id, nextStations.includes(id), token);
            onStationsChanged?.(remaining);
            return true;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save the next stations.");
            return false;
        }
    };
    // Nothing ticked and nowhere else to go: sending the patient on finishes their visit, so ask first.
    const confirmNoNextStation = async (): Promise<boolean> => {
        const goesOn = (stations ?? []).some((s) => !s.completed && s.station !== "triage");
        if (!stations || nextStations.length || goesOn) return true;
        return confirm({
            title: `Finish ${patient.english_name || "the patient"}'s visit after Triage?`,
            description: "No next station is ticked, so sending them on ends their visit. Cancel to tick Dental, Consult or the partner NGO.",
            confirmLabel: "Finish visit",
            destructive: false,
        });
    };

    const [isLoading, setIsLoading] = useState(false);

    const [visualAcuity, setVisualAcuity] = useState<VisualAcuity>({ ...EMPTY_EYE_READINGS, notes: "" });

    // "Suspected cataract" (Visual Acuity): send to the partner NGO (ticks it under Next stations),
    // refer to an optician (saved as refer_optician), or both.
    const [cataractOpen, setCataractOpen] = useState(false);
    useEffect(() => { setCataractOpen(false); }, [visit_id]);
    const sendToNgo = cataractOpen && nextStations.includes("seva");
    const suspectedCataract = cataractOpen || visualAcuity.refer_optician === true;
    // Unticking takes the partner NGO off Next stations only if it wasn't already on the route.
    const setNgo = (on: boolean) => {
        const keep = on || queuedNext.includes("seva") || doneNext.includes("seva");
        setNextStations(p => keep ? (p.includes("seva") ? p : [...p, "seva"]) : p.filter(id => id !== "seva"));
    };
    const setOptician = (on: boolean) => setVisualAcuity(p => ({ ...p, refer_optician: on }));
    const setSuspectedCataract = (on: boolean) => {
        setCataractOpen(on);
        if (!on) { setNgo(false); setOptician(false); }
    };

    const [presentingComplaint, setPresentingComplaint] = useState<PresentingComplaint>({
        history: "",
        red_flags: "",
        systems_review: "",
        drug_allergies: ""
    });

    const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>({
        past: "",
        drug_and_treatment: "",
        family: "",
        social: "",
        systems_review: ""
    });

    // Each section's save resolves to whether it was saved.
    const handleSaveVisualAcuity = async (): Promise<boolean> => {
        if (locked("acuity")) return false;
        const { notes, refer_optician: referOptician = false, ...readings } = visualAcuity;
        const fractions = normalizeSnellenFields(readings);
        if (!fractions) {
            toast.error(SNELLEN_ERROR);
            return false;
        }
        setVisualAcuity({ ...fractions, notes, refer_optician: referOptician });
        setIsLoading(true);
        const promise = saveVisualAcuity({ ...fractions, notes, refer_optician: referOptician, visit_id: visit_id }).then(async () => {
            saved("acuity", acuityFilled({ ...fractions, notes, refer_optician: referOptician }));
        });
        return settle(promise, 'Saving Visual Acuity data...');
    };

    const handleSavePresentingComplaint = async (): Promise<boolean> => {
        if (locked("complaint")) return false;
        setIsLoading(true);
        return settle(savePresentingComplaint({ ...presentingComplaint, visit_id: visit_id }).then(() => saved("complaint", anyFilled(presentingComplaint))), 'Saving Presenting Complaints...');
    };

    const handleSaveMedicalHistory = async (): Promise<boolean> => {
        if (locked("history")) return false;
        setIsLoading(true);
        return settle(saveMedicalHistory({ ...medicalHistory, visit_id: visit_id }).then(() => saved("history", anyFilled(medicalHistory))), 'Saving Medical History...');
    };

    // Shows the save's progress and result; resolves to whether it succeeded.
    const settle = (promise: Promise<unknown>, loading: string): Promise<boolean> =>
        toast.promise(promise, {
            loading,
            success: 'Data saved successfully!',
            error: (error) => error.message || 'Failed to save data.',
        }).then(() => true, () => false).finally(() => setIsLoading(false));

    // Next on the queue card saves every section with unsaved changes first, one by one.
    const sectionVersion = (section: SectionId) =>
        loadedVisit === visit_id ? `${visit_id}:${loadCount}:${saveCounts[section] ?? 0}` : null;
    useSaveBeforeNext(visit_id, sectionVersion("acuity"), visualAcuity, handleSaveVisualAcuity);
    useSaveBeforeNext(visit_id, sectionVersion("complaint"), presentingComplaint, handleSavePresentingComplaint);
    useSaveBeforeNext(visit_id, sectionVersion("history"), medicalHistory, handleSaveMedicalHistory);
    // The ticked next stations count as saved once they match the route.
    useSaveBeforeNext(visit_id, stations ? `${visit_id}:${queuedNext.join()}` : null, nextStations, applyNextStations);

    // Saves made for this visit on another device show here too, one section at a time.
    const showSaved = (section: SectionId, exists: boolean, filled: boolean) => {
        setSavedSections(previous => ({ ...previous, [section]: exists }));
        setSavedFilled(previous => ({ ...previous, [section]: filled }));
        setSaveCounts(previous => ({ ...previous, [section]: (previous[section] ?? 0) + 1 }));
    };
    const liveAcuity = useLiveRecord({
        visitId: visit_id, savedVersion: sectionVersion("acuity"), values: visualAcuity, valuesOf: acuityValues,
        load: () => getTriageRecord<VisualAcuity>("visual-acuity", patient_id, visit_id),
        apply: (data) => { setVisualAcuity(acuityValues(data)); showSaved("acuity", data !== null, acuityFilled(acuityValues(data))); },
        draft: { form: "triage-acuity", restore: setVisualAcuity },
    });
    const liveComplaint = useLiveRecord({
        visitId: visit_id, savedVersion: sectionVersion("complaint"), values: presentingComplaint, valuesOf: complaintValues,
        load: () => getTriageRecord<PresentingComplaint>("presenting-complaint", patient_id, visit_id),
        apply: (data) => { setPresentingComplaint(complaintValues(data)); showSaved("complaint", data !== null, anyFilled(complaintValues(data))); },
        draft: { form: "triage-complaint", restore: setPresentingComplaint },
    });
    const liveHistory = useLiveRecord({
        visitId: visit_id, savedVersion: sectionVersion("history"), values: medicalHistory, valuesOf: historyValues,
        load: () => getTriageRecord<MedicalHistory>("history", patient_id, visit_id),
        apply: (data) => { setMedicalHistory(historyValues(data)); showSaved("history", data !== null, anyFilled(historyValues(data))); },
        draft: { form: "triage-history", restore: setMedicalHistory },
    });

    // The open section. Like Registration's Next, saving Visual Acuity or Presenting Complaints moves
    // on to the next section; each patient starts at Visual Acuity.
    const [activeTab, setActiveTab] = useState("visual-acuity");
    useEffect(() => { setActiveTab("visual-acuity"); }, [visit_id]);
    // Opening a section after scrolling down the last one starts it at its first field, just under
    // the tabs, instead of part-way down.
    const tabsTop = useRef<HTMLDivElement>(null);
    const tabsBar = useRef<HTMLDivElement>(null);
    // Medical History scrolls inside its own section, so the patient column itself doesn't scroll and
    // everything above the section (registration details, Next stations, the tabs) stays where it is:
    // the fields get the column's height left below where they start, above the buttons. Below 1024px,
    // where the page scrolls as one with the queue above, the section isn't limited.
    const contextArea = useRef<HTMLDivElement>(null);
    const historyScroll = useRef<HTMLElement>(null);
    const historyFooter = useRef<HTMLDivElement>(null);
    const [historyMaxHeight, setHistoryMaxHeight] = useState<number | null>(null);
    useEffect(() => {
        const section = historyScroll.current, footer = historyFooter.current, above = contextArea.current;
        if (activeTab !== "medical-history" || !section || !footer || !above || typeof ResizeObserver === "undefined") return;
        const scroller = section.closest<HTMLElement>("[data-tour='station-work']");
        if (!scroller) return;
        const stacked = window.matchMedia?.("(max-width: 1023.98px)");
        const fit = () => {
            if (stacked?.matches) return setHistoryMaxHeight(null);
            // Where the section starts in the column's content, whatever it is scrolled to.
            const start = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
            // 24px: the footer's top margin.
            const room = scroller.clientHeight - start - footer.offsetHeight - 24;
            setHistoryMaxHeight(Math.max(160, Math.floor(room)));
        };
        fit();
        // Opened after scrolling down a longer section: back to the top, so nothing above is cut off.
        if (!stacked?.matches) scroller.scrollTop = 0;
        // Refit when the column is resized or anything above the section changes height.
        const observer = new ResizeObserver(fit);
        [scroller, above, footer].forEach((element) => observer.observe(element));
        stacked?.addEventListener?.("change", fit);
        return () => { observer.disconnect(); stacked?.removeEventListener?.("change", fit); };
    }, [activeTab]);
    const openTab = (tab: string) => {
        setActiveTab(tab);
        const top = tabsTop.current, bar = tabsBar.current;
        if (top && bar && bar.getBoundingClientRect().top - top.getBoundingClientRect().top > 1) {
            top.scrollIntoView({ block: "start" });
        }
    };
    // A section with nothing filled in is saved only once the user confirms it (e.g. the patient
    // declined), so an accidental click doesn't leave an empty record that looks finished.
    const confirmEmpty = (section: SectionId) => hasContent[section] || confirm({
        title: `Save ${sectionLabel(section)} with nothing filled in?`,
        description: "Save it empty only if the patient declined or it doesn't apply. To come back to it later, cancel and open another section.",
        confirmLabel: "Save empty",
        destructive: false,
    });
    // Saves a section after confirmEmpty; resolves to whether it was saved.
    const saveSection = (section: SectionId, save: () => Promise<boolean>) => async (): Promise<boolean> =>
        (await confirmEmpty(section)) && save();
    // Saves the section (unless it is saved and this account can't change it), then opens the next.
    // A failed or cancelled save stays on the section.
    const saveThenOpen = (section: SectionId, save: () => Promise<boolean>, next: string) => async () => {
        if (!locked(section) && !(await saveSection(section, save)())) return;
        openTab(next);
    };

    // Done: every section saved, with something in it.
    const triageDone = SECTIONS.every((section) => savedSections[section.id] && savedFilled[section.id]);

    // A section is complete when every reading or field is filled in (notes are optional), and is
    // ready when it is complete or already saved. "Save & next" turns green once all three are ready.
    const filled = (values: string[]) => values.every((value) => value.trim() !== "");
    const requiredValues = <T,>(fields: NoteField<T>[], values: T) =>
        fields.filter((field) => field.required).map((field) => String(values[field.key] ?? ""));
    const sectionComplete: Record<SectionId, boolean> = {
        acuity: filled(REQUIRED_EYE_READING_FIELDS.map((field) => visualAcuity[field])),
        complaint: filled(requiredValues(COMPLAINT_FIELDS, presentingComplaint)),
        history: filled(requiredValues(HISTORY_FIELDS, medicalHistory)),
    };
    const sectionReady = (id: SectionId) => Boolean(savedSections[id]) || sectionComplete[id];
    const triageReady = loadedVisit === visit_id && SECTIONS.every((section) => sectionReady(section.id));
    const notReady = SECTIONS.filter((section) => !sectionReady(section.id)).map((section) => section.label);
    const readyHint = notReady.length ? `Still to fill in: ${listWords(notReady)} (fields marked *).` : undefined;
    // Unsaved sections with something typed in, so "Save & next" can save them too.
    const hasContent: Record<SectionId, boolean> = {
        acuity: acuityFilled(visualAcuity), complaint: anyFilled(presentingComplaint), history: anyFilled(medicalHistory),
    };

    // "Save & next" (on Medical History, the last section; the earlier ones step through with
    // "Save, next: …", and the queue card's Next sends a patient on from anywhere): saves it (if it can still be changed) and any other section
    // filled in but not saved yet, then moves the patient on only when every section is saved,
    // naming any that are missing.
    const saveAndNext = (section: SectionId, save: () => Promise<boolean>) => async (): Promise<boolean> => {
        if (!savedSections[section] || !locked(section)) {
            if (!(await saveSection(section, save)())) return false;
        }
        const saves: Record<SectionId, () => Promise<boolean>> = {
            acuity: handleSaveVisualAcuity, complaint: handleSavePresentingComplaint, history: handleSaveMedicalHistory,
        };
        const nowSaved = new Set<SectionId>([section]);
        for (const other of SECTIONS) {
            if (other.id === section) continue;
            if (savedSections[other.id]) nowSaved.add(other.id);
            else if (hasContent[other.id] && await saves[other.id]()) nowSaved.add(other.id);
        }
        const missing = SECTIONS.filter((other) => !nowSaved.has(other.id));
        if (missing.length) {
            toast.error(`Save ${listWords(missing.map((other) => other.label))} too before sending the patient on.`);
            return false;
        }
        return (await confirmNoNextStation()) && applyNextStations();
    };

    // Next on the queue card (or Send to next station): anything typed is saved first; sections left
    // empty and unsaved are asked about, as Save & next would refuse them, and so is sending the
    // patient on with no next station ticked.
    useLeaveCheck(visit_id, async () => {
        if (loadedVisit !== visit_id) return true;
        const missing = SECTIONS.filter((section) => !savedSections[section.id] && !hasContent[section.id]);
        if (!missing.length) return confirmNoNextStation();
        return (await confirm({
            title: `Send ${patient.english_name || "the patient"} on without ${listWords(missing.map((section) => section.label))}?`,
            description: "Triage isn't finished: those sections aren't saved. Send them on only if they declined or it doesn't apply.",
            confirmLabel: "Send on anyway",
            destructive: false,
        })) && confirmNoNextStation();
    });

    // Fills every empty box in a section with "None", for a patient with nothing to report.
    const fillBlanks = <T extends object>(fields: NoteField<T>[], set: (update: (previous: T) => T) => void) => () =>
        set((previous) => ({
            ...previous,
            ...Object.fromEntries(fields.filter((field) => !String(previous[field.key] ?? "").trim())
                .map((field) => [field.key, NOTHING_TO_REPORT])),
        }));
    // A faint outline, with the app's hover message.
    const fillBlanksButton = (onClick: () => void, any: boolean) => (
        <Button type="button" variant="outline" className="mr-auto self-center border-input/50 leading-none text-muted-foreground shadow-none"
            disabled={!any || isLoading} title={`Fills empty boxes with "${NOTHING_TO_REPORT}"`} onClick={onClick}>
            Fill blanks with &ldquo;{NOTHING_TO_REPORT}&rdquo;
        </Button>
    );
    const hasBlank = <T,>(fields: NoteField<T>[], values: T) => fields.some((field) => !String(values[field.key] ?? "").trim());

    return (
        <Tabs value={activeTab} onValueChange={openTab} className="flex flex-col">
            {dialog}
            <div ref={contextArea} className="space-y-3 px-5 pt-4">
                {context}
                {/* Where the patient goes after Triage, with what Registration recorded. In the page's
                    normal flow (scrolls away with it), so it never covers the form or its buttons. */}
                {stations && (
                    <fieldset className="flex flex-wrap items-center gap-x-4 border-t border-border pt-3">
                        <legend className="sr-only">Next stations</legend>
                        <span aria-hidden="true" className="text-sm font-semibold">Next stations</span>
                        <StationCheckboxes idPrefix="triage-next" options={TRIAGE_NEXT_STATION_IDS}
                            selected={nextStations} locked={doneNext} onChange={setNextStations} />
                        <p className="basis-full text-xs text-muted-foreground">
                            Tick where the patient goes after Triage. They queue in clinic order once sent on.
                        </p>
                    </fieldset>
                )}
                {loadError && (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning-ink">
                        <span className="flex items-center gap-2"><WifiOff className="size-4 shrink-0" aria-hidden="true" />Can&apos;t reach the host laptop to load the saved triage. Trying again…</span>
                        <Button type="button" size="sm" variant="outline" className="bg-background" onClick={() => setRetry(value => value + 1)}>
                            <RefreshCw className="size-4" aria-hidden="true" />Retry now
                        </Button>
                    </div>
                )}
                <StationDonePrompt patient={patient} done={loadedVisit === visit_id && triageDone} />
                <LiveRecordNotice live={liveAcuity} label="Visual Acuity" />
                <LiveRecordNotice live={liveComplaint} label="Presenting Complaints" />
                <LiveRecordNotice live={liveHistory} label="Medical History" />
            </div>
            {/* The tabs stick under the patient bar (--patient-bar, set by the page). */}
            <div ref={tabsTop} aria-hidden="true" style={{ scrollMarginTop: "var(--patient-bar, 0px)" }} />
            <div ref={tabsBar} className="sticky z-10 mt-4 border-b border-border bg-card px-5 py-2" style={{ top: "var(--patient-bar, 0px)" }}>
                <TabsList className="grid w-full grid-cols-3 bg-muted/80">
                    {SECTIONS.map((section) => (
                        <TabsTrigger key={section.id} value={SECTION_TABS[section.id]} className={SECTION_TAB}>
                            {section.label}
                            <SectionMark saved={Boolean(savedSections[section.id] && savedFilled[section.id])}
                                unsaved={!savedSections[section.id] && hasContent[section.id]} />
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>

            <div className="px-5 pt-5">
                <TabsContent value="visual-acuity" className="mt-0"><SavedRecordFields locked={locked("acuity")}>
                    <section className="space-y-5">
                        <EyeReadingsGrid values={visualAcuity} onChange={(field, value) => setVisualAcuity(p => ({ ...p, [field]: value }))} />
                        <div className="rounded-lg border border-border p-3">
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="suspected-cataract"
                                    checked={suspectedCataract}
                                    onCheckedChange={(checked) => setSuspectedCataract(checked === true)}
                                    className="mt-0.5 bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                                <div>
                                    <Label htmlFor="suspected-cataract">Suspected cataract</Label>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Send to the {PARTNER_NGO_NAME} today, refer to an optician (listed on the Analytics page), or both.
                                    </p>
                                </div>
                            </div>
                            {suspectedCataract && (
                                <fieldset className="mt-3 flex flex-wrap gap-x-6 gap-y-2 pl-6">
                                    <legend className="sr-only">Suspected cataract: where to send</legend>
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="cataract-ngo" checked={sendToNgo} disabled={!stations}
                                            onCheckedChange={(checked) => setNgo(checked === true)}
                                            className="bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                                        <Label htmlFor="cataract-ngo">Send to {PARTNER_NGO_NAME}</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="cataract-optician" checked={visualAcuity.refer_optician === true}
                                            onCheckedChange={(checked) => setOptician(checked === true)}
                                            className="bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                                        <Label htmlFor="cataract-optician">Refer to optician</Label>
                                    </div>
                                </fieldset>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="triage-visualAcuity-notes">Notes</Label>
                            <Textarea id="triage-visualAcuity-notes" value={visualAcuity.notes} onChange={(e) => setVisualAcuity(p => ({...p, notes: e.target.value}))} rows={3} className="mt-2" />
                        </div>
                    </section>
                    <div className={SECTION_FOOTER}>
                        <Button onClick={saveThenOpen("acuity", handleSaveVisualAcuity, "presenting-complaint")} disabled={isLoading || loadedVisit !== visit_id}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save, next: Complaints"}</Button>
                    </div>
                </SavedRecordFields></TabsContent>

                <TabsContent value="presenting-complaint" className="mt-0"><SavedRecordFields locked={locked("complaint")}>
                    <section className="space-y-5">
                        {COMPLAINT_FIELDS.map((field) => (
                            <NoteBox key={field.key} form="presentingComplaint" field={field} values={presentingComplaint}
                                onChange={(key, value) => setPresentingComplaint(p => ({ ...p, [key]: value }))} />
                        ))}
                    </section>
                    <div className={SECTION_FOOTER}>
                        {fillBlanksButton(fillBlanks(COMPLAINT_FIELDS, setPresentingComplaint), hasBlank(COMPLAINT_FIELDS, presentingComplaint))}
                        <Button onClick={saveThenOpen("complaint", handleSavePresentingComplaint, "medical-history")} disabled={isLoading || loadedVisit !== visit_id}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save, next: History"}</Button>
                    </div>
                </SavedRecordFields></TabsContent>

                <TabsContent value="medical-history" className="mt-0"><SavedRecordFields locked={locked("history")}>
                    {/* Scrolls on its own when the fields are taller than the space left in the column. The
                        padding keeps the fields' focus rings inside the scroll area. */}
                    <section ref={historyScroll} style={historyMaxHeight ? { maxHeight: historyMaxHeight } : undefined}
                        className="-mx-1 space-y-5 overflow-y-auto px-1 pb-1 [scrollbar-gutter:stable]">
                        {HISTORY_FIELDS.map((field) => (
                            <NoteBox key={field.key} form="medicalHistory" field={field} values={medicalHistory}
                                onChange={(key, value) => setMedicalHistory(p => ({ ...p, [key]: value }))} />
                        ))}
                    </section>
                    <div ref={historyFooter} className={SECTION_FOOTER}>
                        {fillBlanksButton(fillBlanks(HISTORY_FIELDS, setMedicalHistory), hasBlank(HISTORY_FIELDS, medicalHistory))}
                        {/* What Save & next still needs, in words (not only in its tooltip). */}
                        {!triageDone && !triageReady && readyHint && (
                            <p className="order-first basis-full text-right text-xs text-muted-foreground">{readyHint}</p>
                        )}
                        {/* The last section: Save & next (send the patient on) is the main button, unless the "Done
                            at Triage" prompt above already offers it. */}
                        <Button variant="outline" onClick={saveSection("history", handleSaveMedicalHistory)} disabled={isLoading || loadedVisit !== visit_id}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save History"}</Button>
                        {!triageDone && (
                            <SaveAndNextButton primary patient={patient} onSave={saveAndNext("history", handleSaveMedicalHistory)} ready={triageReady} hint={readyHint} disabled={isLoading || loadedVisit !== visit_id} />
                        )}
                    </div>
                </SavedRecordFields></TabsContent>
            </div>
        </Tabs>
    );


}

