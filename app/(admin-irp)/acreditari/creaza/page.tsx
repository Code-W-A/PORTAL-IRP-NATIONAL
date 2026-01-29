"use client";
import { useEffect, useMemo, useState } from "react";
import { getTenantContext } from "@/lib/tenant";
import { FileText, Link2, Check, Copy, ExternalLink, Search, Loader2, X, ScanText, Wand2, Users } from "lucide-react";
import { CerereAcreditareForm, type CerereAcreditarePrefill } from "@/app/acreditare/components/CerereAcreditareForm";
import { initFirebase } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";

type ActiveTab = "cerere" | "simplu";
type JurnalistRecord = { id: string; nume?: string; email?: string; telefon?: string; redactie?: string; legit?: string; adresaRedactie?: string; lastAcreditareYear?: number };

function normalizeLegitId(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeIdFromValue(s: string) {
  return normalizeLegitId(String(s || ""));
}

function normalizePhoneValue(s: string) {
  return String(s || "").trim().replace(/[^\d+]/g, "");
}

function normalizeEmailValue(s: string) {
  return String(s || "").trim().toLowerCase();
}

function ddmmyyyySlashFromIso(iso: string) {
  const s = String(iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function isoFromDdMmYyyy(v: string): string {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
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
  existingAcreditareId,
  existingCerereId,
}: {
  db: ReturnType<typeof initFirebase>["db"];
  auth: ReturnType<typeof initFirebase>["auth"];
  onContinueComplex: (cerereId: string) => void;
  prefill: { nume?: string; legit?: string; redactie?: string; email?: string; telefon?: string; sex?: "F" | "M"; dataIso?: string; numar?: string } | null;
  prefillKey: number;
  existingAcreditareId?: string | null;
  existingCerereId?: string | null;
}) {
  const [nume, setNume] = useState("");
  const [sex, setSex] = useState<"F" | "M">("F");
  const [legit, setLegit] = useState("");
  const [redactie, setRedactie] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [dataIso, setDataIso] = useState<string>(isoToday());
  const [nextNumar, setNextNumar] = useState<number | null>(null);
  const [numarLoading, setNumarLoading] = useState(false);
  const [maxFromDocs, setMaxFromDocs] = useState(0);
  const [numarText, setNumarText] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastCerereId, setLastCerereId] = useState<string | null>(null);
  const [loadedAcreditareId, setLoadedAcreditareId] = useState<string | null>(null);
  const [originalLegit, setOriginalLegit] = useState<string>("");
  const [jurnalisti, setJurnalisti] = useState<JurnalistRecord[]>([]);
  const [jurnalistiLoading, setJurnalistiLoading] = useState(false);
  const [jurnalistiSearch, setJurnalistiSearch] = useState("");
  const [selectedJurnalistId, setSelectedJurnalistId] = useState<string | null>(null);

  function computeJurnalistId() {
    const l = normalizeLegitId(legit);
    if (l) return l;
    if (selectedJurnalistId) return selectedJurnalistId;
    const em = normalizeIdFromValue(String(email || "").toLowerCase());
    if (em) return em;
    const tel = normalizeIdFromValue(normalizePhoneValue(telefon));
    if (tel) return tel;
    const nr = normalizeIdFromValue(`${nume || ""} ${redactie || ""}`);
    return nr || selectedJurnalistId || `J_${Date.now()}`;
  }

  async function loadJurnalisti() {
    try {
      setJurnalistiLoading(true);
      const { judetId, structuraId } = getTenantContext();
      if (!judetId || !structuraId) return;
      const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Jurnalisti"));
      setJurnalisti(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as JurnalistRecord[]);
    } finally {
      setJurnalistiLoading(false);
    }
  }

  useEffect(() => {
    loadJurnalisti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const jurnalistiFiltered = useMemo(() => {
    const s = jurnalistiSearch.trim().toLowerCase();
    if (!s) return jurnalisti.slice(0, 8);
    return jurnalisti
      .filter((j) => [j.nume, j.email, j.telefon, j.redactie, j.legit].filter(Boolean).map(String).some((v) => v.toLowerCase().includes(s)))
      .slice(0, 8);
  }, [jurnalisti, jurnalistiSearch]);

  const jurnalistiMatches = useMemo(() => {
    const l = normalizeLegitId(legit);
    const em = normalizeEmailValue(email);
    const tel = normalizePhoneValue(telefon);
    return jurnalisti.filter((j) => {
      const jl = normalizeLegitId(String(j.legit || ""));
      const je = normalizeEmailValue(String(j.email || ""));
      const jt = normalizePhoneValue(String(j.telefon || ""));
      return (l && jl === l) || (em && je === em) || (tel && jt === tel);
    });
  }, [jurnalisti, legit, email, telefon]);

  function applyJurnalist(j: JurnalistRecord) {
    setSelectedJurnalistId(j.id);
    setNume(String(j.nume || ""));
    setEmail(String(j.email || ""));
    setTelefon(String(j.telefon || ""));
    setRedactie(String(j.redactie || ""));
    setLegit(String(j.legit || ""));
  }

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
    setSex(prefill.sex === "M" ? "M" : "F");
    setLegit(prefill.legit || "");
    setRedactie(prefill.redactie || "");
    setEmail(prefill.email || "");
    setTelefon(prefill.telefon || "");
    if (prefill.dataIso) setDataIso(prefill.dataIso);
    if (prefill.numar) setNumarText(prefill.numar);
  }, [prefillKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = String(existingAcreditareId || "").trim();
      if (!id) return;
      try {
        const { judetId, structuraId } = getTenantContext();
        const ref = doc(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Acreditari", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const d = snap.data() as any;
        if (!alive) return;
        setLoadedAcreditareId(id);
        setNume(String(d?.nume || ""));
        setSex(String(d?.sex || "").toUpperCase() === "M" ? "M" : "F");
        setLegit(String(d?.legit || ""));
        setOriginalLegit(String(d?.legit || ""));
        setRedactie(String(d?.redactie || ""));
        setEmail(String(d?.email || ""));
        setTelefon(String(d?.telefon || ""));
        setNumarText(String(parseAcreditareNumar(d?.numar) ?? d?.numar ?? ""));

        // Try to convert stored DD/MM/YYYY to ISO for the date input.
        const rawDate = String(d?.data || "").trim();
        const m = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) setDataIso(`${m[3]}-${m[2]}-${m[1]}`);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [db, existingAcreditareId]);

  function normalizePhoneForTel(v?: string): string {
    const s = String(v || "").trim();
    if (!s) return "";
    return s.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setMsg(null);

    const nn = nume.trim();
    const sx = sex;
    const lg = legit.trim();
    const rd = redactie.trim();
    const em = email.trim();
    const tel = telefon.trim();
    const chosenNumar = parseAcreditareNumar(numarText);

    if (!nn || !sx || !lg || !rd || !em || !chosenNumar) {
      setMsg("Completează toate câmpurile.");
      return;
    }

    if (jurnalistiMatches.length > 0) {
      const matchIds = new Set(jurnalistiMatches.map((j) => j.id));
      if (!selectedJurnalistId || !matchIds.has(selectedJurnalistId)) {
        alert("Există jurnalist(e) în baza de date cu aceeași legitimație/email/telefon. Te rog selectează jurnalistul corect din listă înainte de salvare.");
        return;
      }
    }

    const { judetId, structuraId } = getTenantContext();
    const currentKey = `${String(judetId || "").toUpperCase()}_${String(structuraId || "").toUpperCase()}`;
    const dataLabel = ddmmyyyySlashFromIso(dataIso);
    const nowTs = serverTimestamp();
    const now = new Date();
    const yearFromIso = (() => {
      const m = String(dataIso || "").match(/^(\d{4})-/);
      return m ? Number(m[1]) : now.getFullYear();
    })();

    try {
      setSaving(true);
      // If editing an existing cerere, update it instead of creating a new one.
      if (existingCerereId) {
        const okEdit = confirm("Sigur vrei să actualizezi această cerere?");
        if (!okEdit) return;
        const cerereRef = doc(db, "CereriAcreditare", existingCerereId);
        const numarFormatted = String(chosenNumar);
        await updateDoc(cerereRef, {
          "acreditare.numar": numarFormatted,
          "acreditare.data": dataLabel || null,
          "media.denumire": rd,
          "jurnalist.numePrenume": nn,
          "jurnalist.sex": sx,
          "jurnalist.legitimatie.numar": lg,
          "jurnalist.email": em,
          "jurnalist.telefon.mobil": tel,
          updatedAt: nowTs,
        } as any);
        try {
          const jurnalistId = computeJurnalistId();
          const jurnalistRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${jurnalistId}`);
          await setDoc(
            jurnalistRef,
            {
              nume: nn,
              email: em,
              telefon: tel,
              legit: lg,
              redactie: rd,
              lastAcreditareYear: yearFromIso,
              lastAcreditareNumar: numarFormatted,
              updatedAt: nowTs,
              createdAt: nowTs,
            },
            { merge: true }
          );
          if (selectedJurnalistId && jurnalistId !== selectedJurnalistId) {
            try {
              await deleteDoc(doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${selectedJurnalistId}`));
            } catch {}
          }
        } catch {}
        setMsg("Cererea a fost actualizată.");
        return;
      }

      if (loadedAcreditareId) {
        const ok = confirm("Sigur vrei să actualizezi această acreditare? Modificările vor actualiza și datele jurnalistului.");
        if (!ok) return;
        // Edit existing Acreditare (already approved / issued)
        const numarFormatted = String(chosenNumar);
        const acrRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Acreditari/${loadedAcreditareId}`);
        await updateDoc(acrRef, {
          numar: numarFormatted,
          data: dataLabel || null,
          dataTimestamp: nowTs,
          nume: nn,
          sex: sx,
          legit: lg,
          redactie: rd,
          email: em,
          telefon: tel,
          updatedAt: nowTs,
        } as any);

        // Keep Jurnalisti in sync (including phone)
        const prevJId = normalizeLegitId(originalLegit) || loadedAcreditareId;
        const nextJId = normalizeLegitId(lg) || loadedAcreditareId;
        const jurnalistRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${nextJId}`);
        await setDoc(
          jurnalistRef,
          {
            nume: nn,
            email: em,
            telefon: tel,
            legit: lg,
            redactie: rd,
            lastAcreditareYear: yearFromIso,
            lastAcreditareNumar: numarFormatted,
            updatedAt: nowTs,
            createdAt: nowTs,
          },
          { merge: true }
        );
        if (prevJId && prevJId !== nextJId) {
          // best-effort: remove old id if legit changed
          try {
            await deleteDoc(doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${prevJId}`));
          } catch {}
          setOriginalLegit(lg);
        }

        setMsg("Acreditarea a fost actualizată. Datele jurnalistului au fost sincronizate.");
        return;
      }

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

      const okCreate = confirm("Sigur vrei să salvezi această cerere de acreditare?");
      if (!okCreate) return;

      // Upsert Jurnalist in structura (so it appears in /acreditari/jurnalisti)
      try {
        const jurnalistId = computeJurnalistId();
        const jurnalistRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${jurnalistId}`);
        await setDoc(
          jurnalistRef,
          {
            nume: nn,
            email: em,
            telefon: tel,
            legit: lg,
            redactie: rd,
            lastAcreditareYear: yearFromIso,
            lastAcreditareNumar: numarFormatted,
            updatedAt: nowTs,
            createdAt: nowTs,
          },
          { merge: true }
        );
        if (selectedJurnalistId && jurnalistId !== selectedJurnalistId) {
          try {
            await deleteDoc(doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${selectedJurnalistId}`));
          } catch {}
        }
      } catch {}

      // Create CereriAcreditare in the SAME schema as complex form (minimal fields)
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
          telefon: { fix: "", fax: "", mobil: tel },
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

        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
              <Users size={16} className="text-gray-600" />
              Caută jurnalist existent
            </div>
            {jurnalistiLoading && (
              <div className="text-xs text-gray-500 inline-flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Se încarcă baza de jurnaliști...
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={jurnalistiSearch}
                onChange={(e) => setJurnalistiSearch(e.target.value)}
                placeholder="Caută nume, email, telefon, redacție, legitimație..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
              />
            </div>
            {selectedJurnalistId && (
              <button
                type="button"
                onClick={() => setSelectedJurnalistId(null)}
                className="inline-flex items-center gap-1 px-2 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-white"
                title="Deselectează"
              >
                <X size={12} />
                Deselectează
              </button>
            )}
          </div>
          {jurnalistiSearch.trim() && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {jurnalistiFiltered.length === 0 ? (
                <div className="text-xs text-gray-500">Niciun jurnalist găsit.</div>
              ) : (
                jurnalistiFiltered.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => applyJurnalist(j)}
                    className={`text-left px-3 py-2 rounded-lg border ${
                      selectedJurnalistId === j.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">{j.nume || "—"}</div>
                    <div className="text-xs text-gray-600">{j.redactie || "—"}</div>
                    <div className="text-xs text-gray-500">{[j.email, j.telefon, j.legit].filter(Boolean).join(" • ") || "—"}</div>
                  </button>
                ))
              )}
            </div>
          )}
          {selectedJurnalistId && (
            <div className="mt-3 text-xs text-gray-600">Jurnalist selectat: {selectedJurnalistId}</div>
          )}
          {!selectedJurnalistId && jurnalistiMatches.length > 0 && (
            <div className="mt-3 text-xs text-amber-700">
              Atenție: există jurnalist(e) care se potrivesc după legitimație/email/telefon. Selectează jurnalistul corect înainte de salvare.
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
                {jurnalistiMatches.slice(0, 8).map((j) => (
                  <div key={j.id} className="px-2 py-1 rounded border border-amber-200 bg-amber-50 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-amber-900">{j.nume || "—"}</div>
                      <div className="text-amber-800">{[j.email, j.telefon, j.legit].filter(Boolean).join(" • ") || "—"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyJurnalist(j)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 text-xs"
                    >
                      Selectează
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon jurnalist (mobil)</label>
            <input
              type="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="Ex: 07xx xxx xxx"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">Opțional. Se afișează în lista „Jurnaliști” cu buton de apelare.</div>
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
            {saving ? "Se salvează..." : loadedAcreditareId ? "Actualizează acreditarea" : existingCerereId ? "Actualizează cererea" : "Salvează cererea"}
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
  const [editAcreditareId, setEditAcreditareId] = useState<string | null>(null);
  const [simplePrefill, setSimplePrefill] = useState<{
    nume?: string;
    legit?: string;
    redactie?: string;
    email?: string;
    telefon?: string;
    sex?: "F" | "M";
    dataIso?: string;
    numar?: string;
  } | null>(null);
  const [simplePrefillKey, setSimplePrefillKey] = useState(0);

  // Allow deep-linking: /acreditari/creaza?tab=cerere&cerereId=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const cerereId = (url.searchParams.get("cerereId") || "").trim();
      const acreditareId = (url.searchParams.get("edit") || "").trim();
      const tab = (url.searchParams.get("tab") || "").trim();
      if (tab === "simplu") setActiveTab("simplu");
      if (tab === "cerere") setActiveTab("cerere");
      if (acreditareId) {
        setEditAcreditareId(acreditareId);
        setActiveTab("simplu");
      }
      if (cerereId) {
        setEditCerereId(cerereId);
        // For edit view, start on Completare simplă
        setActiveTab("simplu");
        }
      } catch {}
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!editCerereId) return;
      try {
        const ref = doc(db, "CereriAcreditare", editCerereId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const d = snap.data() as any;
        if (!alive) return;
        const acreditareNumar = String(d?.acreditare?.numar || "").trim();
        const acreditareData = String(d?.acreditare?.data || "").trim();
        const dataIso = isoFromDdMmYyyy(acreditareData);
        const sex = String(d?.jurnalist?.sex || "").toUpperCase() === "M" ? "M" : "F";
        setSimplePrefill({
          nume: String(d?.jurnalist?.numePrenume || ""),
          legit: String(d?.jurnalist?.legitimatie?.numar || ""),
          redactie: String(d?.media?.denumire || ""),
          email: String(d?.jurnalist?.email || ""),
          telefon: String(d?.jurnalist?.telefon?.mobil || ""),
          sex,
          dataIso: dataIso && /^\d{4}-\d{2}-\d{2}$/.test(dataIso) ? dataIso : undefined,
          numar: acreditareNumar || undefined,
        });
        setSimplePrefillKey((k) => k + 1);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [db, editCerereId]);

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
            prefill={simplePrefill}
            prefillKey={simplePrefillKey}
            existingAcreditareId={editAcreditareId}
            existingCerereId={editCerereId}
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
