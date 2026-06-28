"use client"

import VerticalLabelInputPair from '../shared/VerticalLabelInputPair'
import SaveButton from '../shared/SaveButton'
import DottedImage from './DottedImage'
import { useEffect, useState } from 'react'
import { PainPoint, Physiotherapy } from '@/lib/types/physiotherapy'
import { getPhysiotherapy } from '@/lib/api/visit/physiotherapy/getPhysiotherapy'
import { QueuedPatient } from '@/lib/types/patient'
import toast from 'react-hot-toast'
import { postPhysiotherapy } from '@/lib/api/visit/physiotherapy/postPhysiotherapy'
import { PageCard } from '../shared/PageCard'

interface Props {
  patient: QueuedPatient
}

export default function PhysiotherapyNotesContainer({ patient }: Props) {

  const [notes, setNotes] = useState<string>("");
  const [painpoints, setPainpoints] = useState<PainPoint[]>([]);

  const loadData = async () => {
    try {
      const data: Physiotherapy | null = await getPhysiotherapy(patient.visit_id);

      if (!data) {
          setNotes("");
          setPainpoints([]);
          toast("No data loaded")
          return;
      }

      setNotes(data.notes? data.notes : "");
      setPainpoints(data.painpoints);

      toast.success("Load success")

    } catch (error) {
      toast.error("Failed to load Physiotherapy data");
      console.error("Error loading Physiotherapy:", error);
    }
  };

  const handleSave = async () => {
    try {
      const data: Physiotherapy = {
        notes: notes,
        painpoints: painpoints,
      }

      const res = await postPhysiotherapy(data, patient.visit_id)
      setNotes("")
      setPainpoints([])
      toast.success("Save Success")
    } catch (error) {
        toast.error("An error as occured")
    }
  }

  useEffect(() => {
    loadData();
  }, [patient.visit_id])

  return (
    <PageCard
      title="Physiotherapy Notes"
      className="xl:col-span-4"
      contentClassName="space-y-4"
    >
      <div className="flex w-full h-[40%]">
        <VerticalLabelInputPair 
          onChangeFunction={setNotes}
          value={notes}
        />
      </div>

      <div>
        <h2 className="text-[20px] font-semibold">Body Chart Indication</h2>
        <div className="flex flex-row w-full">
          <DottedImage 
            imageUrl="/bodychart.jpg"
            onClickFunction={setPainpoints}
            positions={painpoints}
          />
        </div>
      </div>

      <div className="flex items-center justify-end">
        <SaveButton 
          onClick={handleSave}
        />
      </div>
    </PageCard>
  )
}
