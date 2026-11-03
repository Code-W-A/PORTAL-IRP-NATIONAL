import { Suspense } from "react";
import SituationForm from "@/components/ghid-comunicare/SituationForm";
export const metadata = { title: "Adaugă o situație | Portal IRP" };
export default function AddSituationPage() {
  return <Suspense fallback={<p>Se încarcă formularul…</p>}><SituationForm /></Suspense>;
}
