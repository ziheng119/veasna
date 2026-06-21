"use client"

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { PatientInfo } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";
import { ArrowLeftIcon, SearchIcon, CalendarIcon } from "lucide-react";
import { EditIcon, PersonIcon } from "@/assets/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPatient } from "@/lib/api/patient/getPatients";
import { getVisit } from "@/lib/api/visit/getVisit";
import { updatePatient } from "@/lib/api/patient/updatePatient";
import formatDate from "@/helper/format_date";

interface Visit {
  visit_id: number;
  queue_no: string;
  visit_date: string;
  location_name: string;
  last_updated_at: string;
  has_vitals: boolean;
  has_presenting_complaint: boolean;
  has_seva: boolean;
  has_physiotherapy: boolean;
  has_consultation: boolean;
}

interface VisitDetails {
  visit_id: number;
  queue_no: string;
  visit_date: string;
  location_name: string;
  vitals?: any;
  hef?: any;
  visual_acuity?: any;
  presenting_complaint?: any;
  history?: any;
  seva?: any;
  physiotherapy?: any;
  consultation?: any;
}

interface PatientData {
  patient: PatientInfo;
  visits: Visit[];
}

const DataField = ({ label, value }: { label: string; value: any }) => (
  <div>
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="mt-1">{value || 'N/A'}</p>
  </div>
);

export default function PatientDetailsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = Number(searchParams.get('id'));
  const token = useUserStore((state) => state.user?.token);

  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [visitDetails, setVisitDetails] = useState<VisitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVisit, setIsLoadingVisit] = useState(false);
  const [dateSearch, setDateSearch] = useState("");
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedPatient, setEditedPatient] = useState<PatientInfo | null>(null);

  useEffect(() => {
    if (patientId && token) {
      setIsLoading(true);
      getPatient(patientId, token)
        .then(data => {
          if (data) {
            setPatientData(data);
            setEditedPatient(data.patient);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [patientId, token]);

  const filteredVisits = useMemo(() => {
    if (!patientData?.visits) return [];
    if (!dateSearch.trim()) return patientData.visits;

    return patientData.visits.filter(visit => {
      const visitDate = visit.visit_date;
      return visitDate.includes(dateSearch);
    });
  }, [patientData?.visits, dateSearch]);

  const handleVisitClick = async (visit: Visit) => {
    if (!token) return;
    
    setSelectedVisit(visit);
    setIsLoadingVisit(true);
    
    try {
      const details = await getVisit(visit.visit_id, token);
      setVisitDetails(details);
    } catch (error) {
      console.error('Error fetching visit details:', error);
    } finally {
      setIsLoadingVisit(false);
    }
  };

  const handleBackToVisitList = () => {
    setSelectedVisit(null);
    setVisitDetails(null);
  };

  const handleBack = () => {
    router.push('/patient-list');
  };

  const handleEditToggle = async () => {
    if (isEditing && editedPatient && token) {
      console.log('Saving patient data:', editedPatient);
      
      const result = await updatePatient(patientId, editedPatient, token);
      
      if (result.success) {
        if (patientData) {
          setPatientData({ ...patientData, patient: result.data.patient });
        }
        console.log('Patient updated successfully');
      } else {
        console.error('Failed to update patient:', result.error);
        alert(`Failed to update patient: ${result.error}`);
        setEditedPatient(patientData?.patient || null);
      }
    }
    setIsEditing(!isEditing);
  };

  const handleCancel = () => {
    setEditedPatient(patientData?.patient || null);
    setIsEditing(false);
  };

  const handleInputChange = (field: keyof PatientInfo, value: string) => {
    if (editedPatient) {
      setEditedPatient({
        ...editedPatient,
        [field]: value
      });
    }
  };

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const dob = new Date(birthDate);
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    return monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())
      ? age - 1 : age;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading patient details...</div>;
  }
  
  if (!patientData) {
    return <div className="flex items-center justify-center h-screen">Patient not found.</div>;
  }

  const { patient, visits } = patientData;
  const displayPatient = isEditing ? editedPatient : patient;

  return (
    <div className="w-full mx-auto p-6 max-w-[1800px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Patient List
        </Button>
        
        <div className="flex items-center gap-2">
          {isEditing && (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleEditToggle}
            className="text-white">
            <EditIcon className="w-4 h-4 mr-2 text-white"/>
            {isEditing ? 'Save Changes' : 'Edit Patient'}
          </Button>
        </div>
      </div>

      {/* Main Layout: Patient Info (Left 1/3) + Visits/Details (Right 2/3) */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Side: Patient Information */}
        <div className="col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <PersonIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <CardTitle className="text-xl">
                    {displayPatient?.english_name || 'N/A'}
                  </CardTitle>
                  <CardDescription>
                    {displayPatient?.khmer_name || 'N/A'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">English Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedPatient?.english_name || ''}
                      onChange={(e) => handleInputChange('english_name', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1">{patient.english_name || 'N/A'}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Khmer Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedPatient?.khmer_name || ''}
                      onChange={(e) => handleInputChange('khmer_name', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1">{patient.khmer_name || 'N/A'}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedPatient?.date_of_birth || ''}
                      onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1">{formatDate(patient.date_of_birth)}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Age</label>
                  <p className="mt-1">
                    {calculateAge(displayPatient?.date_of_birth || '')} years
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Sex</label>
                  {isEditing ? (
                    <select
                      value={editedPatient?.sex || ''}
                      onChange={(e) => handleInputChange('sex', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  ) : (
                    <p className="mt-1">{patient.sex === 'M' ? 'Male' : 'Female'}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedPatient?.phone_number || ''}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1">{patient.phone_number || 'N/A'}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Face ID</label>
                  <p className="mt-1">{patient.face_id || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="mt-1 text-sm">
                    {patient.lastUpdated ? new Date(patient.lastUpdated).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <label className="text-sm font-medium text-gray-500">Address</label>
                {isEditing ? (
                  <textarea
                    value={editedPatient?.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    rows={2}
                  />
                ) : (
                  <p className="mt-1">{patient.address || 'N/A'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Visits List OR Visit Details */}
        <div className="col-span-2">
          {!selectedVisit ? (
            /* Visit List View */
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Visit History</CardTitle>
                    <CardDescription>{visits.length} total visits</CardDescription>
                  </div>
                </div>
                {/* Search Bar */}
                <div className="relative mt-4">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    placeholder="Search by date..."
                    value={dateSearch}
                    onChange={(e) => setDateSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto">
                  {filteredVisits.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      {dateSearch ? 'No visits found for this date' : 'No visits recorded'}
                    </p>
                  ) : (
                    filteredVisits.map((visit) => (
                      <div
                        key={visit.visit_id}
                        onClick={() => handleVisitClick(visit)}
                        className="p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md hover:border-blue-300 bg-white"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CalendarIcon className="h-5 w-5 text-blue-600" />
                              <span className="font-bold text-lg text-gray-900">
                                {formatDate(visit.visit_date)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 ml-7">
                              Queue: <span className="font-medium">{visit.queue_no}</span> • {visit.location_name}
                            </div>
                            <div className="flex gap-2 mt-3 ml-7 flex-wrap">
                              {visit.has_vitals && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                                  Triage
                                </span>
                              )}
                              {visit.has_seva && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                                  Seva
                                </span>
                              )}
                              {visit.has_physiotherapy && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
                                  Physiotherapy
                                </span>
                              )}
                              {visit.has_consultation && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                                  Consultation
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">
                            Updated: {new Date(visit.last_updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Visit Details View */
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToVisitList}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to Visits
                  </Button>
                </div>
                <div className="mt-2">
                  <CardTitle className="text-2xl">{formatDate(selectedVisit.visit_date)}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    Queue {selectedVisit.queue_no} • {selectedVisit.location_name}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingVisit ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-gray-500">Loading visit details...</p>
                  </div>
                ) : visitDetails ? (
                  <Tabs defaultValue="triage" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger 
                        value="triage" 
                        disabled={!visitDetails.vitals && !visitDetails.presenting_complaint}
                      >
                        Triage
                      </TabsTrigger>
                      <TabsTrigger value="seva" disabled={!visitDetails.seva}>
                        Seva
                      </TabsTrigger>
                      <TabsTrigger value="physio" disabled={!visitDetails.physiotherapy}>
                        Physiotherapy
                      </TabsTrigger>
                      <TabsTrigger value="consult" disabled={!visitDetails.consultation}>
                        Consultation
                      </TabsTrigger>
                    </TabsList>

                    {/* Triage Tab */}
                    <TabsContent value="triage" className="space-y-6 max-h-[calc(100vh-400px)] overflow-y-auto">
                      {visitDetails.vitals && (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-lg border-b pb-2">Vitals</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <DataField label="Height (cm)" value={visitDetails.vitals.height} />
                            <DataField label="Weight (kg)" value={visitDetails.vitals.weight} />
                            <DataField label="BMI" value={visitDetails.vitals.bmi} />
                            <DataField 
                              label="Below 3rd Percentile" 
                              value={visitDetails.vitals.below_3rd_percentile ? 'Yes' : 'No'} 
                            />
                            <DataField 
                              label="Blood Pressure" 
                              value={`${visitDetails.vitals.bp_systolic}/${visitDetails.vitals.bp_diastolic}`} 
                            />
                            <DataField label="Temperature (°C)" value={visitDetails.vitals.temperature} />
                          </div>
                          {visitDetails.vitals.notes && (
                            <DataField label="Notes" value={visitDetails.vitals.notes} />
                          )}
                        </div>
                      )}

                      {visitDetails.presenting_complaint && (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-lg border-b pb-2">Presenting Complaint</h4>
                          <DataField label="History" value={visitDetails.presenting_complaint.history} />
                          <DataField label="Red Flags" value={visitDetails.presenting_complaint.red_flags} />
                          <DataField label="Systems Review" value={visitDetails.presenting_complaint.systems_review} />
                          <DataField label="Drug Allergies" value={visitDetails.presenting_complaint.drug_allergies} />
                        </div>
                      )}

                      {!visitDetails.vitals && !visitDetails.presenting_complaint && (
                        <p className="text-center text-gray-500 py-8">No triage data available</p>
                      )}
                    </TabsContent>

                    {/* Seva Tab */}
                    <TabsContent value="seva" className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                      {visitDetails.seva ? (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-lg border-b pb-2">SEVA Assessment</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <DataField label="Left (with pinhole)" value={visitDetails.seva.left_with_pinhole_new} />
                            <DataField label="Left (without pinhole)" value={visitDetails.seva.left_without_pinhole_new} />
                            <DataField label="Right (with pinhole)" value={visitDetails.seva.right_with_pinhole_new} />
                            <DataField label="Right (without pinhole)" value={visitDetails.seva.right_without_pinhole_new} />
                          </div>
                          <DataField label="Diagnosis" value={visitDetails.seva.diagnosis} />
                          <DataField label="Date of Referral" value={formatDate(visitDetails.seva.date_of_referral)} />
                          {visitDetails.seva.notes && (
                            <DataField label="Notes" value={visitDetails.seva.notes} />
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">No SEVA data available</p>
                      )}
                    </TabsContent>

                    {/* Physiotherapy Tab */}
                    <TabsContent value="physio" className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                      {visitDetails.physiotherapy ? (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-lg border-b pb-2">Physiotherapy</h4>
                          <DataField label="Notes" value={visitDetails.physiotherapy.notes} />
                          
                          {visitDetails.physiotherapy.painpoints?.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-500 mb-3">Pain Points</p>
                              <div className="space-y-2">
                                {visitDetails.physiotherapy.painpoints.map((point: any, index: number) => (
                                  <div key={point.id} className="bg-gray-50 p-3 rounded-md border">
                                    <p className="text-sm">
                                      <span className="font-medium">Point {index + 1}:</span> X: {point.x_coord.toFixed(2)}, Y: {point.y_coord.toFixed(2)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">No physiotherapy data available</p>
                      )}
                    </TabsContent>

                    {/* Consultation Tab */}
                    <TabsContent value="consult" className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                      {visitDetails.consultation ? (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-lg border-b pb-2">Consultation</h4>
                          <DataField label="Notes" value={visitDetails.consultation.notes} />
                          <DataField label="Prescription" value={visitDetails.consultation.prescription} />
                          <DataField 
                            label="Requires Referral" 
                            value={visitDetails.consultation.require_referral ? 'Yes' : 'No'} 
                          />
                          
                          {visitDetails.consultation.require_referral && visitDetails.consultation.referrals?.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-500 mb-3">Referrals</p>
                              <div className="space-y-3">
                                {visitDetails.consultation.referrals.map((referral: any) => (
                                  <div key={referral.id} className="bg-blue-50 p-4 rounded-md border border-blue-200">
                                    <div className="grid grid-cols-2 gap-3">
                                      <DataField label="Referral Date" value={formatDate(referral.referral_date)} />
                                      <DataField label="Type" value={referral.referral_type} />
                                      <DataField label="Illness" value={referral.illness} />
                                      <DataField label="Duration" value={referral.duration} />
                                      <DataField label="Doctor Name" value={referral.doctor_name} />
                                      <div className="col-span-2">
                                        <DataField label="Reason" value={referral.reason} />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">No consultation data available</p>
                      )}
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-gray-500">Failed to load visit details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}