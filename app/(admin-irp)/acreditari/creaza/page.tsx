"use client";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp, Timestamp, setDoc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { useRouter, useSearchParams } from "next/navigation";
import { pdf } from "@react-pdf/renderer";
import { AcreditarePdfDoc } from "@/app/(admin-irp)/components/pdf/AcreditarePdf";
import { FileText, Plus, Eye, EyeOff, Calendar, Hash, User, IdCard, Building2, Mail } from "lucide-react";

export default function CreeazaAcreditarePage() {
  const { db, app } = initFirebase();
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params?.get("from") || null;
  const [numar, setNumar] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0,10));
  const [nume, setNume] = useState("");
  const [legit, setLegit] = useState("");
  const [redactie, setRedactie] = useState("");
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // load settings
  useEffect(() => {
    (async () => {
      try {
        const { judetId, structuraId } = getTenantContext();
        const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
        const snap = await getDoc(ref);
        if (snap.exists()) setSettings(snap.data());
      } catch {}
    })();
  }, [db]);

  // preload from journalist (reacreditare)
  useEffect(() => {
    if (!fromId) return;
    (async () => {
      try {
        const { judetId, structuraId } = getTenantContext();
        const jref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${fromId}`);
        const s = await getDoc(jref);
        if (s.exists()) {
          const d = s.data() as any;
          setNume(d.nume || "");
          setEmail(d.email || "");
          setLegit(d.legit || "");
          setRedactie(d.redactie || "");
        }
      } catch {}
    })();
  }, [db, fromId]);

  const dateLabel = useMemo(() => {
    if (!data) return "";
    const [y,m,d] = data.split("-");
    return `${d}/${m}/${y}`;
  }, [data]);

  useEffect(() => {
    if (!showPreview) return;
    let url: string | null = null;
    const t = setTimeout(async () => {
      try {
        const origin = window.location.origin;
        const blob = await pdf(
          <AcreditarePdfDoc
            settings={{
              headerLines: settings?.headerLines,
              logoUrlPublic: settings?.logoUrlPublic,
              unitLabel: settings?.unitLabel,
              city: settings?.city,
              phone: settings?.phone,
              footerLines: settings?.footerLines,
              assetBaseUrl: origin,
            }}
            data={{
              numar: numar || "—",
              dateLabel,
              nume: nume || "—",
              legit: legit || "—",
              redactie: redactie || "—",
            }}
          />
        ).toBlob();
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch {
        setPreviewUrl(null);
      }
    }, 200);
    return () => { clearTimeout(t); if (url) URL.revokeObjectURL(url); };
  }, [showPreview, settings, numar, dateLabel, nume, legit, redactie]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { judetId, structuraId } = getTenantContext();
      const payload: any = {
        numar,
        data: dateLabel,
        dataTimestamp: Timestamp.fromDate(new Date(data)),
        nume, legit, redactie, email,
        createdAt: serverTimestamp(),
        createdBy: app?.options.projectId || null,
        judetId, structuraId,
      };
      await addDoc(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Acreditari"), payload);

      // upsert jurnalist
      const jBase = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Jurnalisti");
      const jref = fromId ? doc(jBase, fromId) : doc(jBase);
      await setDoc(jref, {
        nume,
        email,
        legit,
        redactie,
        lastAcreditareYear: new Date(data).getFullYear(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
      alert("Acreditare salvată");
      router.replace("/acreditari/lista");
    } catch {
      alert("Eroare la salvare");
    } finally {
      setLoading(false);
    }
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
            Generează Acreditare
          </div>
          <div className="text-sm text-gray-600 mt-1">Creează un document de acreditare pentru jurnaliști</div>
        </div>
        <button 
          onClick={() => setShowPreview((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
        >
          {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          {showPreview ? "Ascunde previzualizare" : "Arată previzualizare"}
        </button>
      </div>

      <div className={showPreview ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-6"}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Document Info */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Hash size={16} className="text-blue-600" />
                <h3 className="font-medium text-gray-900">Informații document</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Număr acreditare</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      value={numar} 
                      onChange={(e)=>setNumar(e.target.value)} 
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                      placeholder="ex. 2560586" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data emiterii</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="date" 
                      value={data} 
                      onChange={(e)=>setData(e.target.value)} 
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Journalist Info */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <User size={16} className="text-blue-600" />
                <h3 className="font-medium text-gray-900">Informații jurnalist</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nume complet</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    value={nume} 
                    onChange={(e)=>setNume(e.target.value)} 
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                    placeholder="ex. Constantin Ionuț-Silviu" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Legitimație presă</label>
                  <div className="relative">
                    <IdCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      value={legit} 
                      onChange={(e)=>setLegit(e.target.value)} 
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                      placeholder="ex. AZ 594301" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Redacție</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      value={redactie} 
                      onChange={(e)=>setRedactie(e.target.value)} 
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                      placeholder="ex. REDACȚIA Argeș Știri" 
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email (opțional)</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="email"
                    value={email} 
                    onChange={(e)=>setEmail(e.target.value)} 
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                    placeholder="ex. jurnalist@example.com" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button 
              type="submit"
              disabled={loading || !nume || !legit || !redactie || !numar} 
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              <Plus size={16} />
              {loading ? "Se salvează..." : "Salvează acreditarea"}
            </button>
          </div>
        </form>

        {showPreview && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-blue-600" />
                <h3 className="font-medium text-gray-900">Previzualizare PDF</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="h-[70vh] bg-gray-50 rounded-lg border border-gray-200">
                {previewUrl ? (
                  <iframe className="w-full h-full rounded-lg" src={previewUrl} />
                ) : (
                  <div className="grid place-items-center h-full">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3 animate-pulse">
                        <FileText size={20} className="text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">Se generează previzualizarea...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


