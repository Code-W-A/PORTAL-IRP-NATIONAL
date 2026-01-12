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
  // accept digits only (preferred) or legacy dotted format "2.560.588"
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return null;
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
  const [sex, setSex] = useState<"F" | "M">("F");
  const [legit, setLegit] = useState("");
  const [redactie, setRedactie] = useState("");
  const [email, setEmail] = useState("");
  const [dataIso, setDataIso] = useState<string>(isoToday());
  const [nextNumar, setNextNumar] = useState<number | null>(null);
  const [numarLoading, setNumarLoading] = useState(false);
  const [maxFromDocs, setMaxFromDocs] = useState(0);
  const [numarText, setNumarText] = useState("");

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
      const base = lastFromSettings > 0 ? lastFromSettings : (max || 0);
      const suggested = base > 0 ? base + 1 : 1;
      setNextNumar(suggested);
      // prefill editable input if empty
      setNumarText((prev) => {
        const prevN = parseAcreditareNumar(prev);
        if (!prevN) return String(suggested);
        return prev;
      });
    } catch {
      // fallback
      setMaxFromDocs(0);
      setNextNumar(null);
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
    const sx = sex;
    const lg = legit.trim();
    const rd = redactie.trim();
    const em = email.trim();
    const chosenNumar = parseAcreditareNumar(numarText);

    if (!nn || !sx || !lg || !rd || !em || !chosenNumar) {
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
        await tx.get(settingsRef);
        // user-controlled numbering: set counter to whatever is in the input (can go up/down)
        tx.set(settingsRef, { acreditareLastNumar: chosenNumar }, { merge: true });
        return chosenNumar;
      });
      setNextNumar(allocated + 1);
      const numarFormatted = String(allocated);
      setNumarText(String(allocated + 1));

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
          sex: sx,
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
      setMsg("Nu am putut salva cererea. Încearcă din nou.");
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Sex *</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value === "M" ? "M" : "F")}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              <option value="F">F (doamna)</option>
              <option value="M">M (domnul)</option>
            </select>
            <div className="text-xs text-gray-500 mt-1">Influențează textul „doamna/domnul” din PDF-ul de acreditare.</div>
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
            <input
              value={numarText}
              onChange={(e) => setNumarText(String(e.target.value || "").replace(/\D+/g, ""))}
              placeholder={numarLoading ? "Se calculează..." : nextNumar ? String(nextNumar) : "Introduceți numărul"}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              Introdu doar cifre (fără puncte). După fiecare salvare, numărul din input va fi incrementat automat cu +1.
            </div>
          </div>
        </div>

        {msg && <div className="mt-4 text-sm text-gray-700">{msg}</div>}

        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <button
            type="submit"
            disabled={saving || numarLoading || !parseAcreditareNumar(numarText)}
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

  // Default to "Completare simplă"
  const [activeTab, setActiveTab] = useState<ActiveTab>("simplu");
  const [editCerereId, setEditCerereId] = useState<string | null>(null);

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
          <div className="text-sm text-gray-600 mt-1">Completează o cerere de acreditare pentru structura curentă</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Temporar ascuns (cerut): Link cerere acreditare jurnalist / Deschide formular cerere */}
          {false && (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Temporar ascuns (cerut): Cerere (formular complex) */}
          {false && (
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
          )}
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

        {activeTab === "cerere" ? (
          <CerereAcreditareForm
            mode="admin_single_structura"
            fixedStructuraKey={`${getTenantContext().judetId}_${getTenantContext().structuraId}`}
            prefill={null}
            prefillKey={0}
            existingCerereId={editCerereId || undefined}
            onSubmitted={(id) => setEditCerereId(id)}
            title="Formular acreditare"
            description=""
          />
        ) : (
          <SimpleForm
            db={db}
            auth={auth}
            prefill={null}
            prefillKey={0}
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


