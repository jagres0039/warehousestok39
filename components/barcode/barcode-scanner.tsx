"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  /** Called when a barcode is decoded. Caller is responsible for closing. */
  onResult: (text: string) => void;
  title: string;
  description?: string;
  manualLabel: string;
  manualPlaceholder: string;
  manualSubmit: string;
  permissionDeniedLabel: string;
  noCameraLabel: string;
  startingLabel: string;
  closeLabel: string;
}

/**
 * Barcode scanner modal. Tries to start the back camera via @zxing/browser
 * and reports decoded text via onResult. Falls back to manual input when no
 * camera is available or permission is denied.
 */
export function BarcodeScanner({
  open,
  onClose,
  onResult,
  title,
  description,
  manualLabel,
  manualPlaceholder,
  manualSubmit,
  permissionDeniedLabel,
  noCameraLabel,
  startingLabel,
  closeLabel,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "denied" | "unavailable">(
    "idle",
  );
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    async function start() {
      setStatus("starting");
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        if (!devices.length) {
          setStatus("unavailable");
          return;
        }
        // Prefer the back-facing camera (common on phones); fall back to first.
        const back = devices.find((d) => /back|rear|environment/i.test(d.label));
        const deviceId = back?.deviceId ?? devices[0]?.deviceId;
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result) => {
            if (result) {
              const text = result.getText();
              if (text) {
                controls.stop();
                onResult(text);
              }
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("running");
      } catch (error) {
        if (cancelled) return;
        // PermissionDenied / NotAllowedError when user blocks the camera.
        const name = (error as { name?: string } | undefined)?.name ?? "";
        setStatus(name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "unavailable");
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onResult]);

  const submitManual = () => {
    const trimmed = manualValue.trim();
    if (!trimmed) return;
    onResult(trimmed);
    setManualValue("");
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} closeLabel={closeLabel}>
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-lg border border-border bg-black/90 aspect-video">
          {status === "running" && (
            // Decorative scanning frame to hint where to point the camera.
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-32 w-64 rounded-md border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}
          {(status === "idle" || status === "starting") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span>{startingLabel}</span>
            </div>
          )}
          {status === "denied" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white">
              <CameraOff className="h-6 w-6" aria-hidden="true" />
              <span>{permissionDeniedLabel}</span>
            </div>
          )}
          {status === "unavailable" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white">
              <Camera className="h-6 w-6" aria-hidden="true" />
              <span>{noCameraLabel}</span>
            </div>
          )}
          {/* The video element is rendered even before status === "running" so
              zxing can attach to it as soon as decoding starts. */}
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            aria-hidden={status !== "running"}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="barcode-manual-input">
            {manualLabel}
          </label>
          <div className="flex gap-2">
            <Input
              id="barcode-manual-input"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder={manualPlaceholder}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitManual();
                }
              }}
            />
            <Button type="button" onClick={submitManual} disabled={!manualValue.trim()}>
              {manualSubmit}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
