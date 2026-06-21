"use client";

import { useState, useRef, RefObject } from "react";
import { PopUpIcon } from "@/assets/icons/PopUpIcon";
import HistoryPopUp from "./HistoryPopUp";
import { QueuedPatient } from "@/lib/types/patient";

interface Props {
  patient: QueuedPatient;
}

export default function HistoryContainer({ patient }: Props) {
  const [showPopUp, setShowPopUp] = useState(false);

  // Position state
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Dragging state
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const popupRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true;
    dragStart.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging.current) return;
    setPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const onMouseUp = () => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  return (
    <>
      <div className="flex justify-between">
        <h2 className="text-[20px] font-semibold">Patient History</h2>
        <div
          className="flex items-center justify-center hover:cursor-pointer"
          onClick={() => setShowPopUp(true)}
        >
          <PopUpIcon width={20} height={20} />
        </div>
      </div>

      {showPopUp && 
        <HistoryPopUp 
          setShowPopUp={setShowPopUp}
          popupRef={popupRef as RefObject<HTMLDivElement>}
          pos={pos}
          onMouseDown={onMouseDown}
          patient={patient}
        />
      }
    </>
  );
}
