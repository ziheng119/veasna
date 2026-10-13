import { PainPoint } from "@/lib/types/physiotherapy";
import React, { useState, useEffect } from "react";

type Props = {
  imageUrl: string;
  onClickFunction?: (positions: PainPoint[]) => void;
  positions?: PainPoint[] | undefined;
  // Shows the marked points without allowing them to be added or removed.
  readOnly?: boolean;
};

export default function DottedImage({ imageUrl, positions: initialPositions, onClickFunction, readOnly = false }: Props) {
  const [clickPositions, setClickPositions] = useState<PainPoint[]>([]);

  useEffect(() => {
    if (!initialPositions) return;

    const areEqual =
      initialPositions.length === clickPositions.length &&
      initialPositions.every((p, i) =>
        p.xCoord === clickPositions[i]?.xCoord &&
        p.yCoord === clickPositions[i]?.yCoord
      );

    if (!areEqual) {
      setClickPositions(initialPositions);
    }
  }, [initialPositions]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.dot) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPos: PainPoint = { xCoord: x, yCoord: y };
    const updated = [...clickPositions, newPos];
    setClickPositions(updated);
    onClickFunction?.(updated);
  };

  const handleRemoveDot = (indexToRemove: number) => {
    const updated = clickPositions.filter((_, i) => i !== indexToRemove);
    setClickPositions(updated);
    onClickFunction?.(updated);
  };

  const handleClearAll = () => {
    setClickPositions([]);
    onClickFunction?.([]);
  };

  return (
    <div className="max-w-[600px] w-full">
      {!readOnly && (
        <div className="flex items-end justify-end">
          <button
            onClick={handleClearAll}
            className="rounded-md p-2 hover:cursor-pointer text-sm"
          >
            Clear All
          </button>
        </div>
      )}
      <div
        onClick={readOnly ? undefined : handleClick}
        className={`relative inline-block w-full ${readOnly ? "" : "cursor-crosshair"}`}
      >
        <img
          src={imageUrl}
          alt="Body chart"
          className="block w-full h-auto items-center"
        />

        {clickPositions.map((pos, index) => (
          <div
            key={index}
            data-dot="true"
            onClick={readOnly ? undefined : (e) => {
              e.stopPropagation();
              handleRemoveDot(index);
            }}
            className={`absolute w-2.5 h-2.5 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-white box-border ${readOnly ? "" : "cursor-pointer"}`}
            style={{
              left: `${pos.xCoord}%`,
              top: `${pos.yCoord}%`,
            }}
            title={readOnly ? undefined : "Click to remove this dot"}
          />
        ))}
      </div>
    </div>
  );
}
