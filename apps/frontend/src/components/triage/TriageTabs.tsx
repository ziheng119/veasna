"use client"

import SavedRecordFields from "@/components/shared/SavedRecordFields";
import { getTriageRecord } from "@/lib/api/triage/triageService";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save } from "lucide-react";
import toast from "react-hot-toast";
import { saveVisualAcuity,savePresentingComplaint, saveMedicalHistory} from "@/lib/api/triage/triageService";   
import { VisualAcuity } from "@/lib/types/visualAcuity";
import EyeReadingsGrid, { EMPTY_EYE_READINGS, EYE_READING_FIELDS, EyeReadings, REQUIRED_EYE_READING_FIELDS } from "@/components/shared/EyeReadingsGrid";
import { normalizeSnellenFields, SNELLEN_ERROR } from "@/lib/snellen";
import { PresentingComplaint } from "@/lib/types/medicalHistory";
import { MedicalHistory } from "@/lib/types/medicalHistory";
import { Checkbox } from "@/components/ui/checkbox";
import { QueuedPatient } from "@/lib/types/patient";
import { StationId } from "@/constants/stations";
import { setStationNeeded } from "@/lib/api/queue/stations";
import { useUserStore } from "@/stores/useUserStore";
import { canEditSavedData } from "@/lib/permissions";
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { SaveAndNextButton, StationDonePrompt, useSaveBeforeNext } from "@/components/shared/StationFlow";
import { LiveRecordNotice, useLiveRecord } from "@/components/shared/LiveRecord";
import { LOAD_RETRY_DELAYS_MS } from "@/hooks/useRecordLoad";

// Triage is done when every section is saved.
const SECTIONS = [
    { id: "acuity", label: "Visual Acuity" },
    { id: "complaint", label: "Presenting Complaints" },
    { id: "history", label: "Medical History" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

// Each section's form values for its saved record (empty when there is none).
const acuityValues = (acuity: VisualAcuity | null): VisualAcuity => ({
    ...Object.fromEntries(EYE_READING_FIELDS.map((field) => [field, acuity?.[field] ?? ""])) as EyeReadings,
    notes: acuity?.notes ?? "",
});
const complaintValues = (complaint: PresentingComplaint | null): PresentingComplaint => ({
    history: complaint?.history ?? "", red_flags: complaint?.red_flags ?? "", systems_review: complaint?.systems_review ?? "", drug_allergies: complaint?.drug_allergies ?? "",
});
const historyValues = (history: MedicalHistory | null): MedicalHistory => ({
    past: history?.past ?? "", drug_and_treatment: history?.drug_and_treatment ?? "", family: history?.family ?? "", social: history?.social ?? "", systems_review: history?.systems_review ?? "",
});

interface TriageTabsProps {
    // The selected patient, for "Save & next".
    patient: QueuedPatient;
    visit_id: number;
    patient_id: number;
    // Stations indicated for the visit; lets triage send the patient to Seva.
    stations?: QueuedPatient["stations"];
    // Called with the visit's remaining stations after triage changes them.
    onStationsChanged?: (remaining: StationId[]) => void;
}

export function TriageTabs({ patient, visit_id, patient_id, stations, onStationsChanged }: TriageTabsProps) {
    const canEdit = useUserStore(state => canEditSavedData(state.user?.role));
    const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
    const [loadedVisit, setLoadedVisit] = useState<number | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [retry, setRetry] = useState(0);
    const locked = (section: string) => loadedVisit !== visit_id || (!canEdit && savedSections[section]);
    const saved = (section: string) => {
        setSavedSections(previous => ({ ...previous, [section]: true }));
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
    const remainingStations = (stations ?? []).filter((s) => !s.completed).map((s) => s.station);
    const sevaQueued = remainingStations.includes("seva");
    const sevaDone = (stations ?? []).some((s) => s.station === "seva" && s.completed);
    // Seva is only for patients suspected of cataracts after the Snellen's test.
    const [sendToSeva, setSendToSeva] = useState(sevaQueued);

    const [isLoading, setIsLoading] = useState(false);

    const [visualAcuity, setVisualAcuity] = useState<VisualAcuity>({ ...EMPTY_EYE_READINGS, notes: "" });

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
        const { notes, ...readings } = visualAcuity;
        const fractions = normalizeSnellenFields(readings);
        if (!fractions) {
            toast.error(SNELLEN_ERROR);
            return false;
        }
        setVisualAcuity({ ...fractions, notes });
        setIsLoading(true);
        const promise = saveVisualAcuity({ ...fractions, notes, visit_id: visit_id }).then(async () => {
            saved("acuity");
            if (!stations || !token || sevaDone || sendToSeva === sevaQueued) return;
            // The server places the partner NGO in clinic order, keeping any custom route.
            onStationsChanged?.(await setStationNeeded(visit_id, "seva", sendToSeva, token));
        });
        return settle(promise, 'Saving Visual Acuity data...');
    };

    const handleSavePresentingComplaint = async (): Promise<boolean> => {
        if (locked("complaint")) return false;
        setIsLoading(true);
        return settle(savePresentingComplaint({ ...presentingComplaint, visit_id: visit_id }).then(() => saved("complaint")), 'Saving Presenting Complaints...');
    };

    const handleSaveMedicalHistory = async (): Promise<boolean> => {
        if (locked("history")) return false;
        setIsLoading(true);
        return settle(saveMedicalHistory({ ...medicalHistory, visit_id: visit_id }).then(() => saved("history")), 'Saving Medical History...');
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
    useSaveBeforeNext(visit_id, sectionVersion("acuity"), { visualAcuity, sendToSeva }, handleSaveVisualAcuity);
    useSaveBeforeNext(visit_id, sectionVersion("complaint"), presentingComplaint, handleSavePresentingComplaint);
    useSaveBeforeNext(visit_id, sectionVersion("history"), medicalHistory, handleSaveMedicalHistory);

    // Saves made for this visit on another device show here too, one section at a time.
    const showSaved = (section: SectionId, exists: boolean) => {
        setSavedSections(previous => ({ ...previous, [section]: exists }));
        setSaveCounts(previous => ({ ...previous, [section]: (previous[section] ?? 0) + 1 }));
    };
    const liveAcuity = useLiveRecord({
        visitId: visit_id, savedVersion: sectionVersion("acuity"), values: visualAcuity, valuesOf: acuityValues,
        load: () => getTriageRecord<VisualAcuity>("visual-acuity", patient_id, visit_id),
        apply: (data) => { setVisualAcuity(acuityValues(data)); showSaved("acuity", data !== null); },
        draft: { form: "triage-acuity", restore: setVisualAcuity },
    });
    const liveComplaint = useLiveRecord({
        visitId: visit_id, savedVersion: sectionVersion("complaint"), values: presentingComplaint, valuesOf: complaintValues,
        load: () => getTriageRecord<PresentingComplaint>("presenting-complaint", patient_id, visit_id),
        apply: (data) => { setPresentingComplaint(complaintValues(data)); showSaved("complaint", data !== null); },
        draft: { form: "triage-complaint", restore: setPresentingComplaint },
    });
    const liveHistory = useLiveRecord({
        visitId: visit_id, savedVersion: sectionVersion("history"), values: medicalHistory, valuesOf: historyValues,
        load: () => getTriageRecord<MedicalHistory>("history", patient_id, visit_id),
        apply: (data) => { setMedicalHistory(historyValues(data)); showSaved("history", data !== null); },
        draft: { form: "triage-history", restore: setMedicalHistory },
    });

    const triageDone = SECTIONS.every((section) => savedSections[section.id]);

    // A section is complete when every reading or field is filled in (notes are optional), and is
    // ready when it is complete or already saved. "Save & next" turns green once all three are ready.
    const filled = (values: string[]) => values.every((value) => value.trim() !== "");
    const sectionComplete: Record<SectionId, boolean> = {
        acuity: filled(REQUIRED_EYE_READING_FIELDS.map((field) => visualAcuity[field])),
        complaint: filled(Object.values(presentingComplaint)),
        history: filled(Object.values(medicalHistory)),
    };
    const sectionReady = (id: SectionId) => Boolean(savedSections[id]) || sectionComplete[id];
    const triageReady = loadedVisit === visit_id && SECTIONS.every((section) => sectionReady(section.id));
    const notReady = SECTIONS.filter((section) => !sectionReady(section.id)).map((section) => section.label);
    const readyHint = notReady.length ? `Fill in ${notReady.join(" and ")} to finish` : undefined;
    // Unsaved sections with something typed in, so "Save & next" can save them too.
    const hasContent: Record<SectionId, boolean> = {
        acuity: Object.values(visualAcuity).some((value) => value.trim() !== ""),
        complaint: Object.values(presentingComplaint).some((value) => value.trim() !== ""),
        history: Object.values(medicalHistory).some((value) => value.trim() !== ""),
    };

    // "Save & next" from any section: saves it (if it can still be changed) and any other section
    // filled in but not saved yet, then moves the patient on only when every section is saved,
    // naming any that are missing.
    const saveAndNext = (section: SectionId, save: () => Promise<boolean>) => async (): Promise<boolean> => {
        if (!savedSections[section] || !locked(section)) {
            if (!(await save())) return false;
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
            toast.error(`Save ${missing.map((other) => other.label).join(" and ")} too before sending the patient on.`);
            return false;
        }
        return true;
    };

    return (
        <Tabs defaultValue="visual-acuity" className="h-full flex flex-col">
            {loadError && <p role="alert">Can&apos;t reach the host laptop to load the saved triage data. Trying again… <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
            <div className="mb-3 space-y-2">
                <StationDonePrompt patient={patient} done={loadedVisit === visit_id && triageDone} />
                <LiveRecordNotice live={liveAcuity} label="Visual Acuity" />
                <LiveRecordNotice live={liveComplaint} label="Presenting Complaints" />
                <LiveRecordNotice live={liveHistory} label="Medical History" />
            </div>
            <TabsList className="grid w-full grid-cols-3 bg-muted/80">
                <TabsTrigger value="visual-acuity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Visual Acuity</TabsTrigger>
                <TabsTrigger value="presenting-complaint" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Presenting Complaints</TabsTrigger>
                <TabsTrigger value="medical-history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Medical History</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-6">
                {/* Visual Acuity Form */}
                <TabsContent value="visual-acuity" className="mt-0"><SavedRecordFields locked={locked("acuity")}>
                    <Card className="bg-card border-border">
                        <CardHeader><CardTitle className="text-foreground">Snellen's Test (Visual Acuity)</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <EyeReadingsGrid values={visualAcuity} onChange={(field, value) => setVisualAcuity(p => ({ ...p, [field]: value }))} />
                            {stations && (
                                <div className="flex items-start space-x-2 rounded-md border border-border p-3">
                                    <Checkbox
                                        id="send-to-seva"
                                        checked={sevaDone || sendToSeva}
                                        disabled={sevaDone}
                                        onCheckedChange={(checked) => setSendToSeva(checked === true)}
                                        className="mt-0.5 border-border bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                    />
                                    <div>
                                        <Label htmlFor="send-to-seva" className="text-foreground">Suspected cataract: send to {PARTNER_NGO_NAME}</Label>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {sevaDone
                                                ? `This patient has already been seen at ${PARTNER_NGO_NAME}.`
                                                : `Adds ${PARTNER_NGO_NAME} to this patient's stations when the visual acuity is saved.`}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div>
                                <Label className="text-muted-foreground">Notes</Label>
                                <Textarea value={visualAcuity.notes} onChange={(e) => setVisualAcuity(p => ({...p, notes: e.target.value}))} rows={3} className="mt-2" />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 bg-card pt-4">
                            <Button onClick={handleSaveVisualAcuity} disabled={isLoading}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save Visual Acuity"}</Button>
                            <SaveAndNextButton patient={patient} onSave={saveAndNext("acuity", handleSaveVisualAcuity)} ready={triageReady} hint={readyHint} disabled={isLoading || loadedVisit !== visit_id} />
                        </CardFooter>
                    </Card>
                </SavedRecordFields></TabsContent>

                {/* Presenting Complaints Form */}
                <TabsContent value="presenting-complaint" className="mt-0"><SavedRecordFields locked={locked("complaint")}>
                     <Card className="bg-card border-border">
                        <CardHeader><CardTitle className="text-foreground">Presenting Complaints</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-muted-foreground">History of Presenting Symptoms</Label>
                                <Textarea value={presentingComplaint.history} onChange={(e) => setPresentingComplaint(p => ({...p, history: e.target.value}))} rows={4} className="mt-2" />
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Red Flags</Label>
                                <Textarea value={presentingComplaint.red_flags} onChange={(e) => setPresentingComplaint(p => ({...p, red_flags: e.target.value}))} rows={3} className="mt-2" />
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Systems Review</Label>
                                <Textarea value={presentingComplaint.systems_review} onChange={(e) => setPresentingComplaint(p => ({...p, systems_review: e.target.value}))} rows={4} className="mt-2" />
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Drug Allergies</Label>
                                <Textarea value={presentingComplaint.drug_allergies} onChange={(e) => setPresentingComplaint(p => ({...p, drug_allergies: e.target.value}))} rows={3} className="mt-2" />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 bg-card pt-4">
                            <Button onClick={handleSavePresentingComplaint} disabled={isLoading}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save Complaints"}</Button>
                            <SaveAndNextButton patient={patient} onSave={saveAndNext("complaint", handleSavePresentingComplaint)} ready={triageReady} hint={readyHint} disabled={isLoading || loadedVisit !== visit_id} />
                        </CardFooter>
                    </Card>
                </SavedRecordFields></TabsContent>

                {/* Medical History Form */}
                <TabsContent value="medical-history" className="mt-0"><SavedRecordFields locked={locked("history")}>
                    <Card className="bg-card border-border">
                        <CardHeader><CardTitle className="text-foreground">Medical History</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-muted-foreground">Past Medical History</Label>
                                <Textarea value={medicalHistory.past} onChange={(e) => setMedicalHistory(p => ({...p, past: e.target.value}))} rows={4} className="mt-2" />
                            </div>
                             <div>
                                <Label className="text-muted-foreground">Drug and Treatment History</Label>
                                <Textarea value={medicalHistory.drug_and_treatment} onChange={(e) => setMedicalHistory(p => ({...p, drug_and_treatment: e.target.value}))} rows={4} className="mt-2" />
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Family History</Label>
                                <Textarea value={medicalHistory.family} onChange={(e) => setMedicalHistory(p => ({...p, family: e.target.value}))} rows={3} className="mt-2" />
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Social History</Label>
                                <Textarea value={medicalHistory.social} onChange={(e) => setMedicalHistory(p => ({...p, social: e.target.value}))} rows={3} className="mt-2" />
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Systems Review</Label>
                                <Textarea value={medicalHistory.systems_review} onChange={(e) => setMedicalHistory(p => ({...p, systems_review: e.target.value}))} rows={4} className="mt-2" />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 bg-card pt-4">
                            <Button onClick={handleSaveMedicalHistory} disabled={isLoading}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save History"}</Button>
                            <SaveAndNextButton patient={patient} onSave={saveAndNext("history", handleSaveMedicalHistory)} ready={triageReady} hint={readyHint} disabled={isLoading || loadedVisit !== visit_id} />
                        </CardFooter>
                    </Card>
                </SavedRecordFields></TabsContent>
            </div>
        </Tabs>
    );


}

