"use client";

import { useRef, useState } from "react";
import { BookmarkCheck, Upload } from "lucide-react";
import { isSignatureUpload, Signature, SignatureStrokes } from "@/lib/types/consultation";
import { readSignatureFile, SIGNATURE_FILE_TYPES } from "@/lib/signatureUpload";
import GlassButton from "../shared/GlassButton";

export function SignatureImage({ value }: { value: Signature }) {
  if (isSignatureUpload(value)) {
    // eslint-disable-next-line @next/next/no-img-element -- a data URL, also used in the print window
    return <img src={value.image} alt="Signature" className="h-full w-full object-contain" style={{ objectFit: "contain", width: "100%", height: "100%" }} />;
  }
  return <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="Handwritten signature" className="h-full w-full">
    {value.map((stroke, index) => <polyline key={index} points={stroke.map(([x, y]) => `${x * 600},${y * 180}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}

interface Props {
  value: Signature | null;
  onChange: (value: Signature | null) => void;
  disabled?: boolean;
  // "Save signature" keeps the current signature for this user's next referrals this session.
  saved?: boolean;
  onSave?: (value: Signature) => void;
  onForget?: () => void;
}

export default function SignaturePad({ value, onChange, disabled = false, saved = false, onSave, onForget }: Props) {
  const drawing = useRef<SignatureStrokes | null>(null);
  const pointCount = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [reading, setReading] = useState(false);
  const uploaded = isSignatureUpload(value);
  // Drawing adds strokes to a drawn signature; an uploaded picture must be cleared first.
  const strokes = uploaded ? null : value;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    setReading(true);
    try {
      onChange(await readSignatureFile(file));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "That picture couldn't be used.");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return <div className="space-y-2">
    <p className="font-medium">Your eSignature</p>
    <p className="text-sm text-muted-foreground">
      Draw with a mouse, stylus, or finger, or upload a picture of your signature. Saved with this referral.
    </p>
    <div
      aria-label={uploaded ? "Uploaded signature" : "Draw your signature"}
      className={`relative h-40 touch-none overflow-hidden rounded-lg border bg-white text-black ${uploaded ? "cursor-default" : "cursor-crosshair"}`}
      onPointerDown={event => {
        if (disabled || uploaded || !event.isPrimary || event.button !== 0) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const point: [number, number] = [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height];
        const current = strokes ?? [];
        pointCount.current = current.reduce((sum, stroke) => sum + stroke.length, 0);
        if (current.length >= 100 || pointCount.current >= 1998) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drawing.current = [...current, [point, point]];
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
        const current = drawing.current;
        drawing.current = [...current.slice(0, -1), [...current[current.length - 1], point]];
        pointCount.current++;
        onChange(drawing.current);
      }}
      onPointerUp={() => { drawing.current = null; }}
      onPointerCancel={() => { drawing.current = null; }}
      onLostPointerCapture={() => { drawing.current = null; }}
    >
      {value && <SignatureImage value={value} />}
      {reading && <p role="status" className="absolute inset-0 grid place-items-center bg-white/80 text-sm text-neutral-600">Preparing picture…</p>}
    </div>
    {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
    {uploaded && <p className="text-xs text-muted-foreground">Uploaded picture. Clear it to draw instead.</p>}
    <div className="flex flex-wrap gap-2">
      <GlassButton type="button" disabled={disabled} onClick={() => { drawing.current = null; setUploadError(""); onChange(null); }}>Clear signature</GlassButton>
      {onSave && <GlassButton type="button" disabled={disabled || !value || saved}
        title="Use this signature on the referrals you write next, until you sign out or close this tab"
        onClick={() => value && onSave(value)}>
        <BookmarkCheck className="size-4" aria-hidden="true" />{saved ? "Signature saved" : "Save signature"}
      </GlassButton>}
      <GlassButton type="button" disabled={disabled || reading} onClick={() => fileInput.current?.click()}
        title="PNG, JPEG or WebP picture of your signature, up to 5 MB">
        <Upload className="size-4" aria-hidden="true" />Upload signature
      </GlassButton>
      <input ref={fileInput} type="file" accept={SIGNATURE_FILE_TYPES} className="hidden" aria-label="Signature picture"
        onChange={event => void upload(event.target.files?.[0])} />
    </div>
    {saved && onForget && <p className="text-xs text-muted-foreground">
      Your saved signature fills in on your next referrals this session.{" "}
      <button type="button" className="font-medium text-foreground underline underline-offset-2 hover:text-primary" onClick={onForget}>Stop using it</button>
    </p>}
  </div>;
}
