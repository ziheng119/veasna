"use client"

import { useState } from "react";
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
import { createVisit } from "@/lib/api/visit/createVisit";
import formatDate from "@/helper/format_date";
import { useLocationDataStore } from "@/stores/useLocationDataStore";
import { PageCard } from "../shared/PageCard";

interface PatientFormProps {
    existingPatients: PatientInfo[];
    onSubmit: (patient: QueuedPatient) => void;
    locationId?: number;
}

type FormErrors = {
    queue_no?: string;
    english_name?: string;
    sex?: string;
    face_id?: string;
    height?: string;
    weight?: string;
    bmi?: string;
    bp_systolic?: string;
    bp_diastolic?: string;
    temperature?: string;
    know_of_hef?: string;
    has_hef?: string;
};

const getBMICategory = (bmi: number) : string => {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal Weight";
    if (bmi < 30) return "Overweight";
    if (bmi < 35) return "Obese";
    return "Severely Obese";
}

export function PatientForm({ existingPatients, onSubmit, locationId }: PatientFormProps) {
    const token = useUserStore((state) => state.user?.token);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("patient-info");
    const [errors, setErrors] = useState<FormErrors>({});

    const [patientInfo, setPatientInfo] =  useState<PatientFormData>({
        face_id: "",
        english_name: "",
        khmer_name: "",
        date_of_birth: "",
        sex: "",
        phone_number: "",
        address: "",
        queue_no: "",
    });

    const [vitals, setVitals] = useState<Vitals>({
        height: "",
        weight: "",
        bmi: "",
        below_3rd_percentile: false,
        category: "",
        bp_systolic: "",
        bp_diastolic: "",
        temperature: "",
        notes: ""
    });

    const [hef, setHEF] = useState<HEF>({
        know_of_hef: "",
        has_hef: "",
        notes: ""
    })

    const clearFieldError = (field: keyof FormErrors) => {
      setErrors(prev => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };

    const calculateAge = () => {
        if (patientInfo.date_of_birth) {
            const today = new Date();
            const birthDate = new Date(patientInfo.date_of_birth);
            const age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
                ? age - 1 : age;
            
            setPatientInfo(prev => ({ ...prev, age: calculatedAge.toString() }));
        }
    };

    const calculateBMI = () => {
        const heightM = parseFloat(vitals.height) / 100; // Convert cm to m
        const weightKg = parseFloat(vitals.weight);
        
        if (heightM > 0 && weightKg > 0) {
          const bmiValue = weightKg / (heightM * heightM);
          const roundedBMI = Math.round(bmiValue * 10) / 10;
          
          setVitals(prev => ({
            ...prev,
            bmi: roundedBMI.toString(),
            category: getBMICategory(roundedBMI)
          }));
        }
      };

    const validateForm = (): boolean => {
      const nextErrors: FormErrors = {};
      const queueNo = patientInfo.queue_no?.trim() ?? "";
      const englishName = patientInfo.english_name?.trim() ?? "";
      const faceId = patientInfo.face_id?.trim() ?? "";
      const height = Number(vitals.height);
      const weight = Number(vitals.weight);
      const bmi = Number(vitals.bmi);
      const bpSystolic = Number(vitals.bp_systolic);
      const bpDiastolic = Number(vitals.bp_diastolic);
      const temperature = Number(vitals.temperature);

      if (!queueNo) nextErrors.queue_no = "Queue number is required.";
      if (!englishName) nextErrors.english_name = "English name is required.";
      if (!patientInfo.sex) nextErrors.sex = "Sex is required.";
      if (faceId && !/^\d+$/.test(faceId)) nextErrors.face_id = "Face ID must be a positive integer.";

      if (!Number.isFinite(height) || height <= 0) nextErrors.height = "Enter a valid height greater than 0.";
      if (!Number.isFinite(weight) || weight <= 0) nextErrors.weight = "Enter a valid weight greater than 0.";
      if (!Number.isFinite(bmi) || bmi <= 0) nextErrors.bmi = "BMI is required. Click Calculate after entering height and weight.";
      if (!Number.isInteger(bpSystolic) || bpSystolic <= 0) nextErrors.bp_systolic = "Systolic BP must be a positive whole number.";
      if (!Number.isInteger(bpDiastolic) || bpDiastolic <= 0) nextErrors.bp_diastolic = "Diastolic BP must be a positive whole number.";
      if (!Number.isFinite(temperature) || temperature <= 0) nextErrors.temperature = "Enter a valid temperature greater than 0.";

      if (!hef.know_of_hef) nextErrors.know_of_hef = "Please select Yes or No.";
      if (!hef.has_hef) nextErrors.has_hef = "Please select Yes or No.";

      setErrors(nextErrors);

      const patientInfoFields: (keyof FormErrors)[] = ["queue_no", "english_name", "sex", "face_id"];
      const vitalsFields: (keyof FormErrors)[] = ["height", "weight", "bmi", "bp_systolic", "bp_diastolic", "temperature"];
      const hefFields: (keyof FormErrors)[] = ["know_of_hef", "has_hef"];

      if (patientInfoFields.some((field) => nextErrors[field])) setActiveTab("patient-info");
      else if (vitalsFields.some((field) => nextErrors[field])) setActiveTab("vitals");
      else if (hefFields.some((field) => nextErrors[field])) setActiveTab("hef");

      return Object.keys(nextErrors).length === 0;
    };

    const checkExistingPatient = () => {
      // Use either English or Khmer name for search
      const name = patientInfo.english_name?.trim() || patientInfo.khmer_name?.trim();
      if (!name) return;

      const found = existingPatients.find((p) => {
        const engName = p.english_name?.toLowerCase() || "";
        const khmerName = p.khmer_name?.toLowerCase() || "";
        return engName.includes(name.toLowerCase()) || khmerName.includes(name.toLowerCase());
      });

      if (found) {
        setPatientInfo({
          face_id: found.face_id.toString(),
          english_name: found.english_name || "",
          khmer_name: found.khmer_name || "",
          date_of_birth: formatDate(found.date_of_birth) || "",
          sex: found.sex,
          address: found.address || "",
          phone_number: found.phone_number || "",
        });
        setErrors((prev) => ({
          ...prev,
          english_name: undefined,
          sex: undefined,
          face_id: undefined,
        }));
      } else {
        alert("No existing patient found with that name");
      }
    };

    const handleSubmit = async () => {
        if (!locationId || !token) {
          alert("Location not selected or user not authenticated.");
          return;
        }
        if (!validateForm()) return;

        setIsSubmitting(true);

        const completePatientInfo = { ...patientInfo, location_id: locationId };

        try {
          const newQueuedPatient = await createVisit(
            { patientInfo: completePatientInfo, vitals ,hef },
            token
          );

          // on success, call the onsubmit prop passed from the parent page
          onSubmit(newQueuedPatient);

          // Reset form states
          setPatientInfo({
            face_id: "",
            queue_no: "",
            english_name: "",
            khmer_name: "",
            date_of_birth: "",
            sex: "",
            phone_number: "",
            address: "",
            age: undefined,
          });
          setVitals({
            height: "",
            weight: "",
            bmi: "",
            below_3rd_percentile: false,
            category: "",
            bp_systolic: "",
            bp_diastolic: "",
            temperature: "",
            notes: ""
          });
          setHEF({
            know_of_hef: "",
            has_hef: "",
            notes: ""
          });
          setActiveTab("patient-info");
          setErrors({});
        } catch (error) {
          console.error("Submissio failed: ", error)
          alert(`Error: ${error instanceof Error ? error.message : "Could not add patient to queue."}`);
        } finally {
          setIsSubmitting(false);
        }

        
    };

    return (
      <PageCard
        title="Patient Registration"
        className="h-[800px] w-full flex flex-col"
        headerClassName="py-3"
        contentClassName="flex-1 flex flex-col overflow-hidden"
      >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 ">
            <TabsList className="grid w-full grid-cols-3 bg-muted/80">
              
              <TabsTrigger 
                value="patient-info" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ">
                  Patient Info
              </TabsTrigger>
              <TabsTrigger 
                value="vitals" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Vitals
              </TabsTrigger>
              <TabsTrigger
                 value="hef" 
                 className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  HEF
              </TabsTrigger>

            </TabsList>
            <div className="flex-1 w-full">
              <TabsContent value="patient-info" className="space-y-4 mt-6 h-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="queueNumber" className="text-muted-foreground">Queue Number *</Label>
                    <Input
                      id="queueNumber"
                      value={patientInfo.queue_no}
                      aria-invalid={!!errors.queue_no}
                      onChange={(e) => {
                        setPatientInfo(prev => ({ ...prev, queue_no: e.target.value }));
                        clearFieldError("queue_no");
                      }}
                      placeholder="e.g., 12A"
                      className="mt-2"
                      />
                    {errors.queue_no && <p className="mt-1 text-xs text-destructive">{errors.queue_no}</p>}
                  </div>
                  <div>
                    <Label htmlFor="sex" className="text-muted-foreground">Sex *</Label>
                    <Select 
                      value={patientInfo.sex} 
                      onValueChange={(value) => {
                        setPatientInfo(prev => ({ ...prev, sex: value as "M" | "F" }));
                        clearFieldError("sex");
                      }}
                    >
                      <SelectTrigger className="mt-2 w-full" aria-invalid={!!errors.sex}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="M" className="text-foreground hover:bg-accent">Male</SelectItem>
                        <SelectItem value="F" className="text-foreground hover:bg-accent">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.sex && <p className="mt-1 text-xs text-destructive">{errors.sex}</p>}
                  </div>
                </div>
    
                <div>
                  <Label htmlFor="englishName" className="text-muted-foreground">English Name *</Label>
                  <Input
                    id="englishName"
                    value={patientInfo.english_name}
                    aria-invalid={!!errors.english_name}
                    onChange={(e) => {
                      setPatientInfo(prev => ({ ...prev, english_name: e.target.value }));
                      clearFieldError("english_name");
                    }}
                    placeholder="Enter English name"
                    className="mt-2"
                  />
                  {errors.english_name && <p className="mt-1 text-xs text-destructive">{errors.english_name}</p>}
                </div>
    
                <div>
                  <Label htmlFor="khmerName" className="text-muted-foreground">Khmer Name</Label>
                  <Input
                    id="khmerName"
                    value={patientInfo.khmer_name}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, khmer_name: e.target.value }))}
                    placeholder="Enter Khmer name"
                    className="mt-2"
                  />
                </div>
    
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="dateOfBirth" className="text-muted-foreground">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={patientInfo.date_of_birth}
                      onChange={(e) => setPatientInfo(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="age" className="text-muted-foreground">Age</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="age"
                        type="number"
                        value={patientInfo.age || ""}
                        onChange={(e) => setPatientInfo(prev => ({ ...prev, age: e.target.value || "" }))}
                        placeholder="Age"
                        className=""
                      />
                      <Button 
                        type="button" 
                        onClick={calculateAge}
                        className={`${
                          patientInfo.date_of_birth 
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        Calculate
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber" className="text-muted-foreground">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      value={patientInfo.phone_number || ""}
                      onChange={(e) => setPatientInfo(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="Phone number"
                      className="mt-2"
                    />
                  </div>
                </div>
    
                <div>
                  <Label htmlFor="address" className="text-muted-foreground">Address</Label>
                  <Textarea
                    id="address"
                    value={patientInfo.address || ""}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter address"
                    className="mt-2"
                  />
                </div>
    
                <div>
                  <Label htmlFor="faceId" className="text-muted-foreground">Face ID</Label>
                  <Input
                    id="faceId"
                    value={patientInfo.face_id}
                    aria-invalid={!!errors.face_id}
                    onChange={(e) => {
                      setPatientInfo(prev => ({ ...prev, face_id: e.target.value || "" }));
                      clearFieldError("face_id");
                    }}
                    placeholder="Face ID"
                    className="mt-2"
                  />
                  {errors.face_id && <p className="mt-1 text-xs text-destructive">{errors.face_id}</p>}
                </div>
              </TabsContent>
    
              <TabsContent value="vitals" className="space-y-4 mt-6 h-full">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="height" className="text-muted-foreground">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.1"
                      value={vitals.height}
                      aria-invalid={!!errors.height}
                      onChange={(e) => {
                        setVitals(prev => ({ ...prev, height: e.target.value }));
                        clearFieldError("height");
                      }}
                      placeholder="Height in cm"
                      className="mt-2"
                    />
                    {errors.height && <p className="mt-1 text-xs text-destructive">{errors.height}</p>}
                  </div>
                  <div>
                    <Label htmlFor="weight" className="text-muted-foreground">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      value={vitals.weight}
                      aria-invalid={!!errors.weight}
                      onChange={(e) => {
                        setVitals(prev => ({ ...prev, weight: e.target.value }));
                        clearFieldError("weight");
                      }}
                      placeholder="Weight in kg"
                      className="mt-2"
                    />
                    {errors.weight && <p className="mt-1 text-xs text-destructive">{errors.weight}</p>}
                  </div>
                  <div>
                    <Label htmlFor="bmi" className="text-muted-foreground">BMI</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="bmi"
                        value={vitals.bmi}
                        aria-invalid={!!errors.bmi}
                        readOnly
                        placeholder="BMI"
                        className=""
                      />
                      <Button 
                        type="button" 
                        onClick={calculateBMI}
                        className={`${
                          vitals.height && vitals.weight 
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        Calculate
                      </Button>
                    </div>
                    {errors.bmi && <p className="mt-1 text-xs text-destructive">{errors.bmi}</p>}
                  </div>
                </div>
    
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="below3rd"
                    checked={vitals.below_3rd_percentile}
                    onCheckedChange={(checked) => setVitals(prev => ({ 
                      ...prev, 
                      below_3rd_percentile: checked as boolean 
                    }))}
                    className="border-border bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Label htmlFor="below3rd" className="text-muted-foreground">Child is below 3rd percentile (BMI by age)</Label>
                </div>
    
                <div>
                  <Label htmlFor="category" className="text-muted-foreground">Category</Label>
                  <Input
                    id="category"
                    value={vitals.category}
                    readOnly
                    placeholder="BMI category (auto-calculated)"
                    className="mt-2"
                  />
                </div>
    
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="systolic" className="text-muted-foreground">Blood Pressure - Systolic</Label>
                    <Input
                      id="systolic"
                      type="number"
                      value={vitals.bp_systolic}
                      aria-invalid={!!errors.bp_systolic}
                      onChange={(e) => {
                        setVitals(prev => ({ ...prev, bp_systolic: e.target.value }));
                        clearFieldError("bp_systolic");
                      }}
                      placeholder="Systolic"
                      className="mt-2"
                    />
                    {errors.bp_systolic && <p className="mt-1 text-xs text-destructive">{errors.bp_systolic}</p>}
                  </div>
                  <div>
                    <Label htmlFor="diastolic" className="text-muted-foreground">Blood Pressure - Diastolic</Label>
                    <Input
                      id="diastolic"
                      type="number"
                      value={vitals.bp_diastolic}
                      aria-invalid={!!errors.bp_diastolic}
                      onChange={(e) => {
                        setVitals(prev => ({ ...prev, bp_diastolic: e.target.value }));
                        clearFieldError("bp_diastolic");
                      }}
                      placeholder="Diastolic"
                      className="mt-2"
                    />
                    {errors.bp_diastolic && <p className="mt-1 text-xs text-destructive">{errors.bp_diastolic}</p>}
                  </div>
                </div>
    
                <div>
                  <Label htmlFor="temperature" className="text-muted-foreground">Temperature (°C)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={vitals.temperature}
                    aria-invalid={!!errors.temperature}
                    onChange={(e) => {
                      setVitals(prev => ({ ...prev, temperature: e.target.value }));
                      clearFieldError("temperature");
                    }}
                    placeholder="Temperature in Celsius"
                    className="mt-2"
                  />
                  {errors.temperature && <p className="mt-1 text-xs text-destructive">{errors.temperature}</p>}
                </div>
    
                <div>
                  <Label htmlFor="notes" className="text-muted-foreground">Additional Notes</Label>
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
                <div>
                  <Label className="text-muted-foreground block mb-4">Does patient know about HEF?</Label>
                  <RadioGroup 
                    value={hef.know_of_hef} 
                    onValueChange={(value) => {
                      setHEF(prev => ({ ...prev, know_of_hef: value as "yes" | "no" }));
                      clearFieldError("know_of_hef");
                    }}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="knows-yes" className="border-border text-primary bg-background" />
                      <Label htmlFor="knows-yes" className="text-muted-foreground">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="knows-no" className="border-border text-primary bg-background" />
                      <Label htmlFor="knows-no" className="text-muted-foreground">No</Label>
                    </div>
                  </RadioGroup>
                  {errors.know_of_hef && <p className="mt-2 text-xs text-destructive">{errors.know_of_hef}</p>}
                </div>
    
                <div>
                  <Label className="text-muted-foreground block mb-4">Does patient have HEF?</Label>
                  <RadioGroup 
                    value={hef.has_hef} 
                    onValueChange={(value) => {
                      setHEF(prev => ({ ...prev, has_hef: value as "yes" | "no" }));
                      clearFieldError("has_hef");
                    }}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="has-yes" className="border-border text-primary bg-background" />
                      <Label htmlFor="has-yes" className="text-muted-foreground">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="has-no" className="border-border text-primary bg-background" />
                      <Label htmlFor="has-no" className="text-muted-foreground">No</Label>
                    </div>
                  </RadioGroup>
                  {errors.has_hef && <p className="mt-2 text-xs text-destructive">{errors.has_hef}</p>}
                </div>
    
                <div>
                  <Label htmlFor="hefReason" className="text-muted-foreground block mb-3">Does patient use HEF? Why or Why not?</Label>
                  <Textarea
                    id="hefReason"
                    value={hef.notes}
                    onChange={(e) => setHEF(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Explain patient's HEF usage and reasoning"
                    className=""
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
  
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <Button 
              onClick={checkExistingPatient}
              variant="outline"
              className="px-6 bg-background border-input text-muted-foreground hover:bg-accent"
            >
              Check Existing
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="px-8"
            >
              {isSubmitting ? "Submitting..." : "Submit & Add to Queue"}
            </Button>
          </div>
      </PageCard>
    );



}