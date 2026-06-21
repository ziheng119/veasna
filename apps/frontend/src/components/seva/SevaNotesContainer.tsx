"use client"

import { useEffect, useState } from "react"
import SaveButton from "../shared/SaveButton"
import VerticalLabelInputPair from "../shared/VerticalLabelInputPair"
import toast from "react-hot-toast"
import { Seva } from "@/lib/types/seva"
import { QueuedPatient } from "@/lib/types/patient"
import { getSeva } from "@/lib/api/visit/seva/getSeva"
import { postSeva } from "@/lib/api/visit/seva/postSeva"
import formatDate from "@/helper/format_date"

interface Props {
    patient: QueuedPatient;
}

export default function SevaNotesContainer({ patient }: Props) {
    const [leftWithPinholeNew, setLeftWithPinholeNew] = useState<string>("");
    const [rightWithPinholeNew, setRightWithPinholeNew] = useState<string>("");
    const [leftWithoutPinholeNew, setLeftWithoutPinholeNew] = useState<string>("");
    const [rightWithoutPinholeNew, setRightWithoutPinholeNew] = useState<string>("");
    const [diagnosis, setDiagnosis] = useState<string>("");
    const [dateOfReferral, setDateOfReferral] = useState<string>("");
    const [additionalNotes, setAdditionalNotes] = useState<string>("");

    const loadData = async () => {
    try {
        const data: Seva | null = await getSeva(patient.visit_id);

        if (!data) {
            toast("No data loaded")
            return;
        }

        setLeftWithPinholeNew(data.leftWithPinholeNew);
        setLeftWithoutPinholeNew(data.leftWithoutPinholeNew);
        setRightWithPinholeNew(data.rightWithPinholeNew);
        setRightWithoutPinholeNew(data.rightWithoutPinholeNew);
        setDiagnosis(data.diagnosis);
        setDateOfReferral(formatDate(data.dateOfReferral));
        setAdditionalNotes(data.notes ?? "");

        toast.success("Load success")

    } catch (error) {
        toast.error("Failed to load SEVA data");
        console.error("Error loading SEVA:", error);
    }
    };

    const handleSave = async () => {
        const data: Seva = {
            leftWithPinholeNew: leftWithPinholeNew,
            leftWithoutPinholeNew: leftWithoutPinholeNew,
            rightWithPinholeNew: rightWithPinholeNew,
            rightWithoutPinholeNew: rightWithoutPinholeNew,
            diagnosis: diagnosis,
            dateOfReferral: dateOfReferral,
            notes: additionalNotes
        }
        
        try {
            const res = await postSeva(data, patient.visit_id)
            setLeftWithPinholeNew("");
            setLeftWithoutPinholeNew("");
            setRightWithPinholeNew("");
            setRightWithoutPinholeNew("");
            setDiagnosis("");
            setDateOfReferral("");
            setAdditionalNotes("");
            toast.success("Save Success")
        } catch (error) {
            toast.error("An error as occured")
        }
    }

    useEffect(() => {
        loadData();
    }, [])
 
    return (
        <div className="flex flex-col gap-4 bg-beige-default px-4 py-2 rounded-md border-[1px] lg:w-[30%]">

            <h2 className="text-[20px] font-semibold">New Snellen&apos;s Test</h2>
            <div className="min-h-70 flex flex-col">
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-[30px] items-center">
                    {/* Header Row */}
                    <p className="font-semibold text-start">Visual Acuity</p>
                    <p className="text-center">Left (OS)</p>
                    <p className="text-center">Right (OD)</p>

                    {/* With Pinhole Row */}
                    <p className="text-start">With Pinhole</p>
                    <input 
                        className="bg-white-default border-[1px] block rounded-sm p-0.5"
                        onChange={e => setLeftWithPinholeNew(e.target.value)}
                        value={leftWithPinholeNew}
                    ></input>
                    <input 
                        className="bg-white-default border-[1px] block rounded-sm p-0.5"
                        onChange={e => setRightWithPinholeNew(e.target.value)}
                        value={rightWithPinholeNew}
                    ></input>
                    

                    {/* Without Pinhole Row */}
                    <p className="text-start" >Without Pinhole</p>
                    <input 
                        className="bg-white-default border-[1px] block rounded-sm p-0.5"
                        onChange={e => setLeftWithoutPinholeNew(e.target.value)}
                        value={leftWithoutPinholeNew}
                    ></input>
                    <input 
                        className="bg-white-default border-[1px] block rounded-sm p-0.5"
                        onChange={e => setRightWithoutPinholeNew(e.target.value)}
                        value={rightWithoutPinholeNew}
                    ></input>
                </div>

                <VerticalLabelInputPair 
                    label="Diagnosis"
                    onChangeFunction={setDiagnosis}
                    value={diagnosis}
                />

            </div>

        <div className="flex flex-col gap-2 w-full">
            <h2 className="text-[15px] font-semibold">Date of Referral</h2>
            <input
            type="date"
            placeholder="DD/MM/YYYY"
            className="bg-white border-[1px] rounded-sm p-2 w-32 text-black"
            onChange={(e) => setDateOfReferral(e.target.value)}
            value={dateOfReferral}
            />
        </div>

            <div className="flex w-full h-[40%]">
                <VerticalLabelInputPair 
                    label="Additional Notes"
                    onChangeFunction={setAdditionalNotes}
                    value={additionalNotes}
                />
            </div>


            <div className="flex items-center justify-end">
                <SaveButton 
                    onClick={handleSave}
                />
            </div>
        </div>
    


    )
}