"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import { initFirebase } from "@/lib/firebase";
import { JUDETE, getStructuriForJudet } from "@/lib/judete";
import { GDPR_NOTE_TEXT } from "./gdpr-note";
import { SignaturePad } from "./components/SignaturePad";
import { StructuraOption, StructuriMultiSelect } from "./components/StructuriMultiSelect";

const MAX_UPLOAD_MB = 15;

type MediaTypeKey = "presaScrisa" | "tv" | "radio" | "agentie" | "online" | "altceva";
type FunctionKey = "redactor" | "reporter" | "fotoreporter" | "cameraman" | "tehnician" | "altceva";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function keyToParts(key: string): { judetId: string; structuraId: string } | null {
  const m = key.match(/^([A-Z]{1,2})_([A-Z0-9]+)$/i);
  if (!m) return null;
  return { judetId: m[1].toUpperCase(), structuraId: m[2].toUpperCase() };
}

function buildLabel(judetId: string, structuraId: string) {
  const jud = JUDETE.find((j) => j.id === judetId)?.name || judetId;
  return `${structuraId} ${jud}`;
}

function bytesToMb(n: number) {
  return Math.round((n / 1024 / 1024) * 10) / 10;
}

export default function PublicAcreditarePage() {
  const { db, app } = initFirebase();
  const storage = getStorage(app);

  const [options, setOptions] = useState<StructuraOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [selectedStructKeys, setSelectedStructKeys] = useState<string[]>([]);

  // Date instituție media
  const [mediaTypes, setMediaTypes] = useState<Record<MediaTypeKey, boolean>>({
    presaScrisa: false,
    tv: false,
    radio: false,
    agentie: false,
    online: false,
    altceva: false,
  });
  const [mediaAltceva, setMediaAltceva] = useState("");
  const [institutieDenumire, setInstitutieDenumire] = useState("");
  const [institutieCui, setInstitutieCui] = useState("");
  const [institutieAdresa, setInstitutieAdresa] = useState("");
  const [institutieEmail, setInstitutieEmail] = useState("");
  const [institutieTelefonFix, setInstitutieTelefonFix] = useState("");
  const [institutieTelefonFax, setInstitutieTelefonFax] = useState("");
  const [institutieTelefonMobil, setInstitutieTelefonMobil] = useState("");
  const [institutieWebsite, setInstitutieWebsite] = useState("");

  // Date personale jurnalist
  const [numePrenume, setNumePrenume] = useState("");
  const [dataNasterii, setDataNasterii] = useState("");
  const [locNastere, setLocNastere] = useState("");
  const [cetatenie, setCetatenie] = useState("Română");
  const [tipDocIdentitate, setTipDocIdentitate] = useState("CI");
  const [serieNumarDoc, setSerieNumarDoc] = useState("");
  const [adresaOptional, setAdresaOptional] = useState("");
  const [nrLegitimatie, setNrLegitimatie] = useState("");
  const [dataExpirareLegit, setDataExpirareLegit] = useState("");
  const [functii, setFunctii] = useState<Record<FunctionKey, boolean>>({
    redactor: false,
    reporter: false,
    fotoreporter: false,
    cameraman: false,
    tehnician: false,
    altceva: false,
  });
  const [functieAltceva, setFunctieAltceva] = useState("");
  const [jurnalistEmail, setJurnalistEmail] = useState("");
  const [jurnalistTelefonFix, setJurnalistTelefonFix] = useState("");
  const [jurnalistTelefonFax, setJurnalistTelefonFax] = useState("");
  const [jurnalistTelefonMobil, setJurnalistTelefonMobil] = useState("");

  // Upload + semnătură
  const [legitimatieFile, setLegitimatieFile] = useState<File | null>(null);
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);

  // Consimțăminte
  const [consimtamantNorme, setConsimtamantNorme] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [showGdpr, setShowGdpr] = useState(false);

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Load available structuri that have an owner doc
  useEffect(() => {
    let alive = true;
    (async () => {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const candidates: { judetId: string; structuraId: string }[] = [];
        for (const j of JUDETE) {
          const structs = getStructuriForJudet(j.id);
          for (const s of structs) candidates.push({ judetId: j.id, structuraId: String(s) });
        }
        const results = await Promise.all(
          candidates.map(async ({ judetId, structuraId }) => {
            try {
              const ownerRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/owner`);
              const snap = await getDoc(ownerRef);
              if (!snap.exists()) return null;
              const key = `${judetId}_${structuraId}`;
              return {
                key,
                judetId,
                structuraId,
                label: buildLabel(judetId, structuraId),
              } as StructuraOption;
            } catch {
              return null;
            }
          })
        );
        const list = results.filter(Boolean) as StructuraOption[];
        list.sort((a, b) => a.label.localeCompare(b.label, "ro"));
        if (!alive) return;
        setOptions(list);
      } catch {
        if (!alive) return;
        setOptionsError("Nu am putut încărca lista structurilor. Încercați din nou.");
        setOptions([]);
      } finally {
        if (!alive) return;
        setOptionsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  // Preselect from query param: ?structuri=DB:ISU,AG:IPJ
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const s = url.searchParams.get("structuri") || "";
    if (!s) return;
    const parsed = s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => x.replace(":", "_").toUpperCase());
    if (parsed.length) setSelectedStructKeys(Array.from(new Set(parsed)));
  }, []);

  const selectedStructuri = useMemo(() => {
    const set = new Set(selectedStructKeys);
    const byKey = new Map(options.map((o) => [o.key, o]));
    const resolved = selectedStructKeys.map((k) => byKey.get(k)).filter(Boolean) as StructuraOption[];
    // allow selected keys even if options list isn't loaded yet (will validate on submit)
    const unresolved = Array.from(set)
      .filter((k) => !byKey.has(k))
      .map((k) => {
        const p = keyToParts(k);
        if (!p) return null;
        return { key: k, ...p, label: buildLabel(p.judetId, p.structuraId) } as StructuraOption;
      })
      .filter(Boolean) as StructuraOption[];
    return [...resolved, ...unresolved];
  }, [options, selectedStructKeys]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (selectedStructKeys.length === 0) return false;
    if (!institutieDenumire.trim()) return false;
    if (!numePrenume.trim()) return false;
    if (!nrLegitimatie.trim()) return false;
    if (!legitimatieFile) return false;
    if (!signatureBlob) return false;
    if (!consimtamantNorme) return false;
    if (!gdprAccepted) return false;
    return true;
  }, [
    submitting,
    selectedStructKeys,
    institutieDenumire,
    numePrenume,
    nrLegitimatie,
    legitimatieFile,
    signatureBlob,
    consimtamantNorme,
    gdprAccepted,
  ]);

  const onPickLegitimatie = (f: File | null) => {
    setSubmitError(null);
    if (!f) {
      setLegitimatieFile(null);
      return;
    }
    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
    if (f.size > maxBytes) {
      setLegitimatieFile(null);
      setSubmitError(`Fișierul este prea mare (${bytesToMb(f.size)} MB). Maxim ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    const okTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!okTypes.includes(f.type)) {
      setLegitimatieFile(null);
      setSubmitError("Tip fișier neacceptat. Acceptăm PDF / PNG / JPG.");
      return;
    }
    setLegitimatieFile(f);
  };

  const toggleMedia = (k: MediaTypeKey) => setMediaTypes((m) => ({ ...m, [k]: !m[k] }));
  const toggleFunctie = (k: FunctionKey) => setFunctii((m) => ({ ...m, [k]: !m[k] }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Validate that selected structuri exist in loaded options (best-effort)
      const optionKeys = new Set(options.map((o) => o.key));
      const unknown = selectedStructKeys.filter((k) => options.length > 0 && !optionKeys.has(k));
      if (unknown.length) {
        throw new Error("Structuri invalide selectate. Vă rugăm reîncercați.");
      }

      const statusByStructura: Record<string, any> = {};
      for (const k of selectedStructKeys) statusByStructura[k] = { status: "pending" };

      const structuriPayload = selectedStructuri.map((s) => ({
        judetId: s.judetId,
        structuraId: s.structuraId,
        display: s.label,
      }));

      const payload: any = {
        structuri: structuriPayload,
        structuraKeys: selectedStructKeys,
        statusByStructura,
        createdAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
        // Date instituție media
        media: {
          tip: mediaTypes,
          tipAltceva: mediaAltceva.trim(),
          denumire: institutieDenumire.trim(),
          cui: institutieCui.trim(),
          adresa: institutieAdresa.trim(),
          email: institutieEmail.trim(),
          telefon: { fix: institutieTelefonFix.trim(), fax: institutieTelefonFax.trim(), mobil: institutieTelefonMobil.trim() },
          website: institutieWebsite.trim(),
        },
        // Date jurnalist
        jurnalist: {
          numePrenume: numePrenume.trim(),
          dataNasterii: dataNasterii || null,
          locNastere: locNastere.trim(),
          cetatenie: cetatenie.trim(),
          documentIdentitate: { tip: tipDocIdentitate.trim(), serieNumar: serieNumarDoc.trim() },
          adresa: adresaOptional.trim(),
          legitimatie: { numar: nrLegitimatie.trim(), dataExpirare: dataExpirareLegit || null },
          functie: { ...functii, altcevaText: functieAltceva.trim() },
          email: jurnalistEmail.trim(),
          telefon: { fix: jurnalistTelefonFix.trim(), fax: jurnalistTelefonFax.trim(), mobil: jurnalistTelefonMobil.trim() },
        },
        consimtamant: {
          norme: consimtamantNorme,
          gdpr: gdprAccepted,
          gdprVersion: "v1",
          gdprAcceptedAt: serverTimestamp(),
        },
        attachments: null,
      };

      const cereriRef = collection(db, "CereriAcreditare");
      const created = await addDoc(cereriRef, payload);

      // Upload attachments (paths only; avoid public token URLs)
      const cerereId = created.id;
      const legit = legitimatieFile!;
      const legitExt = (legit.name.split(".").pop() || "").toLowerCase();
      const legitPath = `cereri-acreditare/${cerereId}/legitimatie.${legitExt || "bin"}`;
      const sigPath = `cereri-acreditare/${cerereId}/semnatura.png`;

      const legitRef = storageRef(storage, legitPath);
      await uploadBytes(legitRef, legit, { contentType: legit.type || undefined });

      const sigRef = storageRef(storage, sigPath);
      await uploadBytes(sigRef, signatureBlob!, { contentType: "image/png" });

      // (Optional sanity) Verify that authed reads would work; don't store URL
      try {
        await getDownloadURL(legitRef);
        await getDownloadURL(sigRef);
      } catch {}

      await updateDoc(doc(db, "CereriAcreditare", cerereId), {
        attachments: {
          legitimatie: { path: legitPath, name: legit.name, contentType: legit.type, size: legit.size },
          semnatura: { path: sigPath, contentType: "image/png" },
        },
        attachmentsUploadedAt: serverTimestamp(),
      });

      setSuccessId(cerereId);
      // reset minimal
      setSubmitting(false);
    } catch (err: any) {
      setSubmitting(false);
      setSubmitError(typeof err?.message === "string" ? err.message : "Eroare la trimiterea cererii.");
    }
  }

  if (successId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="rounded-3xl border border-emerald-200 bg-white shadow-xl p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center">
                <svg className="w-7 h-7 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">Cererea a fost trimisă</h1>
                <p className="text-gray-600 mt-1">
                  Cererea ta a fost înregistrată și va fi analizată de structurile selectate.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-sm text-gray-600">ID cerere:</span>
                  <span className="text-sm font-mono text-gray-900">{successId}</span>
                </div>
                <div className="mt-6 text-sm text-gray-600">
                  Dacă ai nevoie de suport, contactează structura selectată.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold">IRP</span>
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900">Cerere acreditare (formular electronic)</div>
              <div className="text-sm text-gray-600 mt-1">
                Completează datele exact ca în formularul tipizat. Câmpurile marcate sunt obligatorii.
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700">
                <span className="font-semibold">Data</span>
                <span className="font-mono">{todayYMD()}</span>
              </div>
            </div>
          </div>
        </div>

        <StructuriMultiSelect
          options={options}
          selectedKeys={selectedStructKeys}
          onChange={setSelectedStructKeys}
          disabled={optionsLoading}
        />
        {optionsError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
            {optionsError}
          </div>
        )}
        {optionsLoading && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-4 text-sm text-gray-600">
            Se încarcă lista structurilor...
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Date instituție media */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900">Date instituție media</div>
              <div className="text-xs text-gray-600">Completează datele instituției mass-media.</div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Tip media</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {[
                    ["presaScrisa", "Presă scrisă"] as const,
                    ["tv", "TV"] as const,
                    ["radio", "Radio"] as const,
                    ["agentie", "Agenție de presă"] as const,
                    ["online", "Online"] as const,
                    ["altceva", "Altceva"] as const,
                  ].map(([k, label]) => (
                    <label key={k} className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!mediaTypes[k]} onChange={() => toggleMedia(k)} className="w-4 h-4" />
                      <span className="text-gray-800">{label}</span>
                    </label>
                  ))}
                </div>
                {mediaTypes.altceva && (
                  <div className="mt-3">
                    <input
                      value={mediaAltceva}
                      onChange={(e) => setMediaAltceva(e.target.value)}
                      placeholder="Altceva (de specificat)"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Denumirea instituției / CUI <span className="text-red-600">*</span>
                  </label>
                  <input
                    value={institutieDenumire}
                    onChange={(e) => setInstitutieDenumire(e.target.value)}
                    placeholder="Denumirea instituției"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="mt-2">
                    <input
                      value={institutieCui}
                      onChange={(e) => setInstitutieCui(e.target.value)}
                      placeholder="CUI (opțional)"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adresa instituției</label>
                  <input
                    value={institutieAdresa}
                    onChange={(e) => setInstitutieAdresa(e.target.value)}
                    placeholder="Adresă"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="mt-2">
                    <input
                      value={institutieEmail}
                      onChange={(e) => setInstitutieEmail(e.target.value)}
                      placeholder="E-mail (opțional)"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon (Fix)</label>
                  <input value={institutieTelefonFix} onChange={(e) => setInstitutieTelefonFix(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fax</label>
                  <input value={institutieTelefonFax} onChange={(e) => setInstitutieTelefonFax(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobil</label>
                  <input value={institutieTelefonMobil} onChange={(e) => setInstitutieTelefonMobil(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                <input
                  value={institutieWebsite}
                  onChange={(e) => setInstitutieWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Date personale jurnalist */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900">Date personale jurnalist</div>
              <div className="text-xs text-gray-600">Completează datele jurnalistului.</div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nume și prenume <span className="text-red-600">*</span>
                </label>
                <input
                  value={numePrenume}
                  onChange={(e) => setNumePrenume(e.target.value)}
                  placeholder="Nume Prenume"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data nașterii</label>
                  <input
                    type="date"
                    value={dataNasterii}
                    onChange={(e) => setDataNasterii(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Locul nașterii</label>
                  <input
                    value={locNastere}
                    onChange={(e) => setLocNastere(e.target.value)}
                    placeholder="Localitate / Județ"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cetățenia</label>
                  <input value={cetatenie} onChange={(e) => setCetatenie(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tip document</label>
                  <div className="flex gap-2">
                    <select value={tipDocIdentitate} onChange={(e) => setTipDocIdentitate(e.target.value)} className="border border-gray-300 rounded-xl px-3 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option>CI</option>
                      <option>Pașaport</option>
                      <option>Permis</option>
                      <option>Altul</option>
                    </select>
                    <input value={serieNumarDoc} onChange={(e) => setSerieNumarDoc(e.target.value)} placeholder="Serie și număr" className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adresa (opțional)</label>
                <input value={adresaOptional} onChange={(e) => setAdresaOptional(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nr. legitimație de presă <span className="text-red-600">*</span>
                  </label>
                  <input value={nrLegitimatie} onChange={(e) => setNrLegitimatie(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data expirării legitimației</label>
                  <input type="date" value={dataExpirareLegit} onChange={(e) => setDataExpirareLegit(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Funcția</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {[
                    ["redactor", "Redactor"] as const,
                    ["reporter", "Reporter"] as const,
                    ["fotoreporter", "Fotoreporter"] as const,
                    ["cameraman", "Cameraman"] as const,
                    ["tehnician", "Tehnician"] as const,
                    ["altceva", "Altceva"] as const,
                  ].map(([k, label]) => (
                    <label key={k} className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!functii[k]} onChange={() => toggleFunctie(k)} className="w-4 h-4" />
                      <span className="text-gray-800">{label}</span>
                    </label>
                  ))}
                </div>
                {functii.altceva && (
                  <div className="mt-3">
                    <input
                      value={functieAltceva}
                      onChange={(e) => setFunctieAltceva(e.target.value)}
                      placeholder="Altceva (de specificat)"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                  <input type="email" value={jurnalistEmail} onChange={(e) => setJurnalistEmail(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nr. de telefon (Mobil)</label>
                  <input value={jurnalistTelefonMobil} onChange={(e) => setJurnalistTelefonMobil(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon (Fix)</label>
                  <input value={jurnalistTelefonFix} onChange={(e) => setJurnalistTelefonFix(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fax</label>
                  <input value={jurnalistTelefonFax} onChange={(e) => setJurnalistTelefonFax(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Upload legitimație */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900">
                Legitimație de presă <span className="text-red-600">*</span>
              </div>
              <div className="text-xs text-gray-600">Încarcă fotografia/scanarea legitimației (PDF/JPG/PNG).</div>
            </div>
            <div className="p-6 space-y-3">
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={(e) => onPickLegitimatie(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {legitimatieFile && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{legitimatieFile.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{bytesToMb(legitimatieFile.size)} MB</div>
                  </div>
                  <button type="button" onClick={() => setLegitimatieFile(null)} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white text-sm">
                    Elimină
                  </button>
                </div>
              )}
              <div className="text-xs text-gray-500">Maxim {MAX_UPLOAD_MB} MB.</div>
            </div>
          </div>

          <SignaturePad valuePngBlob={signatureBlob} onChange={setSignatureBlob} />

          {/* Consimțăminte */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900">Declarații și informare</div>
              <div className="text-xs text-gray-600">Bifează pentru a continua.</div>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={consimtamantNorme} onChange={(e) => setConsimtamantNorme(e.target.checked)} className="mt-1 w-4 h-4" />
                <span className="text-sm text-gray-800">
                  Consimt să respect normele privind accesul și conduita pe timpul prezenței la activitățile organizate de structură.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={gdprAccepted} onChange={(e) => setGdprAccepted(e.target.checked)} className="mt-1 w-4 h-4" />
                <span className="text-sm text-gray-800">
                  Am citit și am înțeles <button type="button" className="text-blue-700 hover:underline" onClick={() => setShowGdpr(true)}>Nota de informare GDPR</button>.
                </span>
              </label>
            </div>
          </div>

          {submitError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
              {submitError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              Câmpuri obligatorii: Structuri, Denumire instituție, Nume, Nr. legitimație, Upload legitimație, Semnătură, Consimțăminte.
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg transition-colors ${
                canSubmit ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Se trimite...
                </>
              ) : (
                "Trimite cererea"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* GDPR Modal */}
      {showGdpr && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGdpr(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Notă de informare GDPR</div>
                  <div className="text-xs text-gray-600">Text integral</div>
                </div>
                <button type="button" onClick={() => setShowGdpr(false)} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm">
                  Închide
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-auto">
                <div className="text-xs text-gray-900 whitespace-pre-wrap leading-relaxed">{GDPR_NOTE_TEXT}</div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setGdprAccepted(true); setShowGdpr(false); }}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Am citit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


