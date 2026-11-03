"use client";
import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import type { Completion, GuidePage } from "@/lib/ghid-comunicare/types";
import { AuthorLine, ErrorNotice, errorMessage, fieldClass, useGuideApi } from "./shared";

function CompletionItem({ item, path, onChange }: { item: Completion; path: string; onChange: () => Promise<void> }) {
  const { user } = useAuth();
  const api = useGuideApi();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function mutate(remove: boolean) {
    if (lock.current) return;
    if (remove && !window.confirm("Ștergi această completare?")) return;
    lock.current = true; setSaving(true); setError("");
    try {
      await api(`${path}/${item.id}`, { method: remove ? "DELETE" : "PATCH", ...(remove ? {} : { body: JSON.stringify({ text }) }) });
      setEditing(false);
      await onChange();
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); lock.current = false; }
  }
  return <li className="space-y-3 rounded-xl border border-gray-200 p-4">
    {editing ? <form onSubmit={event => { event.preventDefault(); void mutate(false); }} className="space-y-3">
      <label htmlFor={`completion-${item.id}`} className="block font-medium">Ce ai adăuga?</label>
      <textarea id={`completion-${item.id}`} value={text} onChange={event => setText(event.target.value)} required maxLength={10000} rows={5} disabled={saving} className={fieldClass} />
      <div className="flex flex-wrap gap-2"><Button type="submit" size="lg" disabled={saving}>{saving ? "Se salvează…" : "Salvează"}</Button>
        <Button type="button" variant="outline" size="lg" disabled={saving} onClick={() => { setEditing(false); setText(item.text); setError(""); }}>Anulează</Button></div>
    </form> : <p className="select-text whitespace-pre-wrap break-words text-base leading-relaxed">{item.text}</p>}
    <AuthorLine author={item.author} date={item.updatedAt} />
    {!editing && user?.uid === item.author.uid ? <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="lg" disabled={saving} onClick={() => { setEditing(true); setText(item.text); }}>Editează</Button>
      <Button type="button" variant="ghost" size="lg" className="text-red-700" disabled={saving} onClick={() => void mutate(true)}>Șterge</Button>
    </div> : null}
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
  </li>;
}
export default function Completions({ id, count, withdrawn, refreshSituation }: { id: string; count: number; withdrawn: boolean; refreshSituation: () => Promise<void> }) {
  const api = useGuideApi();
  const path = `/${id}/completari`;
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [items, setItems] = useState<Completion[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [text, setText] = useState("");
  const loadLock = useRef(false);
  const saveLock = useRef(false);
  const creationId = useRef<string | null>(null);

  const load = useCallback(async (next: string | null = null) => {
    if (loadLock.current) return;
    loadLock.current = true; setLoading(true); setError("");
    try {
      const page = await api<GuidePage<Completion>>(`${path}${next ? `?cursor=${encodeURIComponent(next)}` : ""}`);
      setItems(previous => next ? [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))] : page.items);
      setCursor(page.nextCursor); setLoaded(true);
    } catch (e) { setError(errorMessage(e)); }
    finally { loadLock.current = false; setLoading(false); }
  }, [api, path]);
  async function refresh() { await Promise.all([load(), refreshSituation()]); }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true); setFormError("");
    creationId.current ||= crypto.randomUUID();
    try {
      await api(path, { method: "POST", body: JSON.stringify({ id: creationId.current, text }) });
      setText(""); setFormOpen(false); setOpen(true); creationId.current = null;
      await refresh();
    } catch (e) { setFormError(errorMessage(e)); }
    finally { saveLock.current = false; setSaving(false); }
  }
  return <section className="space-y-4 border-t border-gray-200 pt-6" aria-labelledby="completions-title">
    <h2 id="completions-title" className="text-xl font-semibold">Completările colegilor ({count})</h2>
    {!withdrawn ? <Button type="button" size="lg" className="w-full sm:w-auto" variant="outline" onClick={() => setFormOpen(true)}>Adaugă o completare</Button> : null}
    {formOpen && !withdrawn ? <form onSubmit={publish} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
      <label htmlFor="new-completion" className="block font-medium">Ce ai adăuga?</label>
      <textarea id="new-completion" value={text} onChange={event => setText(event.target.value)} required maxLength={10000} rows={5} disabled={saving} className={fieldClass} />
      {formError ? <ErrorNotice>{formError}</ErrorNotice> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" size="lg" disabled={saving}>{saving ? "Se publică…" : "Publică completarea"}</Button>
        <Button type="button" size="lg" variant="outline" disabled={saving} onClick={() => setFormOpen(false)}>Anulează</Button></div>
    </form> : null}
    <Button type="button" variant="ghost" size="lg" className="h-auto min-h-11 whitespace-normal px-0 text-left" aria-expanded={open} aria-controls="completions-list"
      onClick={() => { setOpen(previous => !previous); if (!loaded && !open) void load(); }}>{open ? "Ascunde completările" : "Vezi completările"} ({count})</Button>
    {open ? <div id="completions-list" className="space-y-3" aria-busy={loading}>
      {error ? <div className="space-y-2"><ErrorNotice>{error}</ErrorNotice><Button size="lg" variant="outline" onClick={() => void load()}>Încearcă din nou</Button></div> : null}
      <ul className="space-y-3">{items.map(item => <CompletionItem key={item.id} item={item} path={path} onChange={refresh} />)}</ul>
      {loading ? <p role="status">Se încarcă completările…</p> : null}
      {loaded && !loading && !error && !items.length ? <p className="text-gray-600">Nu există încă completări.</p> : null}
      {cursor ? <Button variant="outline" size="lg" className="w-full" disabled={loading} onClick={() => void load(cursor)}>Arată mai multe completări</Button> : null}
    </div> : null}
  </section>;
}
