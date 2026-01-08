"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import { initFirebase } from "@/lib/firebase";
import { JUDETE, getStructuriForJudet } from "@/lib/judete";
import { GDPR_NOTE_TEXT } from "../gdpr-note";
import { SignaturePad } from "./SignaturePad";
import { StructuraOption, StructuriMultiSelect } from "./StructuriMultiSelect";

const MAX_UPLOAD_MB = 15;
const MAX_LEGIT_FILES = 2;

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

function ddmmyyyySlashFromIso(iso: string) {
  const s = String(iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseAcreditareNumar(v: any): number | null {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  // legacy dotted format
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return null;
}

function digitsOnly(v: any): string {
  return String(v || "").replace(/\D+/g, "");
}

export type CerereAcreditareFormMode = "public" | "admin_single_structura";

export type CerereAcreditarePrefill = {
  // Media
  mediaTypes?: Record<MediaTypeKey, boolean>;
  mediaAltceva?: string;
  institutieDenumire?: string;
  institutieCui?: string;
  institutieAdresa?: string;
  institutieEmail?: string;
  institutieTelefonFix?: string;
  institutieTelefonFax?: string;
  institutieTelefonMobil?: string;
  institutieWebsite?: string;
  // Jurnalist
  numePrenume?: string;
  dataNasterii?: string;
  locNastere?: string;
  cetatenie?: string;
  tipDocIdentitate?: string;
  serieNumarDoc?: string;
  adresaOptional?: string;
  nrLegitimatie?: string;
  dataExpirareLegit?: string;
  functii?: Record<FunctionKey, boolean>;
  functieAltceva?: string;
  jurnalistEmail?: string;
  jurnalistTelefonFix?: string;
  jurnalistTelefonFax?: string;
  jurnalistTelefonMobil?: string;
};

type Props = {
  mode: CerereAcreditareFormMode;
  /** For admin_single_structura: required key like DB_ISU */
  fixedStructuraKey?: string;
  /** When set, the form loads and updates an existing CereriAcreditare document instead of creating a new one. */
  existingCerereId?: string;
  /** Optional prefill (applied when prefillKey changes) */
  prefill?: CerereAcreditarePrefill | null;
  prefillKey?: string | number;
  onSubmitted?: (id: string) => void;
  title?: string;
  description?: string;
};

export function CerereAcreditareForm({
  mode,
  fixedStructuraKey,
  existingCerereId,
  prefill,
  prefillKey,
  onSubmitted,
  title = "Cerere acreditare (formular electronic)",
  description = "Completează datele exact ca în formularul tipizat. Câmpurile marcate sunt obligatorii.",
}: Props) {
  const { db, app } = initFirebase();
  const storage = getStorage(app);

  const isAdminSingle = mode === "admin_single_structura";

  const [options, setOptions] = useState<StructuraOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
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
  const [sex, setSex] = useState<"F" | "M">("F");
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
  const [legitimatieFiles, setLegitimatieFiles] = useState<File[]>([]);
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);

  // Consimțăminte
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [showGdpr, setShowGdpr] = useState(false);

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [loadedExistingId, setLoadedExistingId] = useState<string | null>(null);
  const [existingDoc, setExistingDoc] = useState<any | null>(null);

  // Admin: număr + dată acreditare (obligatorii pentru emitere certificat)
  const [acrDateIso, setAcrDateIso] = useState<string>(todayYMD());
  const [acrFixedNumar, setAcrFixedNumar] = useState<string>("");
  const [acrManualEdit, setAcrManualEdit] = useState(false);
  const [acrManualDigits, setAcrManualDigits] = useState<string>("");
  const [acrNextNumar, setAcrNextNumar] = useState<number | null>(null);
  const [acrNumarLoading, setAcrNumarLoading] = useState(false);
  const [acrNumarNeedsInit, setAcrNumarNeedsInit] = useState(false);
  const [acrMaxFromDocs, setAcrMaxFromDocs] = useState(0);
  const [acrStartNumarText, setAcrStartNumarText] = useState("");

  // Apply fixed structura (admin)
  useEffect(() => {
    if (!isAdminSingle) return;
    if (!fixedStructuraKey) return;
    setSelectedStructKeys([fixedStructuraKey.toUpperCase().replace(":", "_")]);
  }, [isAdminSingle, fixedStructuraKey]);

  // Load existing cerere (edit mode)
  useEffect(() => {
    if (!existingCerereId) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "CereriAcreditare", existingCerereId));
        if (!alive) return;
        if (!snap.exists()) {
          setSubmitError("Cererea selectată nu există sau nu poate fi citită.");
          return;
        }
        const d = snap.data() as any;
        setExistingDoc(d);
        setLoadedExistingId(existingCerereId);

        // Structuri (public only). Admin-single keeps fixed struct.
        if (!isAdminSingle) {
          const keys = Array.isArray(d?.structuraKeys) ? d.structuraKeys.map((x: any) => String(x).toUpperCase()) : [];
          if (keys.length) setSelectedStructKeys(keys);
        }

        // Media
        const tip = (d?.media?.tip || {}) as any;
        setMediaTypes((prev) => ({ ...prev, ...tip }));
        setMediaAltceva(String(d?.media?.tipAltceva || ""));
        setInstitutieDenumire(String(d?.media?.denumire || ""));
        setInstitutieCui(String(d?.media?.cui || ""));
        setInstitutieAdresa(String(d?.media?.adresa || ""));
        setInstitutieEmail(String(d?.media?.email || ""));
        setInstitutieTelefonFix(String(d?.media?.telefon?.fix || ""));
        setInstitutieTelefonFax(String(d?.media?.telefon?.fax || ""));
        setInstitutieTelefonMobil(String(d?.media?.telefon?.mobil || ""));
        setInstitutieWebsite(String(d?.media?.website || ""));

        // Jurnalist
        setNumePrenume(String(d?.jurnalist?.numePrenume || ""));
        setSex(String(d?.jurnalist?.sex || "F").toUpperCase() === "M" ? "M" : "F");
        setDataNasterii(String(d?.jurnalist?.dataNasterii || "") || "");
        setLocNastere(String(d?.jurnalist?.locNastere || ""));
        setCetatenie(String(d?.jurnalist?.cetatenie || "Română"));
        setTipDocIdentitate(String(d?.jurnalist?.documentIdentitate?.tip || "CI"));
        setSerieNumarDoc(String(d?.jurnalist?.documentIdentitate?.serieNumar || ""));
        setAdresaOptional(String(d?.jurnalist?.adresa || ""));
        setNrLegitimatie(String(d?.jurnalist?.legitimatie?.numar || ""));
        setDataExpirareLegit(String(d?.jurnalist?.legitimatie?.dataExpirare || "") || "");
        const fn = (d?.jurnalist?.functie || {}) as any;
        setFunctii((prev) => ({ ...prev, ...fn }));
        setFunctieAltceva(String(fn?.altcevaText || ""));
        setJurnalistEmail(String(d?.jurnalist?.email || ""));
        setJurnalistTelefonFix(String(d?.jurnalist?.telefon?.fix || ""));
        setJurnalistTelefonFax(String(d?.jurnalist?.telefon?.fax || ""));
        setJurnalistTelefonMobil(String(d?.jurnalist?.telefon?.mobil || ""));

        // GDPR (admin-single is implicit)
        if (!isAdminSingle) setGdprAccepted(!!d?.consimtamant?.gdpr);

        // Acreditare draft (admin)
        if (isAdminSingle) {
          const an = String(d?.acreditare?.numar || "").trim();
          const ad = String(d?.acreditare?.data || "").trim();
          if (an) setAcrFixedNumar(an);
          if (an) setAcrManualDigits(digitsOnly(an));
          if (ad) {
            const m = ad.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (m) setAcrDateIso(`${m[3]}-${m[2]}-${m[1]}`);
          }
        }
      } catch {
        if (!alive) return;
        setSubmitError("Nu am putut încărca cererea pentru editare.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, existingCerereId, isAdminSingle]);

  // Admin: GDPR consent is handled by the institution (no user-facing consent UI here)
  useEffect(() => {
    if (!isAdminSingle) return;
    setGdprAccepted(true);
    setShowGdpr(false);
  }, [isAdminSingle]);

  async function computeAcreditareNumarPreview() {
    if (!isAdminSingle) return;
    if (acrNumarLoading) return;
    if (acrFixedNumar) return;
    setAcrNumarLoading(true);
    try {
      const parts = fixedStructuraKey ? keyToParts(fixedStructuraKey.toUpperCase().replace(":", "_")) : null;
      if (!parts?.judetId || !parts?.structuraId) {
        setAcrNumarNeedsInit(true);
        setAcrNextNumar(1);
        return;
      }
      const settingsRef = doc(db, `Judete/${parts.judetId}/Structuri/${parts.structuraId}/Settings/general`);
      const sSnap = await getDoc(settingsRef);
      const lastFromSettings = typeof (sSnap.data() as any)?.acreditareLastNumar === "number" ? Number((sSnap.data() as any).acreditareLastNumar) : 0;

      const acrColl = collection(doc(db, `Judete/${parts.judetId}/Structuri/${parts.structuraId}`), "Acreditari");
      const snap = await getDocs(query(acrColl, orderBy("createdAt", "desc"), limit(50)));
      let max = 0;
      for (const d of snap.docs) {
        const n = parseAcreditareNumar((d.data() as any)?.numar);
        if (typeof n === "number" && Number.isFinite(n)) max = Math.max(max, n);
      }
      setAcrMaxFromDocs(max);
      const base = Math.max(lastFromSettings || 0, max || 0);
      setAcrNumarNeedsInit(base <= 0);
      setAcrNextNumar(base + 1);
    } catch {
      setAcrMaxFromDocs(0);
      setAcrNumarNeedsInit(true);
      setAcrNextNumar(1);
    } finally {
      setAcrNumarLoading(false);
    }
  }

  useEffect(() => {
    computeAcreditareNumarPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminSingle, fixedStructuraKey, loadedExistingId, acrFixedNumar]);

  // Load available structuri that have an owner doc (public only)
  useEffect(() => {
    if (isAdminSingle) return;
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
  }, [db, isAdminSingle]);

  // Public: Preselect from query param: ?structuri=DB:ISU,AG:IPJ
  useEffect(() => {
    if (isAdminSingle) return;
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
  }, [isAdminSingle]);

  // Apply prefill
  useEffect(() => {
    if (!prefill) return;
    // media
    if (prefill.mediaTypes) setMediaTypes(prefill.mediaTypes);
    if (typeof prefill.mediaAltceva === "string") setMediaAltceva(prefill.mediaAltceva);
    if (typeof prefill.institutieDenumire === "string") setInstitutieDenumire(prefill.institutieDenumire);
    if (typeof prefill.institutieCui === "string") setInstitutieCui(prefill.institutieCui);
    if (typeof prefill.institutieAdresa === "string") setInstitutieAdresa(prefill.institutieAdresa);
    if (typeof prefill.institutieEmail === "string") setInstitutieEmail(prefill.institutieEmail);
    if (typeof prefill.institutieTelefonFix === "string") setInstitutieTelefonFix(prefill.institutieTelefonFix);
    if (typeof prefill.institutieTelefonFax === "string") setInstitutieTelefonFax(prefill.institutieTelefonFax);
    if (typeof prefill.institutieTelefonMobil === "string") setInstitutieTelefonMobil(prefill.institutieTelefonMobil);
    if (typeof prefill.institutieWebsite === "string") setInstitutieWebsite(prefill.institutieWebsite);
    // jurnalist
    if (typeof prefill.numePrenume === "string") setNumePrenume(prefill.numePrenume);
    if (typeof prefill.dataNasterii === "string") setDataNasterii(prefill.dataNasterii);
    if (typeof prefill.locNastere === "string") setLocNastere(prefill.locNastere);
    if (typeof prefill.cetatenie === "string") setCetatenie(prefill.cetatenie);
    if (typeof prefill.tipDocIdentitate === "string") setTipDocIdentitate(prefill.tipDocIdentitate);
    if (typeof prefill.serieNumarDoc === "string") setSerieNumarDoc(prefill.serieNumarDoc);
    if (typeof prefill.adresaOptional === "string") setAdresaOptional(prefill.adresaOptional);
    if (typeof prefill.nrLegitimatie === "string") setNrLegitimatie(prefill.nrLegitimatie);
    if (typeof prefill.dataExpirareLegit === "string") setDataExpirareLegit(prefill.dataExpirareLegit);
    if (prefill.functii) setFunctii(prefill.functii);
    if (typeof prefill.functieAltceva === "string") setFunctieAltceva(prefill.functieAltceva);
    if (typeof prefill.jurnalistEmail === "string") setJurnalistEmail(prefill.jurnalistEmail);
    if (typeof prefill.jurnalistTelefonFix === "string") setJurnalistTelefonFix(prefill.jurnalistTelefonFix);
    if (typeof prefill.jurnalistTelefonFax === "string") setJurnalistTelefonFax(prefill.jurnalistTelefonFax);
    if (typeof prefill.jurnalistTelefonMobil === "string") setJurnalistTelefonMobil(prefill.jurnalistTelefonMobil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  const selectedStructuri = useMemo(() => {
    const set = new Set(selectedStructKeys);
    const byKey = new Map(options.map((o) => [o.key, o]));
    const resolved = selectedStructKeys.map((k) => byKey.get(k)).filter(Boolean) as StructuraOption[];
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
    if (legitimatieFiles.length === 0) return false;
    if (!isAdminSingle && !signatureBlob) return false;
    if (!isAdminSingle && !gdprAccepted) return false;
    if (isAdminSingle) {
      if (!acrDateIso) return false;
      if (acrManualEdit) {
        const n = parseAcreditareNumar(acrManualDigits);
        if (!n || n <= 0) return false;
      } else if (!acrFixedNumar) {
        if (acrNumarNeedsInit) {
          const start = parseAcreditareNumar(acrStartNumarText);
          if (!start || start <= 0) return false;
        } else {
          if (!acrNextNumar) return false;
        }
      }
    }
    return true;
  }, [
    submitting,
    selectedStructKeys,
    institutieDenumire,
    numePrenume,
    nrLegitimatie,
    legitimatieFiles,
    signatureBlob,
    gdprAccepted,
    isAdminSingle,
    acrDateIso,
    acrFixedNumar,
    acrManualEdit,
    acrManualDigits,
    acrNumarNeedsInit,
    acrStartNumarText,
    acrNextNumar,
  ]);

  const onPickLegitimatie = (files: FileList | null) => {
    setSubmitError(null);
    if (!files || files.length === 0) {
      setLegitimatieFiles([]);
      return;
    }
    const arr = Array.from(files);
    if (arr.length > MAX_LEGIT_FILES) {
      setLegitimatieFiles([]);
      setSubmitError(`Poți încărca maxim ${MAX_LEGIT_FILES} imagini (JPG/PNG) pentru legitimație.`);
      return;
    }
    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
    const okTypes = ["image/png", "image/jpeg", "image/jpg"];
    for (const f of arr) {
      if (f.size > maxBytes) {
        setLegitimatieFiles([]);
        setSubmitError(`Fișierul "${f.name}" este prea mare (${bytesToMb(f.size)} MB). Maxim ${MAX_UPLOAD_MB} MB per imagine.`);
        return;
      }
      if (!okTypes.includes(f.type)) {
        setLegitimatieFiles([]);
        setSubmitError('Tip fișier neacceptat. Acceptăm doar imagini JPG / PNG (maxim 2).');
        return;
      }
    }
    setLegitimatieFiles(arr);
  };

  const toggleMedia = (k: MediaTypeKey) => setMediaTypes((m) => ({ ...m, [k]: !m[k] }));
  const toggleFunctie = (k: FunctionKey) => setFunctii((m) => ({ ...m, [k]: !m[k] }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!isAdminSingle) {
        const optionKeys = new Set(options.map((o) => o.key));
        const unknown = selectedStructKeys.filter((k) => options.length > 0 && !optionKeys.has(k));
        if (unknown.length) {
          throw new Error("Structuri invalide selectate. Vă rugăm reîncercați.");
        }
      }

      const statusByStructura: Record<string, any> = {};
      if (loadedExistingId && existingDoc?.statusByStructura && typeof existingDoc.statusByStructura === "object") {
        Object.assign(statusByStructura, existingDoc.statusByStructura);
      }
      for (const k of selectedStructKeys) {
        statusByStructura[k] = statusByStructura[k] || { status: "pending" };
      }

      const structuriPayload = selectedStructuri.map((s) => ({
        judetId: s.judetId,
        structuraId: s.structuraId,
        display: s.label,
      }));

      const basePayload: any = {
        structuri: structuriPayload,
        structuraKeys: selectedStructKeys,
        statusByStructura,
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
        jurnalist: {
          numePrenume: numePrenume.trim(),
          sex,
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
          gdpr: isAdminSingle ? true : gdprAccepted,
          gdprVersion: "v1",
          gdprAcceptedAt: serverTimestamp(),
        },
      };

      if (isAdminSingle) {
        const parts = fixedStructuraKey ? keyToParts(fixedStructuraKey.toUpperCase().replace(":", "_")) : null;
        if (!parts?.judetId || !parts?.structuraId) throw new Error("Structura invalidă.");

        const settingsRef = doc(db, `Judete/${parts.judetId}/Structuri/${parts.structuraId}/Settings/general`);
        let numarFinal = acrFixedNumar || String(existingDoc?.acreditare?.numar || "").trim();
        if (acrManualEdit) {
          const manual = parseAcreditareNumar(acrManualDigits);
          if (!manual || manual <= 0) throw new Error("numar_invalid");
          // Ensure counter >= manual value to avoid future collisions
          await runTransaction(db, async (tx) => {
            const sSnap = await tx.get(settingsRef);
            const last = typeof (sSnap.data() as any)?.acreditareLastNumar === "number" ? Number((sSnap.data() as any).acreditareLastNumar) : 0;
            const nextLast = Math.max(last || 0, acrMaxFromDocs || 0, manual);
            tx.set(settingsRef, { acreditareLastNumar: nextLast }, { merge: true });
          });
          // normalize format
          numarFinal = String(manual);
          setAcrFixedNumar(numarFinal);
          setAcrNumarNeedsInit(false);
        }
        if (!numarFinal) {
          const allocated = await runTransaction(db, async (tx) => {
            const sSnap = await tx.get(settingsRef);
            const last = typeof (sSnap.data() as any)?.acreditareLastNumar === "number" ? Number((sSnap.data() as any).acreditareLastNumar) : 0;
            let next: number;
            if (last > 0) next = last + 1;
            else if (acrMaxFromDocs > 0) next = acrMaxFromDocs + 1;
            else {
              const start = parseAcreditareNumar(acrStartNumarText);
              if (!start || start <= 0) throw new Error("numar_start_required");
              next = start;
            }
            tx.set(settingsRef, { acreditareLastNumar: next }, { merge: true });
            return next;
          });
          numarFinal = String(allocated);
          setAcrFixedNumar(numarFinal);
          setAcrNextNumar(allocated + 1);
          setAcrNumarNeedsInit(false);
        }

        basePayload.acreditare = {
          numar: numarFinal,
          data: ddmmyyyySlashFromIso(acrDateIso),
        };
      }

      let cerereId = loadedExistingId || null;
      if (cerereId) {
        await updateDoc(doc(db, "CereriAcreditare", cerereId), {
          ...basePayload,
          updatedAt: serverTimestamp(),
        });
      } else {
        const cereriRef = collection(db, "CereriAcreditare");
        const created = await addDoc(cereriRef, {
          ...basePayload,
          createdAt: serverTimestamp(),
          submittedAt: serverTimestamp(),
          attachments: null,
        });
        cerereId = created.id;
      }

      if (!cerereId) throw new Error("Nu am putut salva cererea.");

      // Upload attachments only if user provided them (or if public requires signature)
      const shouldUploadLegit = legitimatieFiles.length > 0;
      const shouldUploadSig = !isAdminSingle && !!signatureBlob;
      const shouldUploadAny = shouldUploadLegit || shouldUploadSig;

      if (!shouldUploadAny) {
        setSuccessId(cerereId);
        setSubmitting(false);
        onSubmitted?.(cerereId);
        return;
      }

      const legitItems: { path: string; name: string; contentType: string; size: number }[] = [];
      for (let i = 0; i < legitimatieFiles.length; i++) {
        const legit = legitimatieFiles[i]!;
        const legitExt = (legit.name.split(".").pop() || "").toLowerCase();
        const ext = legitExt || (legit.type === "image/png" ? "png" : "jpg");
        const legitPath = `cereri-acreditare/${cerereId}/legitimatie_${i + 1}.${ext}`;
        const legitRef = storageRef(storage, legitPath);
        await uploadBytes(legitRef, legit, { contentType: legit.type || undefined });
        legitItems.push({ path: legitPath, name: legit.name, contentType: legit.type, size: legit.size });
        try {
          await getDownloadURL(legitRef);
        } catch {}
      }

      const attachmentsUpdate: any = {
        ...(existingDoc?.attachments && typeof existingDoc.attachments === "object" ? existingDoc.attachments : {}),
      };
      if (legitItems.length) attachmentsUpdate.legitimatie = legitItems;

      if (!isAdminSingle) {
        const sigPath = `cereri-acreditare/${cerereId}/semnatura.png`;
        const sigRef = storageRef(storage, sigPath);
        await uploadBytes(sigRef, signatureBlob!, { contentType: "image/png" });
        try {
          await getDownloadURL(sigRef);
        } catch {}
        attachmentsUpdate.semnatura = { path: sigPath, contentType: "image/png" };
      }

      await updateDoc(doc(db, "CereriAcreditare", cerereId), {
        attachments: attachmentsUpdate,
        attachmentsUploadedAt: serverTimestamp(),
      });

      setSuccessId(cerereId);
      setSubmitting(false);
      onSubmitted?.(cerereId);
    } catch (err: any) {
      setSubmitting(false);
      const msg = typeof err?.message === "string" ? err.message : "";
      if (msg === "numar_start_required") {
        setSubmitError("Introduceți numărul de start pentru prima acreditare (ex: 2.560.588).");
      } else if (msg === "numar_invalid") {
        setSubmitError("Nr. acreditare invalid. Folosiți doar cifre (ex: 2.560.588).");
      } else {
        setSubmitError(typeof err?.message === "string" ? err.message : "Eroare la trimiterea cererii.");
      }
    }
  }

  if (successId) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-white shadow-xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Cererea a fost trimisă</h1>
            <p className="text-gray-600 mt-1">Cererea a fost înregistrată.</p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-sm text-gray-600">ID cerere:</span>
              <span className="text-sm font-mono text-gray-900">{successId}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fixedLabel = isAdminSingle && selectedStructuri[0]?.label ? selectedStructuri[0].label : null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold">IRP</span>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-gray-900">{title}</div>
            <div className="text-sm text-gray-600 mt-1">{description}</div>
          </div>
          <div className="hidden sm:block">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700">
              <span className="font-semibold">Data</span>
              <span className="font-mono">{todayYMD()}</span>
            </div>
          </div>
        </div>
      </div>

      {!isAdminSingle ? (
        <>
          <StructuriMultiSelect options={options} selectedKeys={selectedStructKeys} onChange={setSelectedStructKeys} disabled={optionsLoading} />
          {optionsError && <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">{optionsError}</div>}
          {optionsLoading && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-4 text-sm text-gray-600">Se încarcă lista structurilor...</div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="text-sm font-semibold text-gray-900">Structură</div>
          <div className="text-sm text-gray-700 mt-1">Cererea va fi salvată doar pentru structura curentă.</div>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm">
            {fixedLabel || (selectedStructKeys[0] ? selectedStructKeys[0].replace("_", ":") : "-")}
          </div>
        </div>
      )}

      {isAdminSingle && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="text-sm font-semibold text-gray-900">Acreditare (pentru certificatul PDF)</div>
          <div className="text-xs text-gray-600 mt-1">Numărul este obligatoriu și se autoincrementează (+1). La prima acreditare se setează numărul de start.</div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data acreditare *</label>
              <input
                type="date"
                value={acrDateIso}
                onChange={(e) => setAcrDateIso(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <div className="text-xs text-gray-500 mt-1">În certificat va apărea ca DD/MM/YYYY.</div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nr. acreditare *</label>
                <button
                  type="button"
                  onClick={() => {
                    setAcrManualEdit((v) => {
                      const next = !v;
                      if (next) {
                        const seed = digitsOnly(acrFixedNumar) || (acrNextNumar ? String(acrNextNumar) : "") || digitsOnly(existingDoc?.acreditare?.numar);
                        setAcrManualDigits(seed);
                      }
                      return next;
                    });
                  }}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
                  title="Permite modificarea manuală a numărului"
                >
                  {acrManualEdit ? "Autoincrement" : "Editează manual"}
                </button>
              </div>

              {acrManualEdit ? (
                <>
                  <input
                    value={acrManualDigits}
                    onChange={(e) => setAcrManualDigits(digitsOnly(e.target.value))}
                    placeholder="Ex: 2560588"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Introdu doar cifre. În PDF numărul va apărea formatat automat ca x.xxx.xxx.
                  </div>
                </>
              ) : acrFixedNumar ? (
                <input value={acrFixedNumar} readOnly className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900" />
              ) : acrNumarNeedsInit ? (
                <>
                  <input
                    value={acrStartNumarText}
                    onChange={(e) => setAcrStartNumarText(e.target.value)}
                    placeholder="Ex: 2.560.588"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="text-xs text-gray-500 mt-1">Prima acreditare: introduceți numărul de start. Următoarele vor fi +1 automat.</div>
                </>
              ) : (
                <>
                  <input
                    value={acrNextNumar ? String(acrNextNumar) : ""}
                    readOnly
                    placeholder={acrNumarLoading ? "Se calculează..." : "Se calculează..."}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
                  <div className="text-xs text-gray-500 mt-1">Autoincrement (+1) față de ultimul număr emis pentru structura curentă.</div>
                </>
              )}
            </div>
          </div>
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
                  <input value={mediaAltceva} onChange={(e) => setMediaAltceva(e.target.value)} placeholder="Altceva (de specificat)" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Denumirea instituției / CUI <span className="text-red-600">*</span>
                </label>
                <input value={institutieDenumire} onChange={(e) => setInstitutieDenumire(e.target.value)} placeholder="Denumirea instituției" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                <div className="mt-2">
                  <input value={institutieCui} onChange={(e) => setInstitutieCui(e.target.value)} placeholder="CUI (opțional)" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adresa instituției</label>
                <input value={institutieAdresa} onChange={(e) => setInstitutieAdresa(e.target.value)} placeholder="Adresă" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                <div className="mt-2">
                  <input value={institutieEmail} onChange={(e) => setInstitutieEmail(e.target.value)} placeholder="E-mail (opțional)" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
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
              <input value={institutieWebsite} onChange={(e) => setInstitutieWebsite(e.target.value)} placeholder="https://..." className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
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
              <input value={numePrenume} onChange={(e) => setNumePrenume(e.target.value)} placeholder="Nume Prenume" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sex <span className="text-red-600">*</span>
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value === "M" ? "M" : "F")}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="F">F (doamna)</option>
                  <option value="M">M (domnul)</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">Influențează textul „doamna/domnul” din PDF-ul de acreditare.</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data nașterii</label>
                <input type="date" value={dataNasterii} onChange={(e) => setDataNasterii(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Locul nașterii</label>
              <input value={locNastere} onChange={(e) => setLocNastere(e.target.value)} placeholder="Localitate / Județ" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
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
                  <input value={functieAltceva} onChange={(e) => setFunctieAltceva(e.target.value)} placeholder="Altceva (de specificat)" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
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
            <div className="text-xs text-gray-600">
              Încarcă fotografia/scanarea legitimației. Acceptăm <span className="font-semibold">maxim {MAX_LEGIT_FILES} imagini</span> (JPG/PNG).
            </div>
          </div>
          <div className="p-6 space-y-3">
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg"
              onChange={(e) => onPickLegitimatie(e.target.files)}
              className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {legitimatieFiles.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-900">Fișiere selectate ({legitimatieFiles.length}/{MAX_LEGIT_FILES})</div>
                <div className="space-y-2">
                  {legitimatieFiles.map((f, idx) => (
                    <div key={`${f.name}_${idx}`} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-900 truncate">{f.name}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{bytesToMb(f.size)} MB</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLegitimatieFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white text-sm"
                      >
                        Elimină
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setLegitimatieFiles([])}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white text-sm"
                  >
                    Elimină toate
                  </button>
                </div>
              </div>
            )}
            <div className="text-xs text-gray-500">Maxim {MAX_LEGIT_FILES} imagini. Maxim {MAX_UPLOAD_MB} MB per imagine.</div>
          </div>
        </div>

        {!isAdminSingle && <SignaturePad valuePngBlob={signatureBlob} onChange={setSignatureBlob} />}

        {/* Consimțăminte */}
        {!isAdminSingle && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900">Declarații și informare</div>
              <div className="text-xs text-gray-600">Bifează pentru a continua.</div>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={gdprAccepted} onChange={(e) => setGdprAccepted(e.target.checked)} className="mt-1 w-4 h-4" />
                <span className="text-sm text-gray-800">
                  Am citit și am înțeles{" "}
                  <button type="button" className="text-blue-700 hover:underline" onClick={() => setShowGdpr(true)}>
                    Nota de informare GDPR
                  </button>
                  .
                </span>
              </label>
            </div>
          </div>
        )}

        {submitError && <div className="rounded-2xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{submitError}</div>}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            Câmpuri obligatorii: Structuri, Denumire instituție, Nume, Nr. legitimație, Upload legitimație
            {!isAdminSingle ? ", Semnătură" : ""}
            {!isAdminSingle ? ", GDPR" : ""}.
          </div>
          <button type="submit" disabled={!canSubmit} className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg transition-colors ${canSubmit ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
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

      {/* GDPR Modal */}
      {!isAdminSingle && showGdpr && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGdpr(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Notă de informare GDPR</div>
                </div>
                <button type="button" onClick={() => setShowGdpr(false)} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm">
                  Închide
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-auto">
                <div className="text-xs text-gray-900 whitespace-pre-wrap leading-relaxed">{GDPR_NOTE_TEXT}</div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button type="button" onClick={() => { setGdprAccepted(true); setShowGdpr(false); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
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


