import ReportDetailClient from "@/app/(admin-irp)/dashboard/raportari/ReportDetailClient";

type Props = {
  params: Promise<{ typeId: string; reportId: string }>;
};

export default async function RaportariReportPage({ params }: Props) {
  const { typeId, reportId } = await params;
  return <ReportDetailClient typeId={typeId} reportId={reportId} mode="existing" />;
}
