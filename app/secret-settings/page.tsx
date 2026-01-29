"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";

type Semnatar = { nume?: string; functia?: string; grad?: string };

const PASSWORD = "irp@ISUDB25";

export default function SecretSettingsPage() {
  const { db } = initFirebase();
  const [authPassed, setAuthPassed] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [st, setSt] = useState<Semnatar>({});
  const [dr, setDr] = useState<Semnatar>({});
  const [stImg, setStImg] = useState<string>("");
  const [drImg, setDrImg] = useState<string>("");

  async function loadSettings() {
    try {
      setLoading(true);
      const { judetId, structuraId } = getTenantContext();
      const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d: any = snap.data();
        setSt(d.acreditareSemnatarStanga || {});
        setDr(d.acreditareSemnatarDreapta || {});
        setStImg(d.acreditareSemnatarStangaImg || "");
        setDrImg(d.acreditareSemnatarDreaptaImg || "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authPassed) loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPassed]);

  function toDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(side: "st" | "dr", files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const dataUrl = await toDataUrl(file);
      if (side === "st") setStImg(dataUrl);
      else setDrImg(dataUrl);
    } catch {
      alert("Nu am putut încărca fișierul.");
    }
  }

  async function save() {
    try {
      setSaving(true);
      const { judetId, structuraId } = getTenantContext();
      const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      await setDoc(
        ref,
        {
          acreditareSemnatarStanga: st,
          acreditareSemnatarDreapta: dr,
          acreditareSemnatarStangaImg: stImg || null,
          acreditareSemnatarDreaptaImg: drImg || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setMsg("Salvat.");
      setTimeout(() => setMsg(null), 2000);
    } catch {
      alert("Nu am putut salva. Încearcă din nou.");
    } finally {
      setSaving(false);
    }
  }

  if (!authPassed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-sm space-y-3">
          <div className="text-lg font-semibold text-gray-900">Acces restricționat</div>
          <div className="text-sm text-gray-600">Introdu parola pentru a continua.</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            placeholder="Parolă"
          />
          <button
            type="button"
            onClick={() => {
              if (password === PASSWORD) setAuthPassed(true);
              else alert("Parolă greșită.");
            }}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Continuă
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold text-gray-900">Setări semnături PDF</div>
            <div className="text-sm text-gray-600">Specific pentru structura curentă (tenant din context).</div>
          </div>
          {msg && <div className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-lg">{msg}</div>}
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Se încarcă...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Semnatar stânga", state: st, setState: setSt, img: stImg, setImg: (v: string) => setStImg(v) },
              { label: "Semnatar dreapta", state: dr, setState: setDr, img: drImg, setImg: (v: string) => setDrImg(v) },
            ].map((cfg) => (
              <div key={cfg.label} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-900">{cfg.label}</div>
                <div className="space-y-2">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                    placeholder="Nume"
                    value={cfg.state.nume || ""}
                    onChange={(e) => cfg.setState((p) => ({ ...p, nume: e.target.value }))}
                  />
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                    placeholder="Funcția (poți folosi \\n pentru rând nou)"
                    value={cfg.state.functia || ""}
                    onChange={(e) => cfg.setState((p) => ({ ...p, functia: e.target.value }))}
                  />
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                    placeholder="Grad"
                    value={cfg.state.grad || ""}
                    onChange={(e) => cfg.setState((p) => ({ ...p, grad: e.target.value }))}
                  />
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">Semnătură (imagine PNG/JPG) – se stochează ca data URL</div>
                    {cfg.img ? (
                      <div className="border rounded-lg p-2 flex items-center justify-between">
                        <span className="text-xs text-gray-700 truncate">Imagine încărcată</span>
                        <button
                          type="button"
                          onClick={() => cfg.setImg("")}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Șterge
                        </button>
                      </div>
                    ) : null}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => handleFile(cfg.label.includes("stânga") ? "st" : "dr", e.target.files)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}
