"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Situation } from "@/lib/ghid-comunicare/types";
import { WITHDRAWN_TITLE } from "@/lib/ghid-comunicare/types";
import { AuthorLine, BackLink, CopyAnswer, ErrorNotice, errorMessage, guideLocation, guideUrl, useGuide } from "./shared";
import Completions from "./Completions";
import { FavoriteButton } from "./FavoriteButton";
import { useGuidePreferences } from "./GuidePreferences";

export default function SituationDetail({ id, embedded = false, onWithdraw }: {
  id: string; embedded?: boolean; onWithdraw?: (item: Situation) => void;
}) {
  const router = useRouter();
  const location = guideLocation(useSearchParams());
  const { categories } = useGuidePreferences();
  const Title = embedded ? "h2" : "h1";
  const { user } = useAuth();
  const guide = useGuide();
  const [item, setItem] = useState<Situation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const refresh = useCallback(async () => { if (guide) setItem(await guide.get(id)); }, [guide, id]);
  useEffect(() => {
    if (!guide) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setItem(null);
    guide.get(id).then(value => { if (!controller.signal.aborted) setItem(value); })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [guide, id, retry]);
  async function withdraw() {
    if (!guide || lock.current || !window.confirm("Ștergi această situație? Întrebarea, răspunsul și continuările tale vor fi retrase. Completările colegilor vor fi păstrate.")) return;
    lock.current = true; setDeleting(true); setError("");
    try {
      await guide.withdraw(id);
      const withdrawn = await guide.get(id);
      setItem(withdrawn);
      onWithdraw?.(withdrawn);
    }
    catch (e) { setError(errorMessage(e)); }
    finally { lock.current = false; setDeleting(false); }
  }
  return <article aria-label={embedded ? "Situația selectată" : undefined}
    className={`mx-auto flex max-w-3xl flex-col gap-5 ${embedded ? "p-5 sm:p-6" : "pb-8"}`}>
    <div className={embedded ? "lg:hidden" : ""}>
      <BackLink href={guideUrl({ ...location, selected: undefined })} />
    </div>
    {loading ? <p role="status">Se încarcă situația…</p> : null}
    {error ? <div className="space-y-3"><ErrorNotice>{error}</ErrorNotice>{!item ? <Button variant="outline" size="lg" onClick={() => setRetry(value => value + 1)}>Încearcă din nou</Button> : null}</div> : null}
    {item ? <>
      <div className="flex items-start justify-between gap-2">
        <Title className="min-w-0 grow break-words pt-1 text-2xl font-semibold leading-snug text-slate-900">
          {item.status === "withdrawn" ? WITHDRAWN_TITLE : item.question}
        </Title>
        <FavoriteButton id={id} active={item.status === "active"} />
        {item.status === "active" && item.author.uid === user?.uid ? <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Opțiuni situație" disabled={deleting} className="size-11">
              <Ellipsis aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent portal className="min-w-44">
            <DropdownMenuItem onClick={() => router.push(guideUrl(location, `/${id}/editeaza`))}>Editează</DropdownMenuItem>
            <DropdownMenuItem className="text-red-700" onClick={() => void withdraw()}>Retrage situația</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : null}
      </div>
      {item.status === "active" ? <>
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-6">
          <p className="select-text whitespace-pre-wrap break-words text-xl leading-relaxed text-gray-950">{item.answer}</p>
          <CopyAnswer text={item.answer} />
        </div>
        {item.categoryIds.length ? <div className="flex flex-wrap gap-2" aria-label="Categorii">
          {categories.filter(category => item.categoryIds.includes(category.id)).map(category =>
            <span key={category.id} className="break-all rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700">{category.name}</span>)}
        </div> : null}
        <AuthorLine author={item.author} date={item.updatedAt} proposed />
        {item.followUps.length ? <section className="space-y-3" aria-labelledby="followups-title">
          <h2 id="followups-title" className="text-xl font-semibold">Dacă întreabă și…</h2>
          {item.followUps.map((pair, index) => <details key={`${item.updatedAt}-${index}`} className="rounded-xl border border-gray-200">
            <summary className="min-h-11 cursor-pointer break-words px-4 py-3 font-medium text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{pair.question}</summary>
            <div className="space-y-4 border-t border-gray-100 p-4"><p className="select-text whitespace-pre-wrap break-words text-lg leading-relaxed">{pair.answer}</p><CopyAnswer text={pair.answer} /></div>
          </details>)}
        </section> : null}
      </> : <p className="text-gray-600">Conținutul autorului a fost retras. Completările colegilor sunt păstrate mai jos.</p>}
      <Completions key={id} id={id} count={item.completionCount} withdrawn={item.status === "withdrawn"} refreshSituation={refresh} />
    </> : null}
  </article>;
}
