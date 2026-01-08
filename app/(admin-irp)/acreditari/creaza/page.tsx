"use client";
import { useEffect, useMemo, useState } from "react";
import { getTenantContext } from "@/lib/tenant";
import { FileText, Link2, Check, Copy, ExternalLink, Search, Loader2, X, ScanText, Wand2 } from "lucide-react";
import { CerereAcreditareForm, type CerereAcreditarePrefill } from "@/app/acreditare/components/CerereAcreditareForm";
import { initFirebase } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";

type ActiveTab = "cerere" | "simplu";

function normalizeLegitId(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function ddmmyyyySlashFromIso(iso: string) {
  const s = String(iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function isoToday() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeFileName(name: string): string {
  return String(name || "acreditare")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
}

function parseAcreditareNumar(v: any): number | null {
  const s = String(v || "").trim();
  if (!s) return null;
  // accept "2.560.588" or "2560588"
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

function formatNumarDots(n: number): string {
  const s = String(Math.max(0, Math.trunc(n)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function SimpleForm({
  db,
  auth,
  onContinueComplex,
  prefill,
  prefillKey,
}: {
  db: ReturnType<typeof initFirebase>["db"];
  auth: ReturnType<typeof initFirebase>["auth"];
  onContinueComplex: (cerereId: string) => void;
  prefill: { nume?: string; legit?: string; redactie?: string; email?: string } | null;
  prefillKey: number;
}) {
  const [nume, setNume] = useState("");
  const [legit, setLegit] = useState("");
  const [redactie, setRedactie] = useState("");
  const [email, setEmail] = useState("");
  const [dataIso, setDataIso] = useState<string>(isoToday());
  const [nextNumar, setNextNumar] = useState<number | null>(null);
  const [numarLoading, setNumarLoading] = useState(false);
  const [numarNeedsInit, setNumarNeedsInit] = useState(false);
  const [maxFromDocs, setMaxFromDocs] = useState(0);
  const [startNumarText, setStartNumarText] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastCerereId, setLastCerereId] = useState<string | null>(null);

  async function computeNextNumarPreview() {
    if (numarLoading) return;
    setNumarLoading(true);
    try {
      const { judetId, structuraId } = getTenantContext();
      const settingsRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      const sSnap = await getDoc(settingsRef);
      const lastFromSettings = typeof (sSnap.data() as any)?.acreditareLastNumar === "number" ? Number((sSnap.data() as any).acreditareLastNumar) : 0;

      const acrColl = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Acreditari");
      const snap = await getDocs(query(acrColl, orderBy("createdAt", "desc"), limit(50)));
      let max = 0;
      for (const d of snap.docs) {
        const n = parseAcreditareNumar((d.data() as any)?.numar);
        if (typeof n === "number" && Number.isFinite(n)) max = Math.max(max, n);
      }
      setMaxFromDocs(max);
      const base = Math.max(lastFromSettings || 0, max || 0);
      setNumarNeedsInit(base <= 0);
      setNextNumar(base + 1);
    } catch {
      // fallback
      setMaxFromDocs(0);
      setNumarNeedsInit(true);
      setNextNumar(1);
    } finally {
      setNumarLoading(false);
    }
  }

  useEffect(() => {
    computeNextNumarPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!prefill) return;
    setNume(prefill.nume || "");
    setLegit(prefill.legit || "");
    setRedactie(prefill.redactie || "");
    setEmail(prefill.email || "");
  }, [prefillKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setMsg(null);

    const nn = nume.trim();
    const lg = legit.trim();
    const rd = redactie.trim();
    const em = email.trim();

    if (!nn || !lg || !rd || !em) {
      setMsg("Completează toate câmpurile.");
      return;
    }

    const { judetId, structuraId } = getTenantContext();
    const currentKey = `${String(judetId || "").toUpperCase()}_${String(structuraId || "").toUpperCase()}`;
    const dataLabel = ddmmyyyySlashFromIso(dataIso);
    const nowTs = serverTimestamp();

    try {
      setSaving(true);
      // Allocate next number atomically (Settings/general.acreditareLastNumar)
      const settingsRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      const allocated = await runTransaction(db, async (tx) => {
        const sSnap = await tx.get(settingsRef);
        const last = typeof (sSnap.data() as any)?.acreditareLastNumar === "number" ? Number((sSnap.data() as any).acreditareLastNumar) : 0;
        let next: number;
        if (last > 0) {
          next = last + 1;
        } else if (maxFromDocs > 0) {
          next = maxFromDocs + 1;
        } else {
          const start = parseAcreditareNumar(startNumarText);
          if (!start || start <= 0) throw new Error("numar_start_required");
          next = start;
        }
        tx.set(settingsRef, { acreditareLastNumar: next }, { merge: true });
        return next;
      });
      setNextNumar(allocated + 1);
      const numarFormatted = formatNumarDots(allocated);

      // 1) Create CereriAcreditare in the SAME schema as complex form (minimal fields)
      const cererePayload: any = {
        structuri: [{ judetId: String(judetId || "").toUpperCase(), structuraId: String(structuraId || "").toUpperCase(), display: `${structuraId} ${judetId}` }],
        structuraKeys: [currentKey],
        statusByStructura: { [currentKey]: { status: "pending" } },
        createdAt: nowTs,
        submittedAt: nowTs,
        acreditare: { numar: numarFormatted, data: dataLabel || null },
        media: {
          tip: { presaScrisa: false, tv: false, radio: false, agentie: false, online: false, altceva: false },
          tipAltceva: "",
          denumire: rd,
          cui: "",
          adresa: "",
          email: "",
          telefon: { fix: "", fax: "", mobil: "" },
          website: "",
        },
        jurnalist: {
          numePrenume: nn,
          dataNasterii: null,
          locNastere: "",
          cetatenie: "Română",
          documentIdentitate: { tip: "CI", serieNumar: "" },
          adresa: "",
          legitimatie: { numar: lg, dataExpirare: null },
          functie: { redactor: false, reporter: false, fotoreporter: false, cameraman: false, tehnician: false, altceva: false, altcevaText: "" },
          email: em,
          telefon: { fix: "", fax: "", mobil: "" },
        },
        consimtamant: { gdpr: true, gdprVersion: "v1", gdprAcceptedAt: nowTs },
        attachments: null,
        source: { simple: true },
      };
      const createdCerere = await addDoc(collection(db, "CereriAcreditare"), cererePayload);
      const cerereId = createdCerere.id;
      setLastCerereId(cerereId);
      setMsg("Cerere salvată. Status: În așteptare. O poți aproba/respinge din „Cereri acreditare”.");
    } catch (e: any) {
      if (String(e?.message || "") === "numar_start_required") {
        setMsg("Introdu numărul de start pentru prima acreditare (ex: 2.560.588).");
      } else {
        setMsg("Nu am putut salva cererea. Încearcă din nou.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-900">Completare simplă (pentru PDF „ACREDITARE”)</div>
            <div className="text-xs text-gray-600 mt-1">Doar câmpurile minime necesare pentru certificatul din exemplu.</div>
          </div>
          <div className="text-xs text-gray-500">PDF se generează după salvare.</div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nume Prenume *</label>
            <input
              value={nume}
              onChange={(e) => setNume(e.target.value)}
              placeholder="Nume Prenume"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nr. legitimație *</label>
            <input
              value={legit}
              onChange={(e) => setLegit(e.target.value)}
              placeholder="Ex: AB007"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Redacție *</label>
            <input
              value={redactie}
              onChange={(e) => setRedactie(e.target.value)}
              placeholder="Ex: SC HITFM GROUP SRL"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplu.ro"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input
              type="date"
              value={dataIso}
              onChange={(e) => setDataIso(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">În PDF va apărea ca DD/MM/YYYY.</div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nr. *</label>
            {numarNeedsInit ? (
              <>
                <input
                  value={startNumarText}
                  onChange={(e) => setStartNumarText(e.target.value)}
                  placeholder="Ex: 2.560.588"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <div className="text-xs text-gray-500 mt-1">Prima acreditare: introduceți numărul de start. Următoarele vor fi +1 automat.</div>
              </>
            ) : (
              <>
                <input
                  value={nextNumar ? formatNumarDots(nextNumar) : ""}
                  readOnly
                  placeholder={numarLoading ? "Se calculează..." : "Se calculează..."}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <div className="text-xs text-gray-500 mt-1">Autoincrement (+1) față de ultimul număr emis pentru structura curentă.</div>
              </>
            )}
          </div>
        </div>

        {msg && <div className="mt-4 text-sm text-gray-700">{msg}</div>}

        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <button
            type="submit"
            disabled={saving || numarLoading || !nextNumar}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
            {saving ? "Se salvează..." : "Salvează cererea"}
          </button>

          {lastCerereId && (
            <button
              type="button"
              onClick={() => onContinueComplex(lastCerereId)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Continuă în formular complex
            </button>
          )}

          <a
            href="/acreditari/cereri"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors font-medium"
          >
            Vezi „Cereri acreditare”
          </a>
        </div>
      </div>
    </form>
  );
}

export default function CreeazaAcreditarePage() {
  const { db, auth } = initFirebase();
  const { user } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("cerere");
  const [editCerereId, setEditCerereId] = useState<string | null>(null);

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

  // Allow deep-linking: /acreditari/creaza?tab=cerere&cerereId=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const cerereId = (url.searchParams.get("cerereId") || "").trim();
      const tab = (url.searchParams.get("tab") || "").trim();
      if (tab === "simplu") setActiveTab("simplu");
      if (tab === "cerere") setActiveTab("cerere");
      if (cerereId) {
        setEditCerereId(cerereId);
        setActiveTab("cerere");
      }
    } catch {}
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const simplePrefill = useMemo(() => {
    if (!selectedPrefill) return null;
    return {
      nume: selectedPrefill.numePrenume || "",
      legit: selectedPrefill.nrLegitimatie || "",
      redactie: selectedPrefill.institutieDenumire || "",
      email: selectedPrefill.jurnalistEmail || "",
    };
  }, [selectedPrefill]);

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
      const mediaType = String(fields.mediaType || "").trim();
      const functie = String(fields.functie || "").trim();

      const mediaTypes: any = mediaType
        ? {
            presaScrisa: mediaType === "presaScrisa",
            tv: mediaType === "tv",
            radio: mediaType === "radio",
            agentie: mediaType === "agentie",
            online: mediaType === "online",
            altceva: mediaType === "altceva",
          }
        : undefined;

      const functii: any = functie
        ? {
            redactor: functie === "redactor",
            reporter: functie === "reporter",
            fotoreporter: functie === "fotoreporter",
            cameraman: functie === "cameraman",
            tehnician: functie === "tehnician",
            altceva: functie === "altceva",
          }
        : undefined;

      const pf: CerereAcreditarePrefill = {
        mediaTypes,
        mediaAltceva: String(fields.mediaAltceva || ""),
        institutieDenumire: String(fields.institutieDenumire || ""),
        institutieCui: String(fields.institutieCui || ""),
        institutieAdresa: String(fields.institutieAdresa || ""),
        institutieEmail: String(fields.institutieEmail || ""),
        institutieTelefonFix: String(fields.institutieTelefonFix || ""),
        institutieTelefonFax: String(fields.institutieTelefonFax || ""),
        institutieTelefonMobil: String(fields.institutieTelefonMobil || ""),
        institutieWebsite: String(fields.institutieWebsite || ""),
        numePrenume: String(fields.numePrenume || ""),
        dataNasterii: String(fields.dataNasterii || ""),
        locNastere: String(fields.locNastere || ""),
        cetatenie: String(fields.cetatenie || ""),
        tipDocIdentitate: String(fields.tipDocIdentitate || ""),
        serieNumarDoc: String(fields.serieNumarDoc || ""),
        adresaOptional: String(fields.adresaOptional || ""),
        nrLegitimatie: String(fields.nrLegitimatie || ""),
        dataExpirareLegit: String(fields.dataExpirareLegit || ""),
        functii,
        functieAltceva: String(fields.functieAltceva || ""),
        jurnalistEmail: String(fields.jurnalistEmail || ""),
        jurnalistTelefonFix: String(fields.jurnalistTelefonFix || ""),
        jurnalistTelefonFax: String(fields.jurnalistTelefonFax || ""),
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
            {activeTab === "cerere" ? "Cerere acreditare" : "Acreditare (PDF)"}
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
        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("cerere")}
            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
              activeTab === "cerere"
                ? "border-blue-600 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Cerere (formular complex)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("simplu")}
            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
              activeTab === "simplu"
                ? "border-blue-600 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Completare simplă
          </button>
              </div>

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

        {activeTab === "cerere" ? (
          <CerereAcreditareForm
            mode="admin_single_structura"
            fixedStructuraKey={`${getTenantContext().judetId}_${getTenantContext().structuraId}`}
            prefill={selectedPrefill}
            prefillKey={prefillKey}
            existingCerereId={editCerereId || undefined}
            onSubmitted={(id) => setEditCerereId(id)}
            title="Formular acreditare"
            description=""
          />
        ) : (
          <SimpleForm
            db={db}
            auth={auth}
            prefill={simplePrefill}
            prefillKey={prefillKey}
            onContinueComplex={(cerereId) => {
              setEditCerereId(cerereId);
              setActiveTab("cerere");
            }}
          />
        )}
      </div>
    </div>
  );
}


