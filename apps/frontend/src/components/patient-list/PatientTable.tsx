import React from 'react';
// import { EditIcon, PlusIcon, TrashIcon } from '../../assets/icons';
import { PatientInfo } from '@/lib/types/patient';
import { PatientTableRow } from './PatientTableRow';
import { PersonIcon } from '@/assets/icons';

interface PatientTableProps {
    patients: PatientInfo[];
    onViewPatient?: (patientId: number) => void
    onDeletePatient?: (patientId: number) => void;
}

export function PatientTable({ patients, onViewPatient, onDeletePatient}: PatientTableProps) {
  
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">English Name</th>
                <th className="px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Khmer Name</th>
                <th className="w-2/22 px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Date of Birth</th>
                <th className="w-1/20 px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Age</th>
                <th className="w-1/20 px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Sex</th>
                <th className="w-2/18 px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Phone No.</th>
                <th className="px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Address</th>
                <th className="w-1/20 px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Face ID</th>
                <th className="w-2/18 px-4 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Last Updated</th>
                <th className="w-22 py-3 uppercase text-left text-xs font-medium text-muted-foreground tracking-wider">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-card divide-y divide-border">
              {patients
                .map((patient)=> (
                <PatientTableRow
                  key={patient.id}
                  patient={patient}
                  onViewPatient={onViewPatient}
                  onDeletePatient={onDeletePatient}
                />
              ))}
            </tbody>
          </table>

          {patients.length === 0 && (
            <div className="text-center py-12">
              <PersonIcon className="mx-auto h-16 w-16 text-muted-foreground/50"/>
              <h3 className="mt-4 text-lg font-medium text-foreground">No Patients Found</h3>
              <p className="mt-2 text-muted-foreground">
                Try adjusting your search criteria or check your spelling.
              </p>
            </div>
          )}
        </div>
      </div>
    )
}

        