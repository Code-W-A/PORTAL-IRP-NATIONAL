"use client";
import { useEffect, useMemo, useState } from "react";
import { getTenantContext } from "@/lib/tenant";
import { FileText, Link2, Check, Copy, ExternalLink, Search, Loader2, X, ScanText, Wand2 } from "lucide-react";
import { CerereAcreditareForm, type CerereAcreditarePrefill } from "@/app/acreditare/components/CerereAcreditareForm";
import { initFirebase } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";

export default function CreeazaAcreditarePage() {
  const { db, auth } = initFirebase();
  const { user } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);

  const [cereriLoading, setCereriLoading] = useState(false);
  const [cereriError, setCereriError] = useState<string | null>(null);
  const [cereri, setCereri] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrefill, setSelectedPrefill] = useState<CerereAcreditarePrefill | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);

  const canUseOcr = String(user?.email || "").toLowerCase() === "irp.isudb@gmail.com";
  const [ocrFiles, setOcrFiles] = useState<File[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const currentKey = useMemo(() => {
    const { judetId, structuraId } = getTenantContext();
    return `${judetId}_${structuraId}`.toUpperCase();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setCereriLoading(true);
      setCereriError(null);
      try {
        const base = collection(db, "CereriAcreditare");
        try {
          const q = query(base, where("structuraKeys", "array-contains", currentKey), orderBy("submittedAt", "desc"));
          const snap = await getDocs(q);
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          if (!alive) return;
          setCereri(list);
        } catch {
          // Fallback if index/orderBy isn't available yet
          const q2 = query(base, where("structuraKeys", "array-contains", currentKey));
          const snap2 = await getDocs(q2);
          const list2 = snap2.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          if (!alive) return;
          setCereri(list2);
        }
      } catch {
        if (!alive) return;
        setCereriError("Nu am putut încărca cererile pentru prefill.");
        setCereri([]);
      } finally {
        if (!alive) return;
        setCereriLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, currentKey]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return cereri
      .map((c) => {
        const nume = String(c?.jurnalist?.numePrenume || "");
        const nrLegit = String(c?.jurnalist?.legitimatie?.numar || "");
        const inst = String(c?.media?.denumire || "");
        const submittedAt = String(c?.submittedAt || c?.createdAt || "");
        const hay = `${c.id} ${nume} ${nrLegit} ${inst} ${submittedAt}`.toLowerCase();
        return { c, nume, nrLegit, inst, hay };
      })
      .filter((x) => x.hay.includes(q))
      .slice(0, 15);
  }, [cereri, searchTerm]);

  function makePrefillFromCerere(c: any): CerereAcreditarePrefill {
    const m = c?.media || {};
    const j = c?.jurnalist || {};
    const telM = m?.telefon || {};
    const telJ = j?.telefon || {};
    const docId = j?.documentIdentitate || {};
    const legit = j?.legitimatie || {};
    const functie = j?.functie || {};
    return {
      mediaTypes: m?.tip || undefined,
      mediaAltceva: m?.tipAltceva || "",
      institutieDenumire: m?.denumire || "",
      institutieCui: m?.cui || "",
      institutieAdresa: m?.adresa || "",
      institutieEmail: m?.email || "",
      institutieTelefonFix: telM?.fix || "",
      institutieTelefonFax: telM?.fax || "",
      institutieTelefonMobil: telM?.mobil || "",
      institutieWebsite: m?.website || "",
      numePrenume: j?.numePrenume || "",
      dataNasterii: j?.dataNasterii || "",
      locNastere: j?.locNastere || "",
      cetatenie: j?.cetatenie || "",
      tipDocIdentitate: docId?.tip || "",
      serieNumarDoc: docId?.serieNumar || "",
      adresaOptional: j?.adresa || "",
      nrLegitimatie: legit?.numar || "",
      dataExpirareLegit: legit?.dataExpirare || "",
      functii: typeof functie === "object" ? { ...functie } : undefined,
      functieAltceva: String(functie?.altcevaText || ""),
      jurnalistEmail: j?.email || "",
      jurnalistTelefonFix: telJ?.fix || "",
      jurnalistTelefonFax: telJ?.fax || "",
      jurnalistTelefonMobil: telJ?.mobil || "",
    };
  }

  async function runOcr() {
    if (!canUseOcr) return;
    if (ocrLoading) return;
    if (!ocrFiles.length) {
      setOcrError("Încarcă 1–2 imagini pentru scanare.");
      return;
    }
    setOcrLoading(true);
    setOcrError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Trebuie să fii autentificat.");
      const fd = new FormData();
      for (const f of ocrFiles.slice(0, 2)) fd.append("images", f);
      const res = await fetch("/api/acreditari/ocr", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "OCR failed");

      const fields = data?.fields || {};
      const pf: CerereAcreditarePrefill = {
        institutieDenumire: String(fields.institutieDenumire || ""),
        institutieEmail: String(fields.institutieEmail || ""),
        institutieTelefonMobil: String(fields.institutieTelefonMobil || ""),
        numePrenume: String(fields.numePrenume || ""),
        nrLegitimatie: String(fields.nrLegitimatie || ""),
        jurnalistEmail: String(fields.jurnalistEmail || ""),
        jurnalistTelefonMobil: String(fields.jurnalistTelefonMobil || ""),
      };
      setSelectedPrefill((prev) => ({ ...(prev || {}), ...pf }));
      setPrefillKey((k) => k + 1);
    } catch (e: any) {
      setOcrError(typeof e?.message === "string" ? e.message : "OCR eșuat.");
    } finally {
      setOcrLoading(false);
    }
  }

  async function copyCereriLink() {
    try {
      const { judetId, structuraId } = getTenantContext();
      const origin = window.location.origin;
      const url = `${origin}/acreditare?structuri=${encodeURIComponent(`${judetId}:${structuraId}`)}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      alert("Nu am putut copia link-ul. Încercați din nou.");
    }
  }

  function buildCereriLink(): string {
    const { judetId, structuraId } = getTenantContext();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/acreditare?structuri=${encodeURIComponent(`${judetId}:${structuraId}`)}`;
  }

  function openCereriForm() {
    try {
      const url = buildCereriLink();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  }

  return (
    <div className="space-y-6">
      {/* Header modern */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            Cerere acreditare
          </div>
          <div className="text-sm text-gray-600 mt-1">Completează o cerere de acreditare (ca jurnalist) pentru structura curentă</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={copyCereriLink}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
            title="Copiază link-ul public pentru cereri de acreditare (cu structura curentă preselectată)"
          >
            {copiedLink ? <Check size={16} className="text-emerald-600" /> : <Link2 size={16} />}
            {copiedLink ? "Link copiat" : "Link cerere acreditare jurnalist"}
            {!copiedLink && <Copy size={14} className="opacity-70" />}
          </button>
          <button
            type="button"
            onClick={openCereriForm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
            title="Deschide formular jurnalist"
          >
            <ExternalLink size={16} />
            Deschide formular cerere
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Prefill */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-gray-900">Caută și precompletează din cereri existente</div>
              <div className="text-xs text-gray-600 mt-1">Se caută în cererile din `CereriAcreditare` pentru structura curentă.</div>
            </div>
            <div className="text-xs text-gray-500">
              {cereriLoading ? "Se încarcă..." : `${cereri.length} cereri`}
            </div>
          </div>

          {canUseOcr && (
            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-indigo-900 inline-flex items-center gap-2">
                    <ScanText size={16} /> Scanare (OCR)
                  </div>
                  <div className="text-xs text-indigo-800/80 mt-1">Disponibil doar pentru contul `irp.isudb@gmail.com`.</div>
                </div>
                <button
                  type="button"
                  onClick={runOcr}
                  disabled={ocrLoading || ocrFiles.length === 0}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {ocrLoading ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                  {ocrLoading ? "Se scanează..." : "Scanează și aplică"}
                </button>
              </div>
              <div className="mt-3">
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg"
                  onChange={(e) => setOcrFiles(Array.from(e.target.files || []).slice(0, 2))}
                  className="block w-full text-sm text-indigo-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-900 hover:file:bg-indigo-200"
                />
                <div className="text-xs text-indigo-800/80 mt-2">Maxim 2 imagini (JPG/PNG). Recomandat: poză clară pe legitimație.</div>
                {ocrError && <div className="text-xs text-red-700 mt-2">{ocrError}</div>}
              </div>
            </div>
          )}

          <div className="mt-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Caută după nume / nr legitimație / instituție / ID"
                className="w-full pl-9 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none"
              />
              {cereriLoading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
            </div>
            {cereriError && <div className="mt-2 text-sm text-red-700">{cereriError}</div>}
          </div>

          {filtered.length > 0 && (
            <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
              {filtered.map(({ c, nume, nrLegit, inst }) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedPrefill(makePrefillFromCerere(c));
                    setPrefillKey((k) => k + 1);
                    setSearchTerm("");
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{nume || "—"}</div>
                    <div className="text-xs text-gray-600 mt-0.5 truncate">
                      {nrLegit ? `Legit: ${nrLegit}` : "Legit: —"} • {inst || "—"}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 font-mono truncate">{c.id}</div>
                  </div>
                  <div className="text-xs text-blue-700 font-medium">Aplică</div>
                </button>
              ))}
            </div>
          )}

          {selectedPrefill && (
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-gray-700">
                Prefill activ: <span className="font-semibold">{selectedPrefill.numePrenume || "—"}</span>
                {selectedPrefill.nrLegitimatie ? <span className="text-gray-500"> (legit {selectedPrefill.nrLegitimatie})</span> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPrefill(null);
                  setPrefillKey((k) => k + 1);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium"
              >
                <X size={14} />
                Curăță prefill
              </button>
            </div>
          )}
        </div>

        <CerereAcreditareForm
          mode="admin_single_structura"
          fixedStructuraKey={`${getTenantContext().judetId}_${getTenantContext().structuraId}`}
          prefill={selectedPrefill}
          prefillKey={prefillKey}
          title="Formular acreditare"
          description=""
        />
      </div>
    </div>
  );
}


