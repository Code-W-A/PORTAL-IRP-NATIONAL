"use client";

import { useMemo, useState } from "react";

export type StructuraOption = {
  key: string; // `${judetId}_${structuraId}`
  judetId: string;
  structuraId: string;
  label: string; // e.g. "ISU Dâmbovița"
};

type Props = {
  options: StructuraOption[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
};

export function StructuriMultiSelect({ options, selectedKeys, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = useMemo(() => {
    const set = new Set(selectedKeys);
    return options.filter((o) => set.has(o.key));
  }, [options, selectedKeys]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.key.toLowerCase().includes(s));
  }, [options, q]);

  const toggle = (key: string) => {
    const set = new Set(selectedKeys);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange(Array.from(set));
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-900">Structuri (selectează una sau mai multe)</div>
        <div className="text-xs text-gray-600">Cererea va fi vizibilă în toate structurile selectate.</div>
      </div>
      <div className="p-6">
        <div className="relative" data-structuri-dropdown>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className={`w-full border rounded-xl px-4 py-3 text-left transition-colors flex items-center justify-between ${
              disabled ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed" : "bg-white border-gray-300 text-gray-900 hover:border-gray-400"
            }`}
          >
            <span className={selected.length ? "text-gray-900" : "text-gray-400"}>
              {selected.length ? `${selected.length} selectate` : "Selectează structuri..."}
            </span>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Caută structură..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="max-h-72 overflow-auto">
                {filtered.map((o) => {
                  const checked = selectedKeys.includes(o.key);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => toggle(o.key)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                        checked ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                        {checked && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <span className="text-gray-900">{o.label}</span>
                      <span className="ml-auto text-xs text-gray-500">{o.key.replace("_", ":")}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="px-4 py-4 text-sm text-gray-500">Nicio structură găsită.</div>
                )}
              </div>
              <div className="p-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Curăță selecția
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setQ(""); }}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Gata
                </button>
              </div>
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg text-sm">
                {s.label}
                <button type="button" onClick={() => toggle(s.key)} className="text-blue-800 hover:text-blue-950">
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


