"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { pdf } from "@react-pdf/renderer";
import { BicpPdfDoc } from "@/app/(admin-irp)/components/pdf/BicpPdf";
import { Star, Trash2, Settings, Building2, FileText, Image } from "lucide-react";

export default function SetariStructuraPage() {
  const { db, app } = initFirebase();
  const storage = getStorage(app); // no longer used for logo upload
  const { judetId, structuraId } = getTenantContext();

  const [headerLines, setHeaderLines] = useState<string>("");
  const [footerLines, setFooterLines] = useState<string>("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [unitLabel, setUnitLabel] = useState<string>("COMPARTIMENT INFORMARE ȘI RELAȚII PUBLICE");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [semnatari, setSemnatari] = useState<{ functia: string; grad: string; nume: string }[]>([]);
  const [semnatarIndex, setSemnatarIndex] = useState<number>(0);
  const [newFunctia, setNewFunctia] = useState("");
  const [newGrad, setNewGrad] = useState("");
  const [newNume, setNewNume] = useState("");
  const [purtatori, setPurtatori] = useState<{ nume: string }[]>([]);
  const [purtatorIndex, setPurtatorIndex] = useState<number>(0);
  const [newPurtator, setNewPurtator] = useState("");

  useEffect(() => {
    (async () => {
      const path = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      const snap = await getDoc(path);
      if (snap.exists()) {
        const d = snap.data() as any;
        setHeaderLines((d.headerLines || []).join("\n"));
        setFooterLines((d.footerLines || []).join("\n"));
        setCity(d.city || "");
        setPhone(d.phone || "");
        setLogoUrl(d.logoUrlPublic || "");
        setUnitLabel(d.unitLabel || "COMPARTIMENT INFORMARE ȘI RELAȚII PUBLICE");
        setSemnatari(Array.isArray(d.semnatari) ? d.semnatari : []);
        setSemnatarIndex(typeof d.semnatarIndex === "number" ? d.semnatarIndex : 0);
        setPurtatori(Array.isArray(d.purtatori) ? d.purtatori : []);
        setPurtatorIndex(typeof d.purtatorIndex === "number" ? d.purtatorIndex : 0);
      }
    })();
  }, [db, judetId, structuraId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sigle-gallery");
        const list = await res.json();
        setGallery(list);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let url: string | null = null;
    const timeout = setTimeout(async () => {
      try {
        const el = (
          <BicpPdfDoc
            settings={{
              headerLines: (headerLines || "").split("\n").map((s) => s.trim()).filter(Boolean),
              logoUrlPublic: logoUrl || undefined,
              secrecyLabel: "NESECRET",
              city: city || undefined,
              phone: phone || undefined,
              footerLines: (footerLines || "").split("\n").map((s) => s.trim()).filter(Boolean),
              unitLabel,
            }}
            data={{
              numar: "____",
              dateLabel: new Date().toLocaleDateString("ro-RO"),
              purtator: purtatori[purtatorIndex]?.nume || "Purtător de cuvânt",
              tipDocument: "COMUNICAT DE PRESĂ",
              titlu: "Zi de foc pentru pompieri, peste 1.750 de intervenții în situații de urgență",
              continut: `În cursul zilei de ieri, pompierii salvatori au gestionat peste 1.750 de situații de urgență la nivel național. Dintre acestea, 1.294 au fost misiuni de acordare a primului ajutor, 160 intervenții pentru stingerea incendiilor izbucnite în diferite zone ale țării, iar 312 acțiuni au vizat protejarea comunităților, inclusiv 3 misiuni de descarcerare a victimelor implicate în accidente rutiere. Pe lângă aceste misiuni derulate, pompierii militari au acționat și pentru gestionarea efectelor produse de vremea nefavorabilă. Astfel, în data de 7 august, în intervalul orar 07:00 – 21:00, ca urmare a manifestării fenomenelor hidrometeorologice prognozate, au fost semnalate efecte în 3 localități din județele Argeș și Prahova. Echipajele de intervenție au acționat pentru evacuarea apei dintr-un beci și pentru degajarea a 5 arbori căzuți pe carosabil. Totodată, în localitatea Arefu, județul Argeș, pe DN 7C, circulația rutieră a fost îngreunată din cauza căderilor de pietre și a copacilor prăbușiți pe partea carosabilă.

Pentru protecția populației, în ultimele 24 de ore au fost transmise 32 de mesaje de avertizare prin sistemul RO-ALERT. Majoritatea acestora au vizat semnalarea prezenței animalelor sălbatice în localități din 9 județe.

În contextul temperaturilor ridicate și a vântului puternic, pompierii se confruntă zilnic cu un număr semnificativ de incendii de vegetație, care se propagă rapid și amenință vieți omenești, animale, locuințe și suprafețe împădurite. În ultimele 24 de ore, salvatorii au intervenit pentru stingerea a 117 astfel de incendii, care au afectat peste 400 de hectare de teren.

Arderea vegetației uscate este interzisă prin lege! Vă rugăm să respectați recomandările autorităților și să anunțați de urgență orice incendiu la numărul 112.

Informații esențiale despre comportamentul adecvat înainte, în timpul și după producerea unei situații de urgență sunt disponibile pe platforma https://fiipregatit.ro.`,
              semnatar: (semnatari[semnatarIndex] ? { pentru: "", ...semnatari[semnatarIndex] } : { pentru: "", functia: "FUNCȚIA", grad: "GRAD", nume: "NUME" }),
            }}
          />
        );
        const blob = await pdf(el).toBlob();
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch {
        setPreviewUrl(null);
      }
    }, 200); // debounce
    return () => { clearTimeout(timeout); if (url) URL.revokeObjectURL(url); };
  }, [headerLines, footerLines, logoUrl, city, phone, unitLabel, semnatarIndex, semnatari, purtatori, purtatorIndex]);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const path = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      await setDoc(path, {
        headerLines: headerLines.split("\n").map((s) => s.trim()).filter(Boolean),
        footerLines: footerLines.split("\n").map((s) => s.trim()).filter(Boolean),
        city: city.trim(),
        phone: phone.trim(),
        logoUrlPublic: logoUrl,
        unitLabel,
        semnatari,
        semnatarIndex,
        purtatori,
        purtatorIndex,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
      setMessage("Salvat");
    } catch {
      setMessage("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center shadow-xl">
              <Settings size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Setări Structură</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-lg text-gray-600">Configurarea personalizată a documentelor</p>
                <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <Building2 size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-700">{judetId} / {structuraId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-1 bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <Image size={18} className="text-blue-600"/>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Identitate Vizuală</h2>
            </div>
            <div className="space-y-6">
              {logoUrl && (
                <div className="text-center">
                  <div className="inline-block p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <img src={logoUrl} alt="logo" className="h-24 mx-auto rounded object-contain" />
                  </div>
                  <p className="text-sm text-gray-600 mt-2 font-medium">Logo selectat</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Galerie sigile disponibile</label>
                <div className="grid grid-cols-3 gap-3">
                  {gallery.map((src) => (
                    <button 
                      key={src} 
                      onClick={() => setLogoUrl(src)} 
                      className={`group relative border-2 rounded-xl p-3 transition-all duration-200 hover:border-blue-400 hover:shadow-md ${
                        logoUrl === src ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg' : 'border-gray-200'
                      }`}
                    >
                      <img src={src} alt="sigla" className="h-12 w-full object-contain" />
                      {logoUrl === src && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-3">Selectează o siglă din galeria locală pentru folosirea în documente.</p>
              </div>
            </div>
          </section>

          <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText size={18} className="text-purple-600"/>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Configurare Documente</h2>
            </div>
            <div className="grid gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Header lines (un rând pe linie)</label>
                <textarea 
                  className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 h-32 text-gray-900 placeholder:text-gray-400 transition-colors" 
                  placeholder="Introduceți liniile pentru header-ul documentelor..."
                  value={headerLines} 
                  onChange={(e) => setHeaderLines(e.target.value)} 
                />
                <p className="text-sm text-gray-500 mt-1">Fiecare linie va apărea în partea de sus a documentelor. În partea de jos a paginii puteți previzualiza documentul.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Footer lines (un rând pe linie)</label>
                <textarea 
                  className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 h-24 text-gray-900 placeholder:text-gray-400 transition-colors" 
                  placeholder="Introduceți liniile pentru footer-ul documentelor..."
                  value={footerLines} 
                  onChange={(e) => setFooterLines(e.target.value)} 
                />
                <p className="text-sm text-gray-500 mt-1">Aceste linii vor apărea în partea de jos a documentelor.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Unitate (afișată jos stânga)</label>
                <select 
                  className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-gray-900 transition-colors" 
                  value={unitLabel} 
                  onChange={(e) => setUnitLabel(e.target.value)}
                >
                  <option>COMPARTIMENT INFORMARE ȘI RELAȚII PUBLICE</option>
                  <option>SERVICIUL INFORMARE ȘI RELAȚII PUBLICE</option>
                  <option>DIRECȚIA INFORMARE ȘI RELAȚII PUBLICE</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Oraș</label>
                  <input 
                    className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 transition-colors" 
                    placeholder="Orașul structurii"
                    value={city} 
                    onChange={(e) => setCity(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                  <input 
                    className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 transition-colors" 
                    placeholder="Numărul de telefon"
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-4">Semnatari disponibili</label>
                <div className="space-y-4 min-w-0">
                  {semnatari.map((s, idx) => (
                    <div key={idx} className={`rounded-xl border p-4 transition-all duration-200 ${semnatarIndex===idx? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 shadow-lg' : 'border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow-md'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-gray-900 truncate">{s.nume || "Nume semnatar"}</div>
                        <div className="flex items-center gap-2">
                          {semnatarIndex===idx ? (
                            <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-medium">
                              <Star size={12} className="fill-current" /> Implicit
                            </span>
                          ) : (
                            <button 
                              type="button" 
                              onClick={()=>setSemnatarIndex(idx)} 
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <Star size={12} /> Setează implicit
                            </button>
                          )}
                          <button 
                            type="button" 
                            onClick={()=>setSemnatari(semnatari.filter((_,i)=>i!==idx))} 
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={12} /> Șterge
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Funcția</label>
                          <input 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" 
                            value={s.functia} 
                            onChange={(e)=>{ const arr=[...semnatari]; arr[idx]={...arr[idx], functia:e.target.value}; setSemnatari(arr); }} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Grad</label>
                          <input 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" 
                            value={s.grad} 
                            onChange={(e)=>{ const arr=[...semnatari]; arr[idx]={...arr[idx], grad:e.target.value}; setSemnatari(arr); }} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nume</label>
                          <input 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" 
                            value={s.nume} 
                            onChange={(e)=>{ const arr=[...semnatari]; arr[idx]={...arr[idx], nume:e.target.value}; setSemnatari(arr); }} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4">
                    <div className="text-sm font-medium text-gray-900 mb-3">Adaugă semnatar nou</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Funcția</label>
                        <input 
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" 
                          placeholder="Ex: INSPECTOR ȘEF"
                          value={newFunctia} 
                          onChange={(e)=>setNewFunctia(e.target.value)} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Grad</label>
                        <input 
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" 
                          placeholder="Ex: Colonel"
                          value={newGrad} 
                          onChange={(e)=>setNewGrad(e.target.value)} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nume</label>
                        <input 
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" 
                          placeholder="Ex: POPESCU Ioan"
                          value={newNume} 
                          onChange={(e)=>setNewNume(e.target.value)} 
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button 
                        type="button" 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium" 
                        onClick={()=>{ if(!newNume.trim()) return; setSemnatari([...semnatari,{functia:newFunctia.trim(), grad:newGrad.trim(), nume:newNume.trim()}]); setNewFunctia(""); setNewGrad(""); setNewNume(""); }}
                      >
                        <Star size={14} /> Adaugă semnatar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-4">Purtători de cuvânt</label>
                <div className="space-y-4 min-w-0">
                  {purtatori.map((p, idx) => (
                    <div key={idx} className={`rounded-xl border p-4 transition-all duration-200 ${purtatorIndex===idx? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 shadow-lg' : 'border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow-md'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-gray-900 truncate">{p.nume || "Nume purtător"}</div>
                        <div className="flex items-center gap-2">
                          {purtatorIndex===idx ? (
                            <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium">
                              <Star size={12} className="fill-current" /> Implicit
                            </span>
                          ) : (
                            <button 
                              type="button" 
                              onClick={()=>setPurtatorIndex(idx)} 
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <Star size={12} /> Setează implicit
                            </button>
                          )}
                          <button 
                            type="button" 
                            onClick={()=>setPurtatori(purtatori.filter((_,i)=>i!==idx))} 
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={12} /> Șterge
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nume complet</label>
                        <input 
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" 
                          value={p.nume} 
                          onChange={(e)=>{ const arr=[...purtatori]; arr[idx]={...arr[idx], nume:e.target.value}; setPurtatori(arr); }} 
                        />
                      </div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4">
                    <div className="text-sm font-medium text-gray-900 mb-3">Adaugă purtător de cuvânt</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Grad, nume, prenume</label>
                        <input 
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" 
                          placeholder="Ex: plt.maj. POPESCU Ioan"
                          value={newPurtator} 
                          onChange={(e)=>setNewPurtator(e.target.value)} 
                        />
                      </div>
                      <div className="flex items-end">
                        <button 
                          type="button" 
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium" 
                          onClick={()=>{ if(!newPurtator.trim()) return; setPurtatori([...purtatori,{nume:newPurtator.trim()}]); setNewPurtator(""); }}
                        >
                          <Star size={14} /> Adaugă
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Toate modificările vor fi aplicate automat în documentele generate.
                  </div>
                  <div className="flex items-center gap-4">
                    {message && (
                      <span className={`text-sm font-medium ${message === 'Salvat' ? 'text-green-600' : 'text-red-600'}`}>
                        {message}
                      </span>
                    )}
                    <button 
                      onClick={onSave} 
                      disabled={saving} 
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Se salvează...
                        </>
                      ) : (
                        <>
                          <Settings size={18} />
                          Salvează setările
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Previzualizare document - randare PDF identică */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-orange-600"/>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Previzualizare Document</h2>
              <p className="text-sm text-gray-600">Aspectul exact al documentelor generate cu setările curente</p>
            </div>
          </div>
          <div className="h-[75vh] bg-gray-50 rounded-xl overflow-hidden">
            {previewUrl ? (
              <iframe 
                title="pdf-preview" 
                src={previewUrl || undefined} 
                className="w-full h-full border-0" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Se generează previzualizarea</p>
                  <p className="text-sm text-gray-500 mt-1">Vă rugăm să așteptați...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

