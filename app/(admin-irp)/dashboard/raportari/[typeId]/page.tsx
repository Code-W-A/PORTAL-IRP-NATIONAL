import RaportariTypeReportsList from "@/app/(admin-irp)/dashboard/raportari/RaportariTypeReportsList";

type Props = {
  params: Promise<{ typeId: string }>;
};

export default async function RaportariTypePage({ params }: Props) {
  const { typeId } = await params;
  return <RaportariTypeReportsList typeId={typeId} />;
}
