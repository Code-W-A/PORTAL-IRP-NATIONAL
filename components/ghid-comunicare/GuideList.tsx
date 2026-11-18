"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import type { SituationSummary } from "@/lib/ghid-comunicare/types";
import { WITHDRAWN_TITLE } from "@/lib/ghid-comunicare/types";
import { ErrorNotice, errorMessage, fieldClass, guideUrl, useGuide } from "./shared";

type ListPosition = { query: string; count: number; scroll: number };
export default function GuideList() {
  const params = useSearchParams();
  const query = params.get("q") || "";
  const router = useRouter();
  const { user } = useAuth();
  const guide = useGuide();
  const [input, setInput] = useState(query);
  const [items, setItems] = useState<SituationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const loadLock = useRef(false);
  const generation = useRef(0);
  const storageKey = user ? `ghid-comunicare:v1:${user.uid}:list` : null;

  useEffect(() => { setInput(query); }, [query]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (input !== query) router.replace(guideUrl(input), { scroll: false });
    }, 300);
    return () => clearTimeout(timeout);
  }, [input, query, router]);

  useEffect(() => {
    if (!storageKey || !guide) return;
    const service = guide;
    const controller = new AbortController();
    generation.current += 1;
    loadLock.current = true;
    setLoading(true); setError(""); setItems([]); setCursor(null);
    let saved: ListPosition | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch {}
    const restore = saved?.query === query ? saved : null;
    const targetCount = Math.max(20, Number(restore?.count) || 20);
    async function load() {
      try {
        let next: string | null = null;
        const collected: SituationSummary[] = [];
        do {
          const page = await service.list(query, next, controller.signal);
          collected.push(...page.items);
          next = page.nextCursor;
        } while (next && collected.length < targetCount);
        if (controller.signal.aborted) return;
        setItems(collected); setCursor(next);
        if (restore) requestAnimationFrame(() => { if (!controller.signal.aborted) window.scrollTo(0, restore.scroll); });
      } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
      finally { if (!controller.signal.aborted) { setLoading(false); loadLock.current = false; } }
    }
    void load();
    return () => controller.abort();
  }, [query, guide, storageKey, retry]);

  function savePosition() {
    if (!storageKey) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ query, count: items.length, scroll: window.scrollY })); } catch {}
  }
  async function more() {
    if (!guide || !cursor || loadLock.current) return;
    const currentGeneration = generation.current;
    loadLock.current = true; setLoading(true); setError("");
    try {
      const page = await guide.list(query, cursor);
      if (generation.current !== currentGeneration) return;
      setItems(previous => [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))]);
      setCursor(page.nextCursor);
    } catch (e) { if (generation.current === currentGeneration) setError(errorMessage(e)); }
    finally { if (generation.current === currentGeneration) { setLoading(false); loadLock.current = false; } }
  }
  const addLink = <Button asChild size="lg" className="w-full sm:w-auto"><Link href={guideUrl(query, "/adauga")} onClick={savePosition} scroll={true}>Adaugă o situație</Link></Button>;
  return <div className="mx-auto max-w-3xl space-y-6 pb-8">
    <header className="space-y-2"><h1 className="text-3xl font-semibold text-gray-900">Ghid de comunicare</h1>
      <p className="text-gray-600">Găsește rapid un răspuns sau adaugă o situație din experiența ta.</p></header>
    <div className="space-y-4">
      <label htmlFor="guide-search" className="block font-medium text-gray-900">Ce te-a întrebat?</label>
      <input id="guide-search" type="search" value={input} onChange={event => setInput(event.target.value)} maxLength={1000} placeholder="Ce te-a întrebat?" className={`${fieldClass} min-h-14`} />
      {addLink}
    </div>
    {error ? <div className="space-y-2"><ErrorNotice>{error}</ErrorNotice><Button size="lg" variant="outline" onClick={() => items.length ? void more() : setRetry(value => value + 1)}>Încearcă din nou</Button></div> : null}
    <div aria-busy={loading} className="space-y-3">
      {items.map(item => <Link key={item.id} href={guideUrl(query, `/${item.id}`)} onClick={savePosition} scroll={true}
        className="block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <h2 className="break-words text-lg font-semibold text-gray-900">{item.status === "withdrawn" ? WITHDRAWN_TITLE : item.question}</h2>
        <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-gray-600">{item.status === "withdrawn" ? `${item.completionCount} completări păstrate` : item.answer}</p>
      </Link>)}
      {loading ? <p role="status" className="py-4 text-gray-600">Se încarcă situațiile…</p> : null}
      {!loading && !error && !items.length ? <div className="space-y-4 rounded-xl border border-dashed border-gray-300 p-5"><p>Nu am găsit această situație.</p>{addLink}</div> : null}
    </div>
    {cursor ? <Button type="button" variant="outline" size="lg" className="w-full" onClick={more} disabled={loading}>Arată mai multe</Button> : null}
  </div>;
}
