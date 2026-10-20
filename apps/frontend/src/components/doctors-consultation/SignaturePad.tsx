"use client";

import { useRef } from "react";
import { Signature } from "@/lib/types/consultation";
import GlassButton from "../shared/GlassButton";

export function SignatureImage({ value }: { value: Signature }) {
  return <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="Handwritten signature" className="h-full w-full">
    {value.map((stroke, index) => <polyline key={index} points={stroke.map(([x, y]) => `${x * 600},${y * 180}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}

export default function SignaturePad({ value, onChange, disabled = false }: { value: Signature | null; onChange: (value: Signature | null) => void; disabled?: boolean }) {
  const drawing = useRef<Signature | null>(null);
  const pointCount = useRef(0);
  return <div className="space-y-2">
    <p className="font-medium">Your eSignature</p>
    <p className="text-sm text-muted-foreground">Draw with a mouse, stylus, or finger. Saved with this referral.</p>
    <div
      aria-label="Draw your signature"
      className="h-40 touch-none overflow-hidden rounded-lg border bg-white text-black"
      onPointerDown={event => {
        if (disabled || !event.isPrimary || event.button !== 0) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const point: [number, number] = [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height];
        const strokes = value ?? [];
        pointCount.current = strokes.reduce((sum, stroke) => sum + stroke.length, 0);
        if (strokes.length >= 100 || pointCount.current >= 1998) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drawing.current = [...strokes, [point, point]];
        pointCount.current += 2;
        onChange(drawing.current);
      }}
      onPointerMove={event => {
        if (disabled || !event.isPrimary || !drawing.current || pointCount.current >= 2000) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const point: [number, number] = [
          Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
          Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
        ];
        const strokes = drawing.current;
        drawing.current = [...strokes.slice(0, -1), [...strokes[strokes.length - 1], point]];
        pointCount.current++;
        onChange(drawing.current);
      }}
      onPointerUp={() => { drawing.current = null; }}
      onPointerCancel={() => { drawing.current = null; }}
      onLostPointerCapture={() => { drawing.current = null; }}
    >
      {value && <SignatureImage value={value} />}
    </div>
    <GlassButton type="button" disabled={disabled} onClick={() => { drawing.current = null; onChange(null); }}>Clear signature</GlassButton>
  </div>;
}
