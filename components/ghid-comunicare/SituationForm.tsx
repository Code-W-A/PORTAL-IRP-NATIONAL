"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import type { FollowUp } from "@/lib/ghid-comunicare/types";
import { BackLink, ErrorNotice, errorMessage, fieldClass, guideUrl, useGuide } from "./shared";

export default function SituationForm({ id }: { id?: string }) {
  const query = useSearchParams().get("q") || "";
  const router = useRouter();
  const { user } = useAuth();
  const guide = useGuide();
  const [question, setQuestion] = useState(id ? "" : query);
  const [answer, setAnswer] = useState("");
  const [followUps, setFollowUps] = useState<(FollowUp & { key: string })[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [allowed, setAllowed] = useState(!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const creationId = useRef<string | null>(null);
  const cancelUrl = guideUrl(query, id ? `/${id}` : "");

  useEffect(() => {
    if (!guide || !id) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    guide.get(id).then(item => {
      if (controller.signal.aborted) return;
      if (item.author.uid !== user?.uid || item.status !== "active") {
        setAllowed(false); setError("Poți edita doar situațiile active publicate de tine."); return;
      }
      setAllowed(true); setQuestion(item.question); setAnswer(item.answer);
      setFollowUps(item.followUps.map(pair => ({ ...pair, key: crypto.randomUUID() })));
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, guide, user?.uid, retry]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!guide || lock.current) return;
    lock.current = true; setSaving(true); setError("");
    creationId.current ||= crypto.randomUUID();
    try {
      const draft = { question, answer, followUps: followUps.map(({ question, answer }) => ({ question, answer })) };
      const saved = id ? await guide.update(id, draft) : await guide.create({ ...draft, id: creationId.current });
      router.replace(guideUrl(query, `/${saved.id}`), { scroll: true });
    } catch (e) { setError(errorMessage(e)); setSaving(false); lock.current = false; }
  }
  function changePair(index: number, field: keyof FollowUp, value: string) {
    setFollowUps(previous => previous.map((pair, i) => i === index ? { ...pair, [field]: value } : pair));
  }
  return <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-8">
    <BackLink href={cancelUrl} />
    <h1 className="text-2xl font-semibold">{id ? "Editează situația" : "Adaugă o situație"}</h1>
    {loading ? <p role="status">Se încarcă situația…</p> : null}
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    {!loading && !allowed ? <Button variant="outline" size="lg" onClick={() => setRetry(value => value + 1)}>Încearcă din nou</Button> : null}
    {!loading && allowed ? <form onSubmit={save} className="space-y-5">
      <fieldset disabled={saving} className="space-y-5">
        <div className="space-y-2"><label htmlFor="situation-question" className="block font-medium">Ce te poate întreba?</label>
          <textarea id="situation-question" value={question} onChange={event => setQuestion(event.target.value)} required maxLength={1000} rows={2} placeholder="De ce a durat intervenția?" className={fieldClass} /></div>
        <div className="space-y-2"><label htmlFor="situation-answer" className="block font-medium">Ce poți răspunde?</label>
          <textarea id="situation-answer" value={answer} onChange={event => setAnswer(event.target.value)} required maxLength={20000} rows={8} className={fieldClass} /></div>
        {followUps.map((pair, index) => <div key={pair.key} className="space-y-3 rounded-xl border border-gray-200 p-4">
          <div className="space-y-2"><label htmlFor={`${pair.key}-question`} className="block font-medium">Întrebarea suplimentară {index + 1}</label>
            <textarea id={`${pair.key}-question`} value={pair.question} onChange={event => changePair(index, "question", event.target.value)} required maxLength={1000} rows={2} className={fieldClass} /></div>
          <div className="space-y-2"><label htmlFor={`${pair.key}-answer`} className="block font-medium">Răspunsul suplimentar {index + 1}</label>
            <textarea id={`${pair.key}-answer`} value={pair.answer} onChange={event => changePair(index, "answer", event.target.value)} required maxLength={10000} rows={4} className={fieldClass} /></div>
          <Button type="button" variant="outline" size="lg" onClick={() => setFollowUps(previous => previous.filter(p => p.key !== pair.key))}>Elimină întrebarea</Button>
        </div>)}
        <Button type="button" variant="outline" size="lg" className="h-auto min-h-11 whitespace-normal text-left" disabled={followUps.length >= 30}
          onClick={() => setFollowUps(previous => [...previous, { question: "", answer: "", key: crypto.randomUUID() }])}>Adaugă o întrebare suplimentară</Button>
      </fieldset>
      <div className="flex flex-wrap gap-3"><Button type="submit" size="lg" disabled={saving}>{saving ? "Se salvează…" : "Salvează"}</Button>
        <Button asChild variant="outline" size="lg" disabled={saving}><Link href={cancelUrl} scroll={Boolean(id)} aria-disabled={saving} onClick={e => { if (saving) e.preventDefault(); }}>Anulează</Link></Button></div>
    </form> : null}
  </div>;
}
