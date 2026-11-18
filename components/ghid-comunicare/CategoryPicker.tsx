"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_CATEGORIES, type GuideCategory } from "@/lib/ghid-comunicare/types";
import { normalizeSearch } from "@/lib/ghid-comunicare/validation";
import { useGuidePreferences } from "./GuidePreferences";
import { ErrorNotice, errorMessage, fieldClass, useGuide } from "./shared";

export function CategoryPicker({ selected, onChange, onPendingChange }: {
  selected: string[]; onChange: (ids: string[]) => void; onPendingChange: (pending: boolean) => void;
}) {
  const guide = useGuide();
  const { categories, categoryError, retry } = useGuidePreferences();
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<GuideCategory[]>([]);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const entries = [...categories, ...created.filter(item => !categories.some(category => category.id === item.id))];
  const normalized = normalizeSearch(input.replace(/\s+/gu, " "));
  const matches = entries.filter(category => normalizeSearch(category.name).includes(normalized));
  const existing = entries.some(category => normalizeSearch(category.name) === normalized);
  const full = selected.length >= MAX_CATEGORIES;

  async function create() {
    if (!guide || lock.current || !normalized || existing || full) return;
    lock.current = true;
    setCreating(true);
    onPendingChange(true);
    setError("");
    try {
      const item = await guide.createCategory(input);
      setCreated(items => items.some(category => category.id === item.id) ? items : [...items, item]);
      if (!selected.includes(item.id)) onChange([...selected, item.id]);
      setInput("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      lock.current = false;
      setCreating(false);
      onPendingChange(false);
    }
  }

  return <details className="rounded-xl border border-slate-200 bg-white">
    <summary className="min-h-11 cursor-pointer px-4 py-3 font-medium">
      Categorii <span className="ml-1 text-sm font-normal text-slate-600">{selected.length ? `(${selected.length})` : "(opțional)"}</span>
    </summary>
    <div className="space-y-3 border-t border-slate-100 p-4">
      {selected.length ? <ul aria-label="Categorii selectate" className="flex flex-wrap gap-1.5">
        {selected.map(id => {
          const name = entries.find(item => item.id === id)?.name || "Categorie selectată";
          return <li key={id}><Button variant="outline" size="sm" type="button" disabled={creating}
            aria-label={`Elimină categoria ${name}`} onClick={() => onChange(selected.filter(category => category !== id))}>{name} ×</Button></li>;
        })}
      </ul> : null}
      <label htmlFor="category-search" className="sr-only">Caută sau creează o categorie</label>
      <input id="category-search" type="search" value={input} maxLength={60} className={fieldClass}
        placeholder="Caută sau creează o categorie" onChange={event => setInput(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} />
      {categoryError ? <div className="space-y-2"><ErrorNotice>Categoriile nu s-au încărcat.</ErrorNotice>
        <Button type="button" variant="outline" onClick={retry}>Reîncarcă categoriile</Button></div> : null}
      {matches.length ? <ul aria-label="Categorii disponibile" className="max-h-52 space-y-1 overflow-y-auto">
        {matches.map(category => <li key={category.id}><label className="flex min-h-10 items-center gap-3 rounded-md px-2 hover:bg-slate-50">
          <input type="checkbox" checked={selected.includes(category.id)} disabled={creating || (full && !selected.includes(category.id))}
            onChange={event => onChange(event.target.checked ? [...selected, category.id] : selected.filter(id => id !== category.id))}
            className="size-4 accent-blue-600" />
          <span className="break-all">{category.name}</span>
        </label></li>)}
      </ul> : null}
      {normalized && !existing ? <Button type="button" variant="outline" disabled={creating || full || !guide || Boolean(categoryError)}
        onClick={() => void create()} className="max-w-full whitespace-normal break-all">
        {creating ? "Se creează…" : `Creează „${input.trim()}”`}
      </Button> : null}
      {full ? <p className="text-sm text-slate-600">Poți selecta până la {MAX_CATEGORIES} categorii.</p> : null}
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    </div>
  </details>;
}
