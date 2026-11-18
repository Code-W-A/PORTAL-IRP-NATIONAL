"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { UNCATEGORIZED, WITHDRAWN_TITLE, type Situation, type SituationSummary } from "@/lib/ghid-comunicare/types";
import { FavoriteButton } from "./FavoriteButton";
import { useGuidePreferences } from "./GuidePreferences";
import { CopyAnswer, ErrorNotice, errorMessage, fieldClass, guideLocation, guideUrl, useGuide, type GuideLocation } from "./shared";
import SituationDetail from "./SituationDetail";

type ListPosition = { query: string; category: string; favorites: boolean; count: number; scroll: number };

function updateLocation(changes: Partial<GuideLocation>, push = false) {
  const current = guideLocation(new URLSearchParams(window.location.search));
  const href = guideUrl({ ...current, ...changes });
  if (href === window.location.pathname + window.location.search) return;
  if (push) window.history.pushState(null, "", href);
  else window.history.replaceState(null, "", href);
}

export default function GuideList() {
  const params = useSearchParams();
  const { query, category, favorites: onlyFavorites, selected } = guideLocation(params);
  const location = { query, category, favorites: onlyFavorites };
  const { user } = useAuth();
  const guide = useGuide();
  const { categories, favorites, categoryError, favoriteError, retry: retryPreferences } = useGuidePreferences();
  const savedIds = onlyFavorites ? favorites : null;
  const [input, setInput] = useState(query);
  const [items, setItems] = useState<SituationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const loadLock = useRef(false);
  const generation = useRef(0);
  const selectionTarget = useRef<HTMLDivElement>(null);
  const focusDetail = useRef(false);
  const storageKey = user ? `ghid-comunicare:v2:${user.uid}:list` : null;

  useEffect(() => { setInput(query); }, [query]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (input !== query && window.location.pathname === "/ghid-comunicare") {
        updateLocation({ query: input, selected: undefined });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [input, query]);

  const loadPage = useCallback((next: string | null, signal?: AbortSignal) => {
    if (!guide) throw new Error("Ghid indisponibil.");
    return savedIds
      ? guide.listFavorites(savedIds, query, category, next, signal)
      : guide.list(query, next, signal, category);
  }, [guide, savedIds, query, category]);

  useEffect(() => {
    if (!storageKey || !guide || (onlyFavorites && !savedIds)) return;
    const controller = new AbortController();
    generation.current += 1;
    loadLock.current = true;
    setLoading(true); setError(""); setItems([]); setCursor(null);
    let saved: ListPosition | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch {}
    const restore = saved?.query === query && saved.category === category && saved.favorites === onlyFavorites ? saved : null;
    const targetCount = Math.max(20, Number(restore?.count) || 20);
    async function load() {
      try {
        let next: string | null = null;
        const collected: SituationSummary[] = [];
        do {
          const page = await loadPage(next, controller.signal);
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
    return () => { controller.abort(); generation.current += 1; };
  }, [query, category, onlyFavorites, guide, savedIds, loadPage, storageKey, retry]);

  useEffect(() => {
    if (selected && focusDetail.current) selectionTarget.current?.focus({ preventScroll: true });
    focusDetail.current = false;
  }, [selected]);

  function savePosition() {
    if (!storageKey) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ ...location, count: items.length, scroll: window.scrollY })); } catch {}
  }

  function changeFilter(next: { favorites?: boolean; category?: string }) {
    updateLocation({ query: input, selected: undefined, ...next });
  }

  async function more() {
    if (!guide || !cursor || loadLock.current || (onlyFavorites && !savedIds)) return;
    const currentGeneration = generation.current;
    loadLock.current = true; setLoading(true); setError("");
    try {
      const page = await loadPage(cursor);
      if (generation.current !== currentGeneration) return;
      setItems(previous => [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))]);
      setCursor(page.nextCursor);
    } catch (e) { if (generation.current === currentGeneration) setError(errorMessage(e)); }
    finally { if (generation.current === currentGeneration) { setLoading(false); loadLock.current = false; } }
  }

  function applyWithdrawal(item: Situation) {
    const { followUps: _followUps, ...summary } = item;
    setItems(previous => previous.flatMap(row => {
      if (row.id !== item.id) return [row];
      return item.completionCount && !query.trim() ? [summary] : [];
    }));
  }

  function addLink(prefill = false) {
    return <Button asChild variant={prefill ? "default" : "outline"} size="lg" className="w-full sm:w-auto">
      <Link href={guideUrl({ ...location, prefill }, "/adauga")} onClick={savePosition}>
        <Plus aria-hidden="true" /> Adaugă o situație
      </Link>
    </Button>;
  }

  const waitingForFavorites = onlyFavorites && !savedIds;
  const unavailable = waitingForFavorites && Boolean(favoriteError);
  const busy = !unavailable && (waitingForFavorites || loading);
  const canPrefill = !busy && !error && !onlyFavorites && items.length === 0 && Boolean(query.trim());

  return <div className="mx-auto max-w-7xl pb-8 text-slate-900">
    <header className={`mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5 ${selected ? "hidden lg:flex" : ""}`}>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ghid de comunicare</h1>
      {addLink(canPrefill)}
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(18rem,2fr)_minmax(0,3fr)] xl:gap-8">
      <section aria-label="Caută situații" className={`min-w-0 space-y-4 ${selected ? "hidden lg:block" : ""}`}>
        <div className="space-y-3">
          <div className="relative">
            <label htmlFor="guide-search" className="sr-only">Ce te-a întrebat?</label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
            <input id="guide-search" type="search" value={input} onChange={event => setInput(event.target.value)}
              maxLength={1000} placeholder="Ce te-a întrebat?" className={`${fieldClass} min-h-12 pl-11`} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Situații afișate">
            <Button type="button" variant={onlyFavorites ? "outline" : "default"} aria-pressed={!onlyFavorites}
              className="min-h-11" onClick={() => changeFilter({ favorites: false })}>Toate situațiile</Button>
            <Button type="button" variant={onlyFavorites ? "default" : "outline"} aria-pressed={onlyFavorites}
              className="min-h-11" onClick={() => changeFilter({ favorites: true })}>Favoritele mele</Button>
          </div>
          <label className="sr-only" htmlFor="guide-category">Filtrează după categorie</label>
          <select id="guide-category" value={category} onChange={event => changeFilter({ category: event.target.value })} className={fieldClass}>
            <option value="">Toate categoriile</option>
            <option value={UNCATEGORIZED}>Fără categorie</option>
            {category && category !== UNCATEGORIZED && !categories.some(item => item.id === category) ?
              <option value={category}>Categoria selectată</option> : null}
            {categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        {categoryError || favoriteError ? <div className="space-y-2">
          <ErrorNotice>{categoryError ? "Categoriile nu s-au încărcat. " : ""}{favoriteError ? "Favoritele nu s-au încărcat." : ""}</ErrorNotice>
          <Button variant="outline" onClick={retryPreferences}>Reîncarcă filtrele</Button>
        </div> : null}
        {!waitingForFavorites && error ? <div className="space-y-2"><ErrorNotice>{error}</ErrorNotice>
          <Button variant="outline" onClick={() => items.length ? void more() : setRetry(value => value + 1)}>Încearcă din nou</Button></div> : null}
        <div aria-busy={busy} className="space-y-3">
          {!waitingForFavorites && items.map(item => {
            const active = item.status === "active";
            const href = guideUrl(location, `/${item.id}`);
            const titleId = `guide-title-${item.id}`;
            return <article key={item.id} className={`min-w-0 space-y-3 rounded-xl border p-4 ${selected === item.id ? "border-blue-400 bg-blue-50/60" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <Link href={href} onClick={event => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  savePosition();
                  if (window.matchMedia("(min-width: 1024px)").matches) {
                    event.preventDefault();
                    focusDetail.current = true;
                    updateLocation({ selected: item.id }, true);
                  }
                }} aria-labelledby={titleId} aria-current={selected === item.id ? "true" : undefined}
                className="min-w-0 grow rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-blue-600">
                  <h2 id={titleId} className="break-words text-lg font-semibold leading-snug hover:text-blue-700">{active ? item.question : WITHDRAWN_TITLE}</h2>
                  <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">{active ? item.answer.slice(0, 500) : `${item.completionCount} completări păstrate`}</p>
                </Link>
                <FavoriteButton id={item.id} active={active} />
              </div>
              {item.matchingQuestion ? <p className="break-words text-sm text-slate-700"><strong>Întrebare suplimentară</strong> · {item.matchingQuestion}</p> : null}
              {item.categoryIds.length ? <div className="flex flex-wrap gap-1.5">
                {categories.filter(itemCategory => item.categoryIds.includes(itemCategory.id)).map(itemCategory =>
                  <span key={itemCategory.id} className="break-all rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{itemCategory.name}</span>)}
              </div> : null}
              {active ? <CopyAnswer text={item.answer} compact /> : null}
            </article>;
          })}
          {busy ? <p role="status" className="py-3 text-slate-600">Se încarcă situațiile…</p> : null}
          {!busy && !error && !unavailable && !items.length ? <div className="space-y-3 rounded-xl border border-dashed border-slate-300 p-5">
            <p>{onlyFavorites && !query && !category ? "Nu ai încă situații favorite." : "Nu am găsit această situație."}</p>
          </div> : null}
        </div>
        {!waitingForFavorites && cursor ? <Button type="button" variant="outline" size="lg" className="w-full" onClick={more} disabled={busy}>Arată mai multe</Button> : null}
      </section>

      <div ref={selectionTarget} tabIndex={-1} role="region" aria-label="Detaliile situației"
        className={`min-w-0 bg-white focus:outline-none lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:rounded-xl lg:border lg:border-slate-200 ${selected ? "" : "hidden"}`}>
        {selected ? <SituationDetail key={selected} id={selected} embedded onWithdraw={applyWithdrawal} /> :
          <p className="p-6 text-slate-600">Selectează o situație pentru a vedea răspunsul și completările.</p>}
      </div>
    </div>
  </div>;
}
