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
import { PresentingComplaint } from "@/lib/types/medicalHistory";
import { MedicalHistory } from "@/lib/types/medicalHistory";

interface TriageTabsProps {
    visit_id: number;
}

export function TriageTabs({ visit_id }: TriageTabsProps) {

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
        setIsLoading(true);
        const promise = saveVisualAcuity({ ...visualAcuity, visit_id: visit_id });
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
                                        <Input value={visualAcuity.left_with_pinhole} onChange={(e) => setVisualAcuity(p => ({...p, left_with_pinhole: e.target.value}))} className="mt-2" />
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Without Pinhole</Label>
                                        <Input value={visualAcuity.left_without_pinhole} onChange={(e) => setVisualAcuity(p => ({...p, left_without_pinhole: e.target.value}))} className="mt-2" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-foreground">Right Eye</h4>
                                    <div>
                                        <Label className="text-muted-foreground">With Pinhole</Label>
                                        <Input value={visualAcuity.right_with_pinhole} onChange={(e) => setVisualAcuity(p => ({...p, right_with_pinhole: e.target.value}))} className="mt-2" />
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Without Pinhole</Label>
                                        <Input value={visualAcuity.right_without_pinhole} onChange={(e) => setVisualAcuity(p => ({...p, right_without_pinhole: e.target.value}))} className="mt-2" />
                                    </div>
                                </div>
                            </div>
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

