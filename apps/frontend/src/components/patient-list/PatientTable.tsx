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
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-300">
              <tr>
                <th className="px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">English Name</th>
                <th className="px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Khmer Name</th>
                <th className="w-2/22 px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Date of Birth</th>
                <th className="w-1/20 px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Age</th>
                <th className="w-1/20 px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Sex</th>
                <th className="w-2/18 px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Phone No.</th>
                <th className="px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Address</th>
                <th className="w-1/20 px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Face ID</th>
                <th className="w-2/18 px-4 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Last Updated</th>
                <th className="w-22 py-3 uppercase text-left text-xs font-medium text-gray-900 tracking-wider">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
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
              <PersonIcon className="mx-auto h-16 w-16 text-gray-300"/>
              <h3 className="mt-4 text-lg font-mediu, text-gray-900">No Patients Found</h3>
              <p className="mt-2 text-gray-500">
                Try adjusting your search criteria or check your spelling.
              </p>
            </div>
          )}
        </div>
      </div>
    )
}

        