import { Suspense } from "react";
import SituationDetail from "@/components/ghid-comunicare/SituationDetail";
export const metadata = { title: "Situație | Ghid de comunicare" };
export default async function SituationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<p>Se încarcă situația…</p>}><SituationDetail id={id} /></Suspense>;
}
