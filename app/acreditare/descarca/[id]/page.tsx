"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { acrLog, acrLogError } from "@/lib/acreditareClientLog";

/** Must match ACREDITARE_PDF_TOKEN_HEADER in lib/server/acreditarePdfToken.ts */
const PDF_TOKEN_HEADER = "x-acreditare-download-token";

function DescarcaInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Se pregătește descărcarea…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = decodeURIComponent(String(params?.id || "").trim());
        const judetId = String(search.get("judetId") || "").toUpperCase();
        const structuraId = String(search.get("structuraId") || "").toUpperCase();
        acrLog("descarca", "start", { acreditareId: id || null, judetId, structuraId });
        if (!id || !judetId || !structuraId) {
          throw new Error("Link incomplet (lipsesc parametrii).");
        }

        const rawHash = typeof window !== "undefined" ? String(window.location.hash || "").replace(/^#/, "") : "";
        let token = "";
        if (rawHash.startsWith("t=")) token = decodeURIComponent(rawHash.slice(2));
        else if (rawHash) token = decodeURIComponent(rawHash);

        // Drop hash from address bar so copy/share / history retain less secret material.
        try {
          const clean = `${window.location.pathname}${window.location.search}`;
          window.history.replaceState(null, "", clean);
        } catch {}

        if (!token) throw new Error("Link invalid sau incomplet (token lipsă).");

        const qs = new URLSearchParams({
          variant: "public",
          judetId,
          structuraId,
        });
        const res = await fetch(`/api/acreditari/${encodeURIComponent(id)}/pdf?${qs.toString()}`, {
          method: "GET",
          headers: {
            [PDF_TOKEN_HEADER]: token,
          },
        });
        if (!res.ok) {
          let detail = "";
          try {
            const j = await res.json();
            detail = String(j?.error || "");
          } catch {}
          if (res.status === 410) throw new Error(detail || "Link-ul de descărcare a expirat.");
          throw new Error(detail || "Nu am putut descărca acreditarea.");
        }

        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `acreditare_${id.replace(/\W+/g, "_")}_fara_semnaturi.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        acrLog("descarca", "ok", { acreditareId: id, bytes: blob.size });
        setStatus("ok");
        setMessage("Descărcarea a început. Dacă nu apare, verifică dacă browserul a blocat popup-urile.");
      } catch (e: any) {
        if (cancelled) return;
        acrLogError("descarca", "failed", e, {
          acreditareId: String(params?.id || ""),
        });
        setStatus("error");
        setMessage(typeof e?.message === "string" ? e.message : "Eroare la descărcare.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params?.id, search]);

  return (
    <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
      <h1 className="text-xl font-semibold text-gray-900">Descărcare acreditare</h1>
      <p
        className={`mt-3 text-sm ${
          status === "error" ? "text-red-700" : status === "ok" ? "text-emerald-700" : "text-gray-600"
        }`}
      >
        {message}
      </p>
    </div>
  );
}

/**
 * Landing page for email PDF links.
 * Token lives in the URL hash (never sent as a query param to the API / server logs).
 */
export default function AcreditareDescarcaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <h1 className="text-xl font-semibold text-gray-900">Descărcare acreditare</h1>
            <p className="mt-3 text-sm text-gray-600">Se pregătește descărcarea…</p>
          </div>
        }
      >
        <DescarcaInner />
      </Suspense>
    </div>
  );
}
