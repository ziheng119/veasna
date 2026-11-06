"use client";

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { PatientInfo } from '@/lib/types/patient';
import { PatientTableRow } from './PatientTableRow';
import { PersonIcon } from '@/assets/icons';
import { groupFamilies } from '@/lib/family';
import { DEFAULT_PATIENT_SORT, nextPatientSort, PatientSort, PatientSortKey, sortPatients } from '@/lib/patientSort';
import { cn } from '@/lib/utils';

interface PatientTableProps {
    patients: PatientInfo[];
    // Everyone on the list before searching, for finding family members; defaults to patients.
    allPatients?: PatientInfo[];
    onViewPatient?: (patientId: number) => void
    onDeletePatient?: (patientId: number) => void;
    // Called after a family changed, to reload the list.
    onFamilyChanged?: () => void | Promise<unknown>;
}

// Columns in display order; every one but Actions sorts the list.
const COLUMNS: { key: PatientSortKey; label: string; width?: string }[] = [
  { key: 'english_name', label: 'English Name' },
  { key: 'khmer_name', label: 'Khmer Name' },
  { key: 'date_of_birth', label: 'Date of Birth', width: 'w-[8.5%]' },
  { key: 'age', label: 'Age', width: 'w-[5%]' },
  { key: 'sex', label: 'Sex', width: 'w-[5%]' },
  { key: 'phone_number', label: 'Phone No.', width: 'w-[9.5%]' },
  { key: 'address', label: 'Address' },
  { key: 'face_id', label: 'Unique ID', width: 'w-[12%]' },
  { key: 'last_visit_date', label: 'Last Seen', width: 'w-[8.5%]' },
  { key: 'current_station', label: 'Current Station', width: 'w-[10%]' },
];

const HEADER_TEXT = 'uppercase text-left text-xs font-medium text-muted-foreground tracking-wider';

export function PatientTable({ patients, allPatients = patients, onViewPatient, onDeletePatient, onFamilyChanged }: PatientTableProps) {
    // Kept in this page only: sorting is instant and doesn't change anyone else's list.
    const [sort, setSort] = useState<PatientSort>(DEFAULT_PATIENT_SORT);
    // Members of the same family sit together, where the first of them falls in the chosen order.
    const rows = useMemo(
      () => groupFamilies(sortPatients(patients, sort), (patient) => patient.family),
      [patients, sort],
    );

    return (
      // Sized to its rows (no empty space under the last one), scrolling once it reaches the page bottom.
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden xl:flex xl:min-h-0 xl:flex-col">

        <div className="overflow-x-auto xl:min-h-0 xl:overflow-y-auto">
          <table className="w-full min-w-[1300px] table-fixed">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                {COLUMNS.map(({ key, label, width }, index) => {
                  const active = sort.key === key;
                  // Points the way the values grow: down for A to Z (ascending), up for Z to A.
                  const Arrow = sort.direction === 'asc' ? ArrowDown : ArrowUp;
                  return (
                    <th
                      key={key}
                      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn(width, 'py-1.5', index === 0 ? 'pl-4 pr-3' : 'px-3')}
                    >
                      <button
                        type="button"
                        onClick={() => setSort(nextPatientSort(sort, key))}
                        title={`Sort by ${label}`}
                        className={cn(
                          HEADER_TEXT,
                          'flex w-full cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 transition-colors duration-150',
                          'hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active && 'text-foreground',
                        )}
                      >
                        <span className="truncate">{label}</span>
                        {/* Space is kept for the arrow on every column, so headers don't shift when sorting. */}
                        <Arrow aria-hidden="true" className={cn('size-3.5 shrink-0 text-muted-foreground', !active && 'invisible')} />
                      </button>
                    </th>
                  );
                })}
                <th className={cn(HEADER_TEXT, 'w-32 py-3 pl-5 pr-6')}>Actions</th>
              </tr>
            </thead>

            <tbody className="bg-card divide-y divide-border">
              {rows.map((patient, index) => (
                <PatientTableRow
                  key={patient.id}
                  index={index}
                  patient={patient}
                  allPatients={allPatients}
                  onViewPatient={onViewPatient}
                  onDeletePatient={onDeletePatient}
                  onFamilyChanged={onFamilyChanged}
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
