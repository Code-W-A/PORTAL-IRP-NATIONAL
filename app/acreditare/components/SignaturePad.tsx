"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SignaturePadProps = {
  valuePngBlob: Blob | null;
  onChange: (png: Blob | null) => void;
};

function isInsideCanvas(el: EventTarget | null): el is HTMLCanvasElement {
  return !!el && (el as any).tagName === "CANVAS";
}

export function SignaturePad({ valuePngBlob, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const hint = useMemo(() => {
    if (valuePngBlob || hasInk) return "Semnătură adăugată";
    return "Semnează în zona de mai jos";
  }, [valuePngBlob, hasInk]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        // Clearing on resize is OK for signature UX (user can re-sign).
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        setHasInk(false);
        onChange(null);
      }
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When external blob changes to null, clear canvas.
    if (valuePngBlob !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }, [valuePngBlob]);

  const exportPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          onChange(null);
          resolve();
          return;
        }
        onChange(blob);
        resolve();
      }, "image/png");
    });
  };

  const clear = () => {
    onChange(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const getPoint = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return { x: x * dpr, y: y * dpr };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInsideCanvas(e.target)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    lastRef.current = getPoint(e.nativeEvent);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e.nativeEvent);
    const last = lastRef.current;
    if (!last) {
      lastRef.current = p;
      return;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.2 * Math.max(1, window.devicePixelRatio || 1);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    setHasInk(true);
  };

  const endStroke = async () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    if (hasInk) await exportPng();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Semnătură</div>
          <div className="text-xs text-gray-600">{hint}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clear}
            className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
          >
            Șterge
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-40 touch-none bg-white"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Trage cu degetul sau mouse-ul pentru a semna. Semnătura se salvează automat.
        </div>
      </div>
    </div>
  );
}


