"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import {
  applyReusableSections,
  createEmptyPressKitPayload,
  extractReusableSections,
  getLatestPressKitDoc,
  getPressKitCollection,
  getPressKitDefaultsDoc,
  getPressKitDefaultsDocRef,
  normalizePressKitDoc,
} from "@/app/(admin-irp)/mape-presa/_core/firestore";
import {
  DEFAULT_PRESS_KIT_INVITATION_NOTE,
  buildDefaultConferenceMaterialTitle,
  type JournalistRow,
  type PressKitPayload,
} from "@/app/(admin-irp)/mape-presa/_core/types";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  FileCode2,
  FileText,
  Globe,
  Loader2,
  Mail,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users2,
} from "lucide-react";

function normalizePayload(input: PressKitPayload): PressKitPayload {
  const fallbackMaterialTitle = buildDefaultConferenceMaterialTitle(input.conference.year);
  return {
    conference: {
      date: String(input.conference.date || "").trim(),
      time: String(input.conference.time || "").trim(),
      year: String(input.conference.year || "").trim(),
    },
    conferenceMaterial: {
      title: String(input.conferenceMaterial?.title || "").trim() || fallbackMaterialTitle,
      content: String(input.conferenceMaterial?.content || "").trim(),
    },
    contact: {
      name: String(input.contact.name || "").trim(),
      role: String(input.contact.role || "").trim(),
      phone: String(input.contact.phone || "").trim(),
      email: String(input.contact.email || "").trim(),
    },
    hosts: input.hosts.map((item) => String(item || "").trim()).filter(Boolean),
    institutionContact: {
      address: String(input.institutionContact.address || "").trim(),
      phoneFax: String(input.institutionContact.phoneFax || "").trim(),
      email: String(input.institutionContact.email || "").trim(),
      website: String(input.institutionContact.website || "").trim(),
    },
    leadership: {
      inspectorSef: String(input.leadership.inspectorSef || "").trim(),
      primAdjunct: String(input.leadership.primAdjunct || "").trim(),
      adjunct: String(input.leadership.adjunct || "").trim(),
    },
    spokesperson: {
      name: String(input.spokesperson.name || "").trim(),
      email: String(input.spokesperson.email || "").trim(),
      phone: String(input.spokesperson.phone || "").trim(),
    },
    journalists: input.journalists
      .map((row) => ({
        fullNameAndRole: String(row.fullNameAndRole || "").trim(),
        trust: String(row.trust || "").trim(),
      }))
      .filter((row) => row.fullNameAndRole || row.trust),
    intocmit: {
      name: String(input.intocmit.name || "").trim(),
    },
    invitationNote:
      String(input.invitationNote || "").trim() || DEFAULT_PRESS_KIT_INVITATION_NOTE,
  };
}

function validatePayload(payload: PressKitPayload): string | null {
  if (!payload.conference.date || !payload.conference.time || !payload.conference.year) {
    return "Completează câmpurile de conferință (dată, oră, an).";
  }
  if (!payload.contact.name || !payload.contact.role || !payload.contact.phone || !payload.contact.email) {
    return "Completează blocul Contact.";
  }
  if (
    !payload.institutionContact.address ||
    !payload.institutionContact.phoneFax ||
    !payload.institutionContact.email ||
    !payload.institutionContact.website
  ) {
    return "Completează coordonatele instituției (adresa/telefon/email/site).";
  }
  if (
    !payload.leadership.inspectorSef ||
    !payload.leadership.primAdjunct ||
    !payload.leadership.adjunct
  ) {
    return "Completează câmpurile de conducere.";
  }
  if (!payload.spokesperson.name || !payload.spokesperson.email || !payload.spokesperson.phone) {
    return "Completează datele purtătorului de cuvânt.";
  }
  if (!payload.intocmit.name) {
    return "Completează câmpul Întocmit.";
  }
  if (!payload.hosts.length) {
    return "Adaugă cel puțin un responsabil în lista Conduce.";
  }
  if (!payload.journalists.length) {
    return "Adaugă cel puțin un jurnalist participant.";
  }
  if (!payload.conferenceMaterial.content) {
    return "Completează textul materialului conferinței.";
  }
  if (!payload.invitationNote) {
    return "Completează textul după NOTĂ (pagina 4).";
  }
  return null;
}

async function downloadPressKitPdf(auth: ReturnType<typeof initFirebase>["auth"], payload: PressKitPayload) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Autentificarea este necesară pentru descărcarea PDF-ului.");
  }

  const res = await fetch("/api/press-kit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let details = "Nu am putut genera PDF-ul.";
    try {
      const body = await res.json();
      details = body?.error || details;
    } catch {}
    throw new Error(details);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mapa-de-presa.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600";

function SectionCard({
  title,
  subtitle,
  icon,
  rightSlot,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  rightSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
        </div>
        {rightSlot}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "email" | "tel";
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        ) : null}
        <input
          type={type}
          className={`${inputClass} ${icon ? "pl-10" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

export default function CreeazaMapaPresaPage() {
  const { db, auth } = initFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [payload, setPayload] = useState<PressKitPayload>(createEmptyPressKitPayload());
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [prefillSource, setPrefillSource] = useState<"loading" | "defaults" | "latest" | "none">(
    "loading"
  );

  const editIdRaw = String(searchParams.get("id") || "").trim();
  const editId = editIdRaw || null;
  const isEditMode = !!editId;
  const payloadExample = useMemo(() => JSON.stringify(normalizePayload(payload), null, 2), [payload]);
  const completedHosts = useMemo(
    () => payload.hosts.map((item) => item.trim()).filter(Boolean).length,
    [payload.hosts]
  );
  const completedJournalists = useMemo(
    () =>
      payload.journalists.filter(
        (row) => String(row.fullNameAndRole || "").trim() || String(row.trust || "").trim()
      ).length,
    [payload.journalists]
  );
  const actionLocked = loadingDoc || saving || downloading;

  useEffect(() => {
    if (editId) {
      setPrefillSource("none");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { judetId, structuraId } = getTenantContext();

        const settingsRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          const purtatori = Array.isArray(data?.purtatori) ? data.purtatori : [];
          const idx = typeof data?.purtatorIndex === "number" ? data.purtatorIndex : 0;
          const selected = purtatori[idx] || purtatori[0];
          const defaultName = String(selected?.nume || "").trim();
          if (defaultName && !cancelled) {
            setPayload((prev) => {
              if (prev.intocmit.name) return prev;
              return { ...prev, intocmit: { name: defaultName } };
            });
          }
        }

        const defaultsDoc = await getPressKitDefaultsDoc(db, judetId, structuraId).catch(() => null);
        if (cancelled) return;

        if (defaultsDoc) {
          setPayload((prev) => applyReusableSections(prev, defaultsDoc));
          setPrefillSource("defaults");
          return;
        }

        const latestDoc = await getLatestPressKitDoc(db, judetId, structuraId).catch(() => null);
        if (cancelled) return;
        if (latestDoc) {
          setPayload((prev) => applyReusableSections(prev, extractReusableSections(latestDoc)));
          setPrefillSource("latest");
          return;
        }

        setPrefillSource("none");
      } catch {
        if (!cancelled) setPrefillSource("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, editId]);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        setLoadingDoc(true);
        const { judetId, structuraId } = getTenantContext();
        const collectionRef = getPressKitCollection(db, judetId, structuraId);
        const docRef = doc(collectionRef, editId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          setError("Mapa de presă nu a fost găsită.");
          return;
        }
        const normalized = normalizePressKitDoc(snap.data(), snap.id);
        setPayload({
          conference: normalized.conference,
          conferenceMaterial: {
            title:
              normalized.conferenceMaterial.title ||
              buildDefaultConferenceMaterialTitle(normalized.conference.year),
            content: normalized.conferenceMaterial.content || "",
          },
          contact: normalized.contact,
          hosts: normalized.hosts.length ? normalized.hosts : [""],
          institutionContact: normalized.institutionContact,
          leadership: normalized.leadership,
          spokesperson: normalized.spokesperson,
          journalists: normalized.journalists.length
            ? normalized.journalists
            : [{ fullNameAndRole: "", trust: "" }],
          intocmit: normalized.intocmit,
          invitationNote: normalized.invitationNote || DEFAULT_PRESS_KIT_INVITATION_NOTE,
        });
      } catch {
        setError("Eroare la încărcarea documentului.");
      } finally {
        setLoadingDoc(false);
      }
    })();
  }, [db, editId]);

  function updateHost(index: number, value: string) {
    setPayload((prev) => {
      const hosts = [...prev.hosts];
      hosts[index] = value;
      return { ...prev, hosts };
    });
  }

  function addHost() {
    setPayload((prev) => ({ ...prev, hosts: [...prev.hosts, ""] }));
  }

  function removeHost(index: number) {
    setPayload((prev) => {
      const next = prev.hosts.filter((_, i) => i !== index);
      return { ...prev, hosts: next.length ? next : [""] };
    });
  }

  function updateJournalist(index: number, patch: Partial<JournalistRow>) {
    setPayload((prev) => {
      const rows = [...prev.journalists];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, journalists: rows };
    });
  }

  function addJournalist() {
    setPayload((prev) => ({
      ...prev,
      journalists: [...prev.journalists, { fullNameAndRole: "", trust: "" }],
    }));
  }

  function removeJournalist(index: number) {
    setPayload((prev) => {
      const rows = prev.journalists.filter((_, i) => i !== index);
      return {
        ...prev,
        journalists: rows.length ? rows : [{ fullNameAndRole: "", trust: "" }],
      };
    });
  }

  async function handleSave() {
    setError(null);
    setMessage(null);
    setWarning(null);
    const normalized = normalizePayload(payload);
    const validationError = validatePayload(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const { judetId, structuraId } = getTenantContext();
      const collectionRef = getPressKitCollection(db, judetId, structuraId);
      const currentUser = auth.currentUser;
      let savedDocId = editId || "";

      if (editId) {
        const ref = doc(collectionRef, editId);
        await updateDoc(ref, {
          ...normalized,
          updatedAt: serverTimestamp(),
        });
      } else {
        const createdRef = await addDoc(collectionRef, {
          ...normalized,
          judetId,
          structuraId,
          createdByUid: currentUser?.uid || null,
          createdByEmail: currentUser?.email || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        savedDocId = createdRef.id;
      }

      let defaultsUpdated = false;
      try {
        const defaultsRef = getPressKitDefaultsDocRef(db, judetId, structuraId);
        await setDoc(
          defaultsRef,
          {
            ...extractReusableSections(normalized),
            updatedAt: serverTimestamp(),
            updatedByUid: currentUser?.uid || null,
            updatedByEmail: currentUser?.email || null,
            sourcePressKitId: savedDocId || null,
          },
          { merge: true }
        );
        defaultsUpdated = true;
      } catch {}

      const baseMessage = isEditMode
        ? "Mapa de presă a fost actualizată."
        : "Mapa de presă a fost creată.";

      if (defaultsUpdated) {
        setPrefillSource("defaults");
        setMessage(`${baseMessage} Default-urile reutilizabile au fost actualizate.`);
        setTimeout(() => router.replace("/mape-presa/lista"), 650);
      } else {
        setMessage(baseMessage);
        setWarning(
          "Documentul a fost salvat, dar default-urile reutilizabile nu au putut fi actualizate."
        );
        if (!editId && savedDocId) {
          router.replace(`/mape-presa/creeaza?id=${encodeURIComponent(savedDocId)}`);
        }
      }
    } catch {
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    setError(null);
    setMessage(null);
    setWarning(null);
    const normalized = normalizePayload(payload);
    const validationError = validatePayload(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }

    setDownloading(true);
    try {
      await downloadPressKitPdf(auth, normalized);
      setMessage("PDF-ul a fost generat cu succes.");
    } catch (err: any) {
      setError(err?.message || "Eroare la generarea PDF-ului.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/40">
      <div className="space-y-6">
        <header className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm">
                  <FileText size={18} />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {isEditMode ? "Editează mapă de presă" : "Creează mapă de presă"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Completează formularul și generează PDF-ul oficial cu layout-ul „MAPĂ DE PRESĂ”.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Users2 size={13} /> Conduce: {completedHosts}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <BadgeCheck size={13} /> Jurnaliști: {completedJournalists}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {isEditMode ? "Mod editare" : "Document nou"}
              </span>
            </div>
          </div>
        </header>

        {loadingDoc ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="inline-flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin" /> Se încarcă documentul...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <SectionCard
                title="Conferință"
                subtitle="Datele de context afișate în copertă și sumar."
                icon={<CalendarClock size={18} />}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field
                    label="Dată"
                    value={payload.conference.date}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        conference: { ...prev.conference, date: value },
                      }))
                    }
                    placeholder="ex: 26.02.2026"
                  />
                  <Field
                    label="Oră"
                    value={payload.conference.time}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        conference: { ...prev.conference, time: value },
                      }))
                    }
                    placeholder="ex: 11:00"
                  />
                  <Field
                    label="An evaluare"
                    value={payload.conference.year}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        conference: { ...prev.conference, year: value },
                      }))
                    }
                    placeholder="ex: 2026"
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Contact"
                subtitle="Persoana și datele de contact publicate pe copertă."
                icon={<UserRound size={18} />}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Nume"
                    value={payload.contact.name}
                    onChange={(value) =>
                      setPayload((prev) => ({ ...prev, contact: { ...prev.contact, name: value } }))
                    }
                    placeholder="Nume contact"
                  />
                  <Field
                    label="Funcție"
                    value={payload.contact.role}
                    onChange={(value) =>
                      setPayload((prev) => ({ ...prev, contact: { ...prev.contact, role: value } }))
                    }
                    placeholder="Funcție contact"
                  />
                  <Field
                    label="Telefon"
                    value={payload.contact.phone}
                    onChange={(value) =>
                      setPayload((prev) => ({ ...prev, contact: { ...prev.contact, phone: value } }))
                    }
                    placeholder="Telefon contact"
                    type="tel"
                    icon={<Phone size={14} />}
                  />
                  <Field
                    label="Email"
                    value={payload.contact.email}
                    onChange={(value) =>
                      setPayload((prev) => ({ ...prev, contact: { ...prev.contact, email: value } }))
                    }
                    placeholder="Email contact"
                    type="email"
                    icon={<Mail size={14} />}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Conduce"
                subtitle="Participanții care conduc activitatea."
                icon={<Users2 size={18} />}
                rightSlot={
                  <button
                    type="button"
                    onClick={addHost}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Plus size={14} /> Adaugă
                  </button>
                }
              >
                <div className="space-y-2.5">
                  {payload.hosts.map((host, index) => (
                    <div key={`host:${index}`} className="grid grid-cols-[36px_minmax(0,1fr)_40px] gap-2">
                      <div className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        {index + 1}
                      </div>
                      <input
                        className={inputClass}
                        value={host}
                        onChange={(e) => updateHost(index, e.target.value)}
                        placeholder="Nume și funcție"
                      />
                      <button
                        type="button"
                        onClick={() => removeHost(index)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50"
                        aria-label="Șterge responsabil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Material conferință"
                subtitle="Titlul și conținutul materialului prezentat în cadrul conferinței."
                icon={<FileText size={18} />}
              >
                <div className="space-y-4">
                  <Field
                    label="Titlu material conferință"
                    value={payload.conferenceMaterial.title}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        conferenceMaterial: { ...prev.conferenceMaterial, title: value },
                      }))
                    }
                    placeholder="ex: Statistici intervenții pe semestrul I al anului 2025"
                  />

                  <div>
                    <label className={labelClass}>Text material conferință</label>
                    <textarea
                      className={`${inputClass} min-h-[240px] w-full resize-y`}
                      value={payload.conferenceMaterial.content}
                      onChange={(e) =>
                        setPayload((prev) => ({
                          ...prev,
                          conferenceMaterial: {
                            ...prev.conferenceMaterial,
                            content: e.target.value,
                          },
                        }))
                      }
                      placeholder="Introdu textul integral al materialului conferinței..."
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Coordonate instituție"
                subtitle="Datele din pagina cu tabelul de contact."
                icon={<Building2 size={18} />}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Adresă"
                    value={payload.institutionContact.address}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        institutionContact: { ...prev.institutionContact, address: value },
                      }))
                    }
                    placeholder="Adresă"
                    className="md:col-span-2"
                  />
                  <Field
                    label="Telefon / fax"
                    value={payload.institutionContact.phoneFax}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        institutionContact: { ...prev.institutionContact, phoneFax: value },
                      }))
                    }
                    placeholder="Telefon / fax"
                    icon={<Phone size={14} />}
                  />
                  <Field
                    label="Email"
                    value={payload.institutionContact.email}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        institutionContact: { ...prev.institutionContact, email: value },
                      }))
                    }
                    placeholder="Email instituție"
                    type="email"
                    icon={<Mail size={14} />}
                  />
                  <Field
                    label="Website"
                    value={payload.institutionContact.website}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        institutionContact: { ...prev.institutionContact, website: value },
                      }))
                    }
                    placeholder="Website instituție"
                    className="md:col-span-2"
                    icon={<Globe size={14} />}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Conducere, purtător și întocmit"
                subtitle="Datele care apar în pagina 3 și în semnătura finală."
                icon={<BadgeCheck size={18} />}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Inspector șef"
                    value={payload.leadership.inspectorSef}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        leadership: { ...prev.leadership, inspectorSef: value },
                      }))
                    }
                    placeholder="Inspector șef"
                  />
                  <Field
                    label="Prim adjunct"
                    value={payload.leadership.primAdjunct}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        leadership: { ...prev.leadership, primAdjunct: value },
                      }))
                    }
                    placeholder="Prim adjunct"
                  />
                  <Field
                    label="Adjunct"
                    value={payload.leadership.adjunct}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        leadership: { ...prev.leadership, adjunct: value },
                      }))
                    }
                    placeholder="Adjunct"
                    className="md:col-span-2"
                  />
                  <Field
                    label="Nume purtător de cuvânt"
                    value={payload.spokesperson.name}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        spokesperson: { ...prev.spokesperson, name: value },
                      }))
                    }
                    placeholder="Nume purtător de cuvânt"
                  />
                  <Field
                    label="Telefon purtător de cuvânt"
                    value={payload.spokesperson.phone}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        spokesperson: { ...prev.spokesperson, phone: value },
                      }))
                    }
                    placeholder="Telefon purtător de cuvânt"
                    type="tel"
                    icon={<Phone size={14} />}
                  />
                  <Field
                    label="Email purtător de cuvânt"
                    value={payload.spokesperson.email}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        spokesperson: { ...prev.spokesperson, email: value },
                      }))
                    }
                    placeholder="Email purtător de cuvânt"
                    type="email"
                    className="md:col-span-2"
                    icon={<Mail size={14} />}
                  />
                  <Field
                    label="Întocmit (nume)"
                    value={payload.intocmit.name}
                    onChange={(value) =>
                      setPayload((prev) => ({
                        ...prev,
                        intocmit: { ...prev.intocmit, name: value },
                      }))
                    }
                    placeholder="Întocmit (nume)"
                    className="md:col-span-2"
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Jurnaliști participanți"
                subtitle="Tabelul de pe pagina 4. Poți adăuga oricâte rânduri."
                icon={<Users2 size={18} />}
                rightSlot={
                  <button
                    type="button"
                    onClick={addJournalist}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Plus size={14} /> Adaugă rând
                  </button>
                }
              >
                <div className="space-y-2.5">
                  {payload.journalists.map((row, index) => (
                    <div
                      key={`journalist:${index}`}
                      className="grid grid-cols-1 gap-2 md:grid-cols-[36px_minmax(0,1fr)_220px_40px]"
                    >
                      <div className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        {index + 1}
                      </div>
                      <input
                        className={inputClass}
                        value={row.fullNameAndRole}
                        onChange={(e) => updateJournalist(index, { fullNameAndRole: e.target.value })}
                        placeholder="Nume, prenume, funcția"
                      />
                      <input
                        className={inputClass}
                        value={row.trust}
                        onChange={(e) => updateJournalist(index, { trust: e.target.value })}
                        placeholder="Trust de presă"
                      />
                      <button
                        type="button"
                        onClick={() => removeJournalist(index)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50"
                        aria-label="Șterge jurnalist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <label className={labelClass}>Text după NOTĂ (pagina 4)</label>
                  <textarea
                    className={`${inputClass} min-h-[92px] resize-y`}
                    value={payload.invitationNote}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        invitationNote: e.target.value,
                      }))
                    }
                    placeholder="Invitația la activitate a fost transmisă prin grija purtătorului de cuvânt de la ISU DÂMBOVIȚA"
                  />
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-20">
              <SectionCard
                title="Acțiuni"
                subtitle="Salvează, generează PDF sau revino în listă."
                icon={<BadgeCheck size={18} />}
              >
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={actionLocked}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                    {saving ? "Se salvează..." : isEditMode ? "Actualizează document" : "Salvează document"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={actionLocked}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloading ? <Loader2 size={15} className="animate-spin" /> : null}
                    {downloading ? "Se generează..." : "Descarcă PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/mape-presa/lista")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Înapoi la listă
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
                  {isEditMode ? (
                    <span className="font-medium text-slate-600">
                      Prefill dezactivat în modul editare.
                    </span>
                  ) : prefillSource === "loading" ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                      <Loader2 size={12} className="animate-spin" />
                      Se încarcă sursa de prefill...
                    </span>
                  ) : prefillSource === "defaults" ? (
                    <span className="font-medium text-emerald-700">
                      Prefill din default-uri structură activ.
                    </span>
                  ) : prefillSource === "latest" ? (
                    <span className="font-medium text-amber-700">
                      Fallback aplicat din ultima mapă salvată.
                    </span>
                  ) : (
                    <span className="font-medium text-slate-600">
                      Nu există default-uri sau fallback disponibil.
                    </span>
                  )}
                </div>
              </SectionCard>

              {(error || message) && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    error
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-green-200 bg-green-50 text-green-700"
                  }`}
                >
                  {error || message}
                </div>
              )}

              {warning && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {warning}
                </div>
              )}

              <SectionCard
                title="Exemplu payload JSON"
                subtitle="Structura trimisă la endpoint-ul de generare."
                icon={<FileCode2 size={18} />}
              >
                <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">
                  {payloadExample}
                </pre>
              </SectionCard>

              <SectionCard
                title="Exemplu call client-side"
                subtitle="Request minim pentru `POST /api/press-kit`."
                icon={<FileCode2 size={18} />}
              >
                <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">
{`const token = await auth.currentUser?.getIdToken();
const res = await fetch("/api/press-kit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${token}\`,
  },
  body: JSON.stringify(payload),
});`}
                </pre>
              </SectionCard>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
