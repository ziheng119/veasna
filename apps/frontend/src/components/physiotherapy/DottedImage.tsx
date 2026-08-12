import { PainPoint } from "@/lib/types/physiotherapy";
import React, { useState, useEffect } from "react";

type Props = {
  imageUrl: string;
  onClickFunction: (positions: PainPoint[]) => void;
  positions?: PainPoint[] | undefined;
};

export default function DottedImage({ imageUrl, positions: initialPositions, onClickFunction }: Props) {
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
    onClickFunction(updated);
  };

  const handleRemoveDot = (indexToRemove: number) => {
    const updated = clickPositions.filter((_, i) => i !== indexToRemove);
    setClickPositions(updated);
    onClickFunction(updated);
  };

  const handleClearAll = () => {
    setClickPositions([]);
    onClickFunction([]);
  };

  return (
    <div className="max-w-[600px] w-full">
      <div className="flex items-end justify-end">
        <button
          onClick={handleClearAll}
          className="rounded-md p-2 hover:cursor-pointer text-sm"
        >
          Clear All
        </button>
      </div>
      <div
        onClick={handleClick}
        className="relative inline-block cursor-crosshair w-full"
      >
        <img
          src={imageUrl}
          alt="Clickable"
          className="block w-full h-auto items-center"
        />

        {clickPositions.map((pos, index) => (
          <div
            key={index}
            data-dot="true"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveDot(index);
            }}
            className="absolute w-2.5 h-2.5 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer border-2 border-white box-border"
            style={{
              left: `${pos.xCoord}%`,
              top: `${pos.yCoord}%`,
            }}
            title="Click to remove this dot"
          />
        ))}
      </div>
    </div>
  );
}
