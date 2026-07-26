"use client";

import { useEffect, useState } from "react";

import { initFirebase } from "@/lib/firebase";

type Semnatar = { nume?: string; functia?: string; grad?: string };

async function authHeaders() {
  const { auth } = initFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("missing_auth");
  return { Authorization: `Bearer ${token}` };
}

export default function SecretSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [st, setSt] = useState<Semnatar>({});
  const [dr, setDr] = useState<Semnatar>({});
  const [stImg, setStImg] = useState<string>("");
  const [drImg, setDrImg] = useState<string>("");

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);
      const headers = await authHeaders();
      const res = await fetch("/api/acreditari/secret-settings", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "Nu am putut încărca setările."));
      }
      setSt(data.acreditareSemnatarStanga || {});
      setDr(data.acreditareSemnatarDreapta || {});
      setStImg(data.acreditareSemnatarStangaImg || "");
      setDrImg(data.acreditareSemnatarDreaptaImg || "");
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcare.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

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
      setError(null);
      const headers = await authHeaders();
      const res = await fetch("/api/acreditari/secret-settings", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          acreditareSemnatarStanga: st,
          acreditareSemnatarDreapta: dr,
          acreditareSemnatarStangaImg: stImg || null,
          acreditareSemnatarDreaptaImg: drImg || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "Nu am putut salva."));
      }
      setMsg("Salvat.");
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Nu am putut salva. Încearcă din nou.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-900">Setări semnături PDF (acreditare)</div>
          <div className="text-sm text-gray-600">
            Singurul loc pentru semnatari stânga/dreapta (text + imagini). Acces admin; salvare doar owner.
          </div>
        </div>
        {msg && <div className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-lg">{msg}</div>}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>}

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
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Se salvează..." : "Salvează"}
        </button>
      </div>
    </div>
  );
}
