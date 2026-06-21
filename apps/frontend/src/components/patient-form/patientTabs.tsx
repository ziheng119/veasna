"use client";

import { PatientListTab, PATIENTINFO_TAB, VITALS_TAB, HEF_TAB } from '@/models/patient-list/patientlist_tab';
import Tab from '@/components/shared/Tab';
import PatientInfo from './PatientInfo';
import Vitals from './Vitals';
import HEF from './HEF';
import { useState, useEffect } from 'react';
import SaveButton from '@/components/shared/SaveButton';
import { PatientFormData } from '@/lib/types/patient';

interface Props {
    patient: PatientFormData;
    onUpdatePatient: (updates: Partial<PatientFormData>) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving?: boolean;
    mode: string;
}

export default function PatientTabs({ patient, onUpdatePatient, onSave, onCancel, isSaving, mode }: Props) {

    const [activeTab, setActiveTab] = useState<PatientListTab>(PATIENTINFO_TAB);

    const applyTab = (activeTab: PatientListTab) => {
        switch (activeTab) {
            case PATIENTINFO_TAB:
                return <PatientInfo 
                            patient={patient} 
                            onUpdatePatient={onUpdatePatient}
                            isViewMode={mode === 'view'}
                        />
            case VITALS_TAB:
                return <Vitals 
                            patient={patient} 
                            onUpdatePatient={onUpdatePatient} 
                            isViewMode={mode === 'view'}
                        />
            case HEF_TAB:
                return <HEF 
                            patient={patient} 
                            onUpdatePatient={onUpdatePatient} 
                            isViewMode={mode === 'view'}
                        />
            default:
                return <PatientInfo 
                            patient={patient} 
                            onUpdatePatient={onUpdatePatient} 
                            isViewMode={mode === 'view'}
                        />
        }
    }

    useEffect(() => {
        applyTab(activeTab)
    }, [activeTab])


    // Allow users to cancel by simply clicking escape key
    useEffect(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };

        document.addEventListener('keydown', handleKeydown);
        
        return () => {
            document.removeEventListener('keydown', handleKeydown);
        };
    }, [onCancel]);

    return (
        <div>
            <div className='flex'>
                <Tab
                    label="Patient Info"
                    isActive={activeTab === PATIENTINFO_TAB}
                    onClick={() => setActiveTab(PATIENTINFO_TAB)}
                />
                <Tab
                    label="Vitals"
                    isActive={activeTab === VITALS_TAB}
                    onClick={() => setActiveTab(VITALS_TAB)}
                />
                <Tab
                    label="HEF"
                    isActive={activeTab === HEF_TAB}
                    onClick={() => setActiveTab(HEF_TAB)}
                />
            </div>

            <div className='bg-beige-default p-7'>
                {applyTab(activeTab)}
            </div>

            <div className='flex bg-beige-default justify-end space-x-3 py-6 px-6 pb-4'>
                <button
                    onClick={onCancel}
                    className='px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300'
                >
                    Cancel
                </button>
                
                {mode !== 'view' && (
                    <SaveButton
                    onClick={onSave}
                    mode={mode}
                />
                )}
                
            </div>
        </div>
    )
}
