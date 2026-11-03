import { Suspense } from "react";
import GuideList from "@/components/ghid-comunicare/GuideList";
export const metadata = { title: "Ghid de comunicare | Portal IRP" };
export default function GuidePage() {
  return <Suspense fallback={<p>Se încarcă ghidul…</p>}><GuideList /></Suspense>;
}
