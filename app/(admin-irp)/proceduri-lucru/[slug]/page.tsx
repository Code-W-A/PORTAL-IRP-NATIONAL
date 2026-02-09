import { notFound } from "next/navigation";

import ProcedureDetailClient from "@/components/proceduri-lucru/ProcedureDetailClient";
import { getProcedureBySlug } from "@/lib/proceduri-lucru/data";

type ProcedureDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProcedureDetailPage({ params }: ProcedureDetailPageProps) {
  const { slug } = await params;
  const procedure = getProcedureBySlug(slug);

  if (!procedure) {
    notFound();
  }

  return <ProcedureDetailClient procedure={procedure} />;
}
