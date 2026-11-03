import { Suspense } from "react";
import SituationForm from "@/components/ghid-comunicare/SituationForm";
export const metadata = { title: "Editează situația | Portal IRP" };
export default async function EditSituationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<p>Se încarcă formularul…</p>}><SituationForm id={id} /></Suspense>;
}
