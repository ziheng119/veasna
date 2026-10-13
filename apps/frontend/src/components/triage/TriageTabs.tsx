"use client"

import { useState } from "react";
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
import SnellenInput from "@/components/shared/SnellenInput";
import { normalizeSnellenFields, SNELLEN_ERROR } from "@/lib/snellen";
import { PresentingComplaint } from "@/lib/types/medicalHistory";
import { MedicalHistory } from "@/lib/types/medicalHistory";
import { Checkbox } from "@/components/ui/checkbox";
import { QueuedPatient } from "@/lib/types/patient";
import { ALL_STATION_IDS, StationId } from "@/constants/stations";
import { updateVisitStations } from "@/lib/api/queue/stations";
import { useUserStore } from "@/stores/useUserStore";

interface TriageTabsProps {
    visit_id: number;
    // Stations indicated for the visit; lets triage send the patient to Seva.
    stations?: QueuedPatient["stations"];
    // Called with the visit's remaining stations after triage changes them.
    onStationsChanged?: (remaining: StationId[]) => void;
}

export function TriageTabs({ visit_id, stations, onStationsChanged }: TriageTabsProps) {
    const token = useUserStore((state) => state.user?.token);
    const remainingStations = (stations ?? []).filter((s) => !s.completed).map((s) => s.station);
    const sevaQueued = remainingStations.includes("seva");
    const sevaDone = (stations ?? []).some((s) => s.station === "seva" && s.completed);
    // Seva is only for patients suspected of cataracts after the Snellen's test.
    const [sendToSeva, setSendToSeva] = useState(sevaQueued);

    const [isLoading, setIsLoading] = useState(false);

    const [visualAcuity, setVisualAcuity] = useState<VisualAcuity> ({
        left_with_pinhole: "",
        left_without_pinhole: "",
        right_with_pinhole: "",
        right_without_pinhole: "",
        notes: ""
    });

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

    const handleSaveVisualAcuity = async () => {
        const { notes, ...readings } = visualAcuity;
        const fractions = normalizeSnellenFields(readings);
        if (!fractions) {
            toast.error(SNELLEN_ERROR);
            return;
        }
        setVisualAcuity({ ...fractions, notes });
        setIsLoading(true);
        const promise = saveVisualAcuity({ ...fractions, notes, visit_id: visit_id }).then(async () => {
            if (!stations || !token || sevaDone || sendToSeva === sevaQueued) return;
            const remaining = ALL_STATION_IDS.filter((id) =>
                id === "seva" ? sendToSeva : remainingStations.includes(id)
            );
            await updateVisitStations(visit_id, remaining, token);
            onStationsChanged?.(remaining);
        });
        toast.promise(promise, {
            loading: 'Saving Visual Acuity data...',
            success: 'Data saved successfully!',
            error: (error) => error.message || 'Failed to save data.',
        }).finally(() => setIsLoading(false));
    };

    const handleSavePresentingComplaint = async () => {
        setIsLoading(true);
        const promise = savePresentingComplaint({ ...presentingComplaint, visit_id: visit_id });
        toast.promise(promise, {
            loading: 'Saving Presenting Complaints...',
            success: 'Data saved successfully!',
            error: (err) => err.message,
        }).finally(() => setIsLoading(false));
    };

    const handleSaveMedicalHistory = async () => {
        setIsLoading(true);
        const promise = saveMedicalHistory({ ...medicalHistory, visit_id: visit_id });
        toast.promise(promise, {
            loading: 'Saving Medical History...',
            success: 'Data saved successfully!',
            error: (err) => err.message,
        }).finally(() => setIsLoading(false));
    };

    return (
        <Tabs defaultValue="visual-acuity" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 bg-muted/80">
                <TabsTrigger value="visual-acuity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Visual Acuity</TabsTrigger>
                <TabsTrigger value="presenting-complaint" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Presenting Complaints</TabsTrigger>
                <TabsTrigger value="medical-history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Medical History</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-6">
                {/* Visual Acuity Form */}
                <TabsContent value="visual-acuity" className="mt-0">
                    <Card className="bg-card border-border">
                        <CardHeader><CardTitle className="text-foreground">Snellen's Test (Visual Acuity)</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h4 className="text-foreground">Left Eye</h4>
                                    <div>
                                        <Label className="text-muted-foreground">With Pinhole</Label>
                                        <SnellenInput value={visualAcuity.left_with_pinhole} onChange={(value) => setVisualAcuity(p => ({...p, left_with_pinhole: value}))} className="mt-2" />
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Without Pinhole</Label>
                                        <SnellenInput value={visualAcuity.left_without_pinhole} onChange={(value) => setVisualAcuity(p => ({...p, left_without_pinhole: value}))} className="mt-2" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-foreground">Right Eye</h4>
                                    <div>
                                        <Label className="text-muted-foreground">With Pinhole</Label>
                                        <SnellenInput value={visualAcuity.right_with_pinhole} onChange={(value) => setVisualAcuity(p => ({...p, right_with_pinhole: value}))} className="mt-2" />
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Without Pinhole</Label>
                                        <SnellenInput value={visualAcuity.right_without_pinhole} onChange={(value) => setVisualAcuity(p => ({...p, right_without_pinhole: value}))} className="mt-2" />
                                    </div>
                                </div>
                            </div>
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
                                        <Label htmlFor="send-to-seva" className="text-foreground">Suspected cataract: send to Seva</Label>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {sevaDone
                                                ? "This patient has already been seen at Seva."
                                                : "Adds Seva to this patient's stations when the visual acuity is saved."}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div>
                                <Label className="text-muted-foreground">Notes</Label>
                                <Textarea value={visualAcuity.notes} onChange={(e) => setVisualAcuity(p => ({...p, notes: e.target.value}))} rows={3} className="mt-2" />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end bg-card pt-4">
                            <Button onClick={handleSaveVisualAcuity} disabled={isLoading}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save Visual Acuity"}</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* Presenting Complaints Form */}
                <TabsContent value="presenting-complaint" className="mt-0">
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
                        <CardFooter className="flex justify-end bg-card pt-4">
                            <Button onClick={handleSavePresentingComplaint} disabled={isLoading}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save Complaints"}</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* Medical History Form */}
                <TabsContent value="medical-history" className="mt-0">
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
                        <CardFooter className="flex justify-end bg-card pt-4">
                            <Button onClick={handleSaveMedicalHistory} disabled={isLoading}><Save className="w-4 h-4 mr-2" />{isLoading ? "Saving..." : "Save History"}</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </div>
        </Tabs>
    );


}

