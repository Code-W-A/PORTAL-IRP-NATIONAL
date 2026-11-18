"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import type { Situation } from "@/lib/ghid-comunicare/types";
import { WITHDRAWN_TITLE } from "@/lib/ghid-comunicare/types";
import { AuthorLine, BackLink, CopyAnswer, ErrorNotice, errorMessage, guideUrl, useGuide } from "./shared";
import Completions from "./Completions";

export default function SituationDetail({ id }: { id: string }) {
  const query = useSearchParams().get("q") || "";
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
    try { await guide.withdraw(id); await refresh(); }
    catch (e) { setError(errorMessage(e)); }
    finally { lock.current = false; setDeleting(false); }
  }
  return <article className="mx-auto flex max-w-3xl flex-col gap-5 pb-8">
    <BackLink href={guideUrl(query)} />
    {loading ? <p role="status">Se încarcă situația…</p> : null}
    {error ? <div className="space-y-3"><ErrorNotice>{error}</ErrorNotice>{!item ? <Button variant="outline" size="lg" onClick={() => setRetry(value => value + 1)}>Încearcă din nou</Button> : null}</div> : null}
    {item ? <>
      <h1 className="break-words text-2xl font-semibold leading-snug text-gray-900">{item.status === "withdrawn" ? WITHDRAWN_TITLE : item.question}</h1>
      {item.status === "active" ? <>
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-6">
          <p className="select-text whitespace-pre-wrap break-words text-xl leading-relaxed text-gray-950">{item.answer}</p>
          <CopyAnswer text={item.answer} />
        </div>
        <AuthorLine author={item.author} date={item.updatedAt} proposed />
        {item.followUps.length ? <section className="space-y-3" aria-labelledby="followups-title">
          <h2 id="followups-title" className="text-xl font-semibold">Dacă întreabă și…</h2>
          {item.followUps.map((pair, index) => <details key={`${item.updatedAt}-${index}`} className="rounded-xl border border-gray-200">
            <summary className="min-h-11 cursor-pointer break-words px-4 py-3 font-medium text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{pair.question}</summary>
            <div className="space-y-4 border-t border-gray-100 p-4"><p className="select-text whitespace-pre-wrap break-words text-lg leading-relaxed">{pair.answer}</p><CopyAnswer text={pair.answer} /></div>
          </details>)}
        </section> : null}
        {item.author.uid === user?.uid ? <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" variant="outline"><Link href={guideUrl(query, `/${id}/editeaza`)}>Editează</Link></Button>
          <Button type="button" variant="ghost" size="lg" className="text-red-700" disabled={deleting} onClick={() => void withdraw()}>{deleting ? "Se șterge…" : "Șterge"}</Button>
        </div> : null}
      </> : <p className="text-gray-600">Conținutul autorului a fost retras. Completările colegilor sunt păstrate mai jos.</p>}
      <Completions key={id} id={id} count={item.completionCount} withdrawn={item.status === "withdrawn"} refreshSituation={refresh} />
    </> : null}
  </article>;
}
