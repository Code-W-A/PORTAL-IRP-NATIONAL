import ReportDetailClient from "@/app/(admin-irp)/dashboard/raportari/ReportDetailClient";

type Props = {
  params: Promise<{ typeId: string }>;
};

export default async function RaportariNewPage({ params }: Props) {
  const { typeId } = await params;
  return <ReportDetailClient typeId={typeId} mode="create" />;
}
